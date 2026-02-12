import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { toJSONSafe } from '../lib/serializeFirestore.js';

const router = Router();

// Listar pagamentos (admin: todos; aluno: próprios)
router.get(
  '/',
  requireAuth(),
  query('userId').optional().notEmpty(),
  query('type').optional().isIn(['mensalidade', 'aluguel', 'inscricao', 'taxa']),
  query('status').optional().isIn(['pending', 'paid', 'overdue', 'cancelled']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      let q = db.collection('payments').orderBy('dueDate', 'desc').limit(200);

      if (req.userRole !== 'admin' && req.userRole !== 'instructor') {
        q = q.where('userId', '==', req.uid);
      } else if (req.query.userId) {
        q = q.where('userId', '==', req.query.userId);
      }
      if (req.query.type) q = q.where('type', '==', req.query.type);
      if (req.query.status) q = q.where('status', '==', req.query.status);
      if (req.query.from) q = q.where('dueDate', '>=', new Date(req.query.from));
      if (req.query.to) q = q.where('dueDate', '<=', new Date(req.query.to));

      const snapshot = await q.get();
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json(toJSONSafe(list));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar pagamentos' });
    }
  }
);

// Resumo financeiro (admin)
router.get('/summary', requireAuth(['admin']), async (req, res) => {
  try {
    const snapshot = await db.collection('payments').get();
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    snapshot.docs.forEach((d) => {
      const data = d.data();
      const amount = Number(data.amount) || 0;
      if (data.status === 'paid') totalPaid += amount;
      else if (data.status === 'overdue') totalOverdue += amount;
      else if (data.status === 'pending') totalPending += amount;
    });
    res.json({
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao calcular resumo' });
  }
});

// Criar registro de pagamento (mensalidade, aluguel, taxa)
router.post(
  '/',
  requireAuth(['admin', 'instructor']),
  body('userId').notEmpty(),
  body('type').isIn(['mensalidade', 'aluguel', 'inscricao', 'taxa']),
  body('amount').isFloat({ min: 0 }),
  body('dueDate').isISO8601(),
  body('description').optional().trim(),
  body('referenceId').optional().notEmpty(), // classId, bookingId, championshipId, etc.
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const due = new Date(req.body.dueDate);
      const isOverdue = due < new Date() && !req.body.paid;
      const data = {
        userId: req.body.userId,
        type: req.body.type,
        amount: Number(req.body.amount),
        dueDate: due,
        description: req.body.description || null,
        referenceId: req.body.referenceId || null,
        status: req.body.paid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        paidAt: req.body.paid ? new Date() : null,
        createdAt: new Date(),
        createdBy: req.uid,
      };
      const ref = await db.collection('payments').add(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar pagamento' });
    }
  }
);

// Marcar como pago
router.patch(
  '/:id/pay',
  requireAuth(['admin', 'instructor']),
  param('id').notEmpty(),
  body('paidAt').optional().isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('payments').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Pagamento não encontrado' });

      await ref.update({
        status: 'paid',
        paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
        updatedBy: req.uid,
        updatedAt: new Date(),
      });
      res.json({ ok: true, id: req.params.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao registrar pagamento' });
    }
  }
);

// Marcar inadimplente (admin)
router.patch(
  '/:id/overdue',
  requireAuth(['admin']),
  param('id').notEmpty(),
  async (req, res) => {
    try {
      const ref = db.collection('payments').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Pagamento não encontrado' });

      await ref.update({
        status: 'overdue',
        updatedBy: req.uid,
        updatedAt: new Date(),
      });
      res.json({ ok: true, id: req.params.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  }
);

export default router;
