import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db, rtdb } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { isCourtInStudentClassNow } from '../lib/studentSchedule.js';
import { toJSONSafe } from '../lib/serializeFirestore.js';

const router = Router();
const RTDB_COURTS = 'courts';

// Listar quadras: status "alugada" vem dos aluguéis agendados (reservas ativas); manutenção do RTDB
router.get('/', requireAuth(), async (req, res) => {
  try {
    const snapshot = await db.collection('courts').orderBy('name').get();
    const courts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    let statusMap = {};
    if (rtdb) {
      const rtdbSnap = await rtdb.ref(RTDB_COURTS).once('value');
      statusMap = rtdbSnap.val() || {};
    }

    const now = new Date();
    const activeBookingsSnap = await db
      .collection('bookings')
      .where('end', '>=', now)
      .get();
    const activeByCourt = {};
    activeBookingsSnap.docs.forEach((d) => {
      const b = d.data();
      const start = b.start?.toDate?.() ?? new Date(b.start);
      if (start <= now) {
        activeByCourt[b.courtId] = { id: d.id, ...b };
      }
    });

    const studentsSnap = await db.collection('users').where('role', '==', 'student').get();
    const studentsWithSchedule = studentsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => Array.isArray(u.schedule) && u.schedule.length > 0);

    const withStatus = courts.map((c) => {
      const rtdbStatus = statusMap[c.id]?.status ?? 'disponivel';
      const activeRental = activeByCourt[c.id];
      const inStudentClass = isCourtInStudentClassNow(c.id, now, studentsWithSchedule);
      let status = 'disponivel';
      if (rtdbStatus === 'manutencao') status = 'manutencao';
      else if (activeRental) status = 'alugada';
      else if (inStudentClass) status = 'em_aula';
      return {
        ...c,
        status,
        currentRental: activeRental ?? (inStudentClass ? { type: 'student_class' } : null) ?? statusMap[c.id]?.currentRental ?? null,
        updatedAt: statusMap[c.id]?.updatedAt ?? null,
      };
    });

    res.json(toJSONSafe(withStatus));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar quadras' });
  }
});

// Detalhes de uma quadra + horários ocupados (simplificado: vem de reservas/aluguéis)
router.get('/:id', requireAuth(), param('id').notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const doc = await db.collection('courts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Quadra não encontrada' });

    const court = { id: doc.id, ...doc.data() };
    let live = {};
    if (rtdb) {
      const rtdbSnap = await rtdb.ref(`${RTDB_COURTS}/${doc.id}`).once('value');
      live = rtdbSnap.val() || {};
    }
    const now = new Date();
    const activeBookingsSnap = await db
      .collection('bookings')
      .where('courtId', '==', req.params.id)
      .where('end', '>=', now)
      .get();
    let active = null;
    activeBookingsSnap.docs.forEach((d) => {
      const b = d.data();
      const start = b.start?.toDate?.() ?? new Date(b.start);
      if (start <= now) active = { id: d.id, ...b };
    });
    const studentsSnapSingle = await db.collection('users').where('role', '==', 'student').get();
    const studentsWithScheduleSingle = studentsSnapSingle.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((u) => Array.isArray(u.schedule) && u.schedule.length > 0);
    const inStudentClass = isCourtInStudentClassNow(req.params.id, now, studentsWithScheduleSingle);

    court.status = live.status === 'manutencao' ? 'manutencao' : (active ? 'alugada' : (inStudentClass ? 'em_aula' : (live.status ?? 'disponivel')));
    court.currentRental = active ?? (inStudentClass ? { type: 'student_class' } : null) ?? live.currentRental ?? null;
    court.updatedAt = live.updatedAt ?? null;

    const bookingsSnap = await db
      .collection('bookings')
      .where('courtId', '==', req.params.id)
      .where('end', '>=', new Date())
      .orderBy('end')
      .limit(50)
      .get();
    court.bookings = bookingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.json(toJSONSafe(court));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar quadra' });
  }
});

// Admin/instrutor: atualizar status da quadra (Firestore + Realtime)
const statusValues = ['disponivel', 'alugada', 'manutencao'];
router.patch(
  '/:id/status',
  requireAuth(['admin', 'instructor']),
  param('id').notEmpty(),
  body('status').isIn(statusValues),
  body('currentRental').optional().isObject(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const { status, currentRental } = req.body;

      const courtRef = await db.collection('courts').doc(id).get();
      if (!courtRef.exists) return res.status(404).json({ error: 'Quadra não encontrada' });

      const payload = {
        status,
        currentRental: currentRental || null,
        updatedAt: Date.now(),
        updatedBy: req.uid,
      };
      if (rtdb) await rtdb.ref(`${RTDB_COURTS}/${id}`).set(payload);

      res.json({ ok: true, status, courtId: id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  }
);

// Admin: criar quadra (nome + posição no mapa: 1, 2, 3... em sequência)
router.post(
  '/',
  requireAuth(['admin']),
  body('name').trim().notEmpty(),
  body('sport').optional().isIn(['beach_tennis', 'futevolei', 'volei_praia', 'multiuso']),
  body('position').isInt({ min: 1, max: 99 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const position = Number(req.body.position);
      const allSnap = await db.collection('courts').get();
      const occupied = allSnap.docs.some((d) => d.data().position === position);
      if (occupied) {
        return res.status(409).json({ error: 'Já existe uma quadra nesta posição no mapa.' });
      }

      const ref = await db.collection('courts').add({
        name: req.body.name,
        sport: req.body.sport || 'multiuso',
        position,
        createdAt: new Date(),
        createdBy: req.uid,
      });
      if (rtdb) {
        await rtdb.ref(`${RTDB_COURTS}/${ref.id}`).set({
          status: 'disponivel',
          currentRental: null,
          updatedAt: Date.now(),
        });
      }
      res.status(201).json({ id: ref.id, name: req.body.name, sport: req.body.sport || 'multiuso', position });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar quadra' });
    }
  }
);

// Admin: atualizar quadra (nome, esporte, posição em sequência 1, 2, 3...)
router.put(
  '/:id',
  requireAuth(['admin']),
  param('id').notEmpty(),
  body('name').optional().trim().notEmpty(),
  body('sport').optional().isIn(['beach_tennis', 'futevolei', 'volei_praia', 'multiuso']),
  body('position').optional().isInt({ min: 1, max: 99 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('courts').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Quadra não encontrada' });

      const update = { updatedAt: new Date(), updatedBy: req.uid };
      if (req.body.name) update.name = req.body.name;
      if (req.body.sport !== undefined) update.sport = req.body.sport;
      if (req.body.position !== undefined) {
        const newPos = Number(req.body.position);
        const allSnap = await db.collection('courts').get();
        const occupied = allSnap.docs.some((d) => {
          if (d.id === req.params.id) return false;
          const pos = d.data().position;
          return typeof pos === 'number' ? pos === newPos : false;
        });
        if (occupied) return res.status(409).json({ error: 'Já existe uma quadra nesta posição no mapa.' });
        update.position = newPos;
      }
      await ref.update(update);
      res.json({ ok: true, id: req.params.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar quadra' });
    }
  }
);

export default router;
