import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Listar turmas/aulas com filtros
router.get(
  '/',
  requireAuth(),
  query('sport').optional().notEmpty(),
  query('courtId').optional().notEmpty(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      let q = db.collection('classes').orderBy('start', 'asc');

      if (req.query.sport) q = q.where('sport', '==', req.query.sport);
      if (req.query.courtId) q = q.where('courtId', '==', req.query.courtId);
      if (req.query.from) q = q.where('start', '>=', new Date(req.query.from));
      if (req.query.to) q = q.where('start', '<=', new Date(req.query.to));

      const snapshot = await q.limit(200).get();
      const classes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json(classes);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar turmas' });
    }
  }
);

// Detalhes de uma turma (com alunos inscritos)
router.get('/:id', requireAuth(), param('id').notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const doc = await db.collection('classes').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Turma não encontrada' });

    const classData = { id: doc.id, ...doc.data() };
    const studentsSnap = await doc.ref.collection('students').get();
    classData.students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.json(classData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar turma' });
  }
});

// Criar turma (admin/instrutor)
router.post(
  '/',
  requireAuth(['admin', 'instructor']),
  body('title').trim().notEmpty(),
  body('sport').isIn(['beach_tennis', 'futevolei', 'volei_praia']),
  body('courtId').notEmpty(),
  body('instructorId').notEmpty(),
  body('start').isISO8601(),
  body('end').isISO8601(),
  body('recurring').optional().isIn(['weekly', 'daily', 'none']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const data = {
        title: req.body.title,
        sport: req.body.sport,
        courtId: req.body.courtId,
        instructorId: req.body.instructorId,
        start: new Date(req.body.start),
        end: new Date(req.body.end),
        recurring: req.body.recurring || 'none',
        createdAt: new Date(),
        createdBy: req.uid,
      };
      const ref = await db.collection('classes').add(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar turma' });
    }
  }
);

// Atualizar turma
router.put(
  '/:id',
  requireAuth(['admin', 'instructor']),
  param('id').notEmpty(),
  body('title').optional().trim().notEmpty(),
  body('courtId').optional().notEmpty(),
  body('start').optional().isISO8601(),
  body('end').optional().isISO8601(),
  body('cancelled').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('classes').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Turma não encontrada' });

      const update = { updatedAt: new Date(), updatedBy: req.uid };
      if (req.body.title) update.title = req.body.title;
      if (req.body.courtId) update.courtId = req.body.courtId;
      if (req.body.start) update.start = new Date(req.body.start);
      if (req.body.end) update.end = new Date(req.body.end);
      if (typeof req.body.cancelled === 'boolean') update.cancelled = req.body.cancelled;
      await ref.update(update);
      res.json({ ok: true, id: req.params.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar turma' });
    }
  }
);

// Adicionar aluno à turma
router.post(
  '/:id/students',
  requireAuth(['admin', 'instructor']),
  param('id').notEmpty(),
  body('userId').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const classRef = db.collection('classes').doc(req.params.id);
      const classDoc = await classRef.get();
      if (!classDoc.exists) return res.status(404).json({ error: 'Turma não encontrada' });

      const existing = await classRef.collection('students').doc(req.body.userId).get();
      if (existing.exists) return res.status(409).json({ error: 'Aluno já inscrito' });

      await classRef.collection('students').doc(req.body.userId).set({
        userId: req.body.userId,
        enrolledAt: new Date(),
        enrolledBy: req.uid,
      });
      res.status(201).json({ ok: true, userId: req.body.userId, classId: req.params.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao inscrever aluno' });
    }
  }
);

// Remover aluno da turma
router.delete(
  '/:id/students/:userId',
  requireAuth(['admin', 'instructor']),
  param('id').notEmpty(),
  param('userId').notEmpty(),
  async (req, res) => {
    try {
      const classRef = db.collection('classes').doc(req.params.id);
      const classDoc = await classRef.get();
      if (!classDoc.exists) return res.status(404).json({ error: 'Turma não encontrada' });

      await classRef.collection('students').doc(req.params.userId).delete();
      res.json({ ok: true, userId: req.params.userId, classId: req.params.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao remover aluno' });
    }
  }
);

export default router;
