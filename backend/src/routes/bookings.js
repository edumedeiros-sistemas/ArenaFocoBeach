import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { rentalConflictsWithStudentSchedule } from '../lib/studentSchedule.js';

const router = Router();

// Listar reservas/aluguéis
router.get(
  '/',
  requireAuth(),
  query('courtId').optional().notEmpty(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      let q = db.collection('bookings').orderBy('start', 'asc');
      if (req.query.courtId) q = q.where('courtId', '==', req.query.courtId);
      if (req.query.from) q = q.where('end', '>=', new Date(req.query.from));
      if (req.query.to) q = q.where('start', '<=', new Date(req.query.to));
      const snapshot = await q.limit(100).get();
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json(list);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar reservas' });
    }
  }
);

// Criar reserva/aluguel (admin/instrutor). Bloqueado em horários de aula de alunos.
router.post(
  '/',
  requireAuth(['admin', 'instructor']),
  body('courtId').notEmpty(),
  body('userId').notEmpty(),
  body('start').isISO8601(),
  body('end').isISO8601(),
  body('description').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const start = new Date(req.body.start);
      const end = new Date(req.body.end);

      const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
      const studentsWithSchedule = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => Array.isArray(u.schedule) && u.schedule.length > 0);

      if (rentalConflictsWithStudentSchedule(req.body.courtId, start, end, studentsWithSchedule)) {
        return res.status(409).json({
          error: 'Horário indisponível: há aula de aluno neste horário nesta quadra. Aluguéis não podem ser agendados em horários de aula.',
        });
      }

      const data = {
        courtId: req.body.courtId,
        userId: req.body.userId,
        start,
        end,
        description: req.body.description || null,
        createdAt: new Date(),
        createdBy: req.uid,
      };
      const ref = await db.collection('bookings').add(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar reserva' });
    }
  }
);

// Excluir reserva
router.delete('/:id', requireAuth(['admin', 'instructor']), param('id').notEmpty(), async (req, res) => {
  try {
    const ref = db.collection('bookings').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Reserva não encontrada' });
    await ref.delete();
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir reserva' });
  }
});

export default router;
