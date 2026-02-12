import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { db } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { expandStudentSchedulesToEvents, expandProfessorSlotsToEvents } from '../lib/studentSchedule.js';

const router = Router();

// Eventos de aula de alunos (horários recorrentes expandidos) para a Agenda
router.get(
  '/student-classes',
  requireAuth(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const from = req.query.from ? new Date(req.query.from) : new Date();
      const to = req.query.to ? new Date(req.query.to) : new Date();
      if (from > to) return res.status(400).json({ error: 'from deve ser anterior a to' });

      const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
      const studentsWithSchedule = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => Array.isArray(u.schedule) && u.schedule.length > 0);

      const events = expandStudentSchedulesToEvents(studentsWithSchedule, from, to);
      res.json(events);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar aulas de alunos' });
    }
  }
);

// Eventos agrupados por professor: "Professor X: 08:00 - 09:00" com quadra e alunos ao clicar
router.get(
  '/professor-classes',
  requireAuth(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('courtId').optional().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const from = req.query.from ? new Date(req.query.from) : new Date();
      const to = req.query.to ? new Date(req.query.to) : new Date();
      if (from > to) return res.status(400).json({ error: 'from deve ser anterior a to' });

      const [studentsSnap, usersSnap, courtsSnap] = await Promise.all([
        db.collection('users').where('role', '==', 'student').get(),
        db.collection('users').get(),
        db.collection('courts').get(),
      ]);

      const studentsWithSchedule = studentsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => Array.isArray(u.schedule) && u.schedule.length > 0);

      const usersById = {};
      usersSnap.docs.forEach((d) => {
        usersById[d.id] = { displayName: d.data().displayName, email: d.data().email };
      });
      const courtsById = {};
      courtsSnap.docs.forEach((d) => {
        courtsById[d.id] = { name: d.data().name };
      });

      let events = expandProfessorSlotsToEvents(studentsWithSchedule, from, to, usersById, courtsById);
      if (req.query.courtId) {
        events = events.filter((e) => e.courtId === req.query.courtId);
      }
      res.json(events);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar aulas por professor' });
    }
  }
);

export default router;
