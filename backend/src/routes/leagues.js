import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Listar ligas
router.get('/', requireAuth(), async (req, res) => {
  try {
    const snapshot = await db.collection('leagues').orderBy('createdAt', 'desc').limit(50).get();
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar ligas' });
  }
});

// Detalhes + tabela de classificação + rodadas
router.get('/:id', requireAuth(), param('id').notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const ref = db.collection('leagues').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Liga não encontrada' });

    const league = { id: doc.id, ...doc.data() };
    const [standingsSnap, roundsSnap] = await Promise.all([
      ref.collection('standings').orderBy('points', 'desc').get(),
      ref.collection('rounds').orderBy('roundNumber').get(),
    ]);
    league.standings = standingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    league.rounds = roundsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.json(league);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar liga' });
  }
});

// Criar liga (admin)
router.post(
  '/',
  requireAuth(['admin']),
  body('name').trim().notEmpty(),
  body('sport').isIn(['beach_tennis', 'futevolei', 'volei_praia']),
  body('pointsWin').optional().isInt({ min: 0 }),
  body('pointsDraw').optional().isInt({ min: 0 }),
  body('pointsLoss').optional().isInt({ min: 0 }),
  body('season').optional().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const data = {
        name: req.body.name,
        sport: req.body.sport,
        pointsWin: req.body.pointsWin ?? 3,
        pointsDraw: req.body.pointsDraw ?? 1,
        pointsLoss: req.body.pointsLoss ?? 0,
        season: req.body.season || new Date().getFullYear().toString(),
        status: 'active',
        createdAt: new Date(),
        createdBy: req.uid,
      };
      const ref = await db.collection('leagues').add(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar liga' });
    }
  }
);

// Adicionar time/equipe à liga e à tabela
router.post(
  '/:id/teams',
  requireAuth(['admin']),
  param('id').notEmpty(),
  body('teamId').notEmpty(),
  body('teamName').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('leagues').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Liga não encontrada' });

      const league = doc.data();
      const pointsWin = league.pointsWin ?? 3;
      const pointsDraw = league.pointsDraw ?? 1;
      const pointsLoss = league.pointsLoss ?? 0;

      await ref.collection('standings').doc(req.body.teamId).set({
        teamId: req.body.teamId,
        teamName: req.body.teamName,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        points: 0,
        pointsWin,
        pointsDraw,
        pointsLoss,
        updatedAt: new Date(),
      });
      res.status(201).json({ ok: true, teamId: req.body.teamId, teamName: req.body.teamName });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao adicionar time' });
    }
  }
);

// Registrar resultado de jogo (atualiza standings)
router.post(
  '/:id/results',
  requireAuth(['admin', 'instructor']),
  param('id').notEmpty(),
  body('roundNumber').isInt({ min: 1 }),
  body('team1Id').notEmpty(),
  body('team2Id').notEmpty(),
  body('team1Score').isInt({ min: 0 }),
  body('team2Score').isInt({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('leagues').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Liga não encontrada' });

      const league = doc.data();
      const pointsWin = league.pointsWin ?? 3;
      const pointsDraw = league.pointsDraw ?? 1;
      const pointsLoss = league.pointsLoss ?? 0;

      const { team1Id, team2Id, team1Score, team2Score, roundNumber } = req.body;
      let team1Points = pointsLoss;
      let team2Points = pointsLoss;
      if (team1Score > team2Score) {
        team1Points = pointsWin;
      } else if (team2Score > team1Score) {
        team2Points = pointsWin;
      } else {
        team1Points = pointsDraw;
        team2Points = pointsDraw;
      }

      const batch = db.batch();
      const s1Ref = ref.collection('standings').doc(team1Id);
      const s2Ref = ref.collection('standings').doc(team2Id);
      const [s1, s2] = await Promise.all([s1Ref.get(), s2Ref.get()]);
      if (!s1.exists || !s2.exists) return res.status(400).json({ error: 'Time não encontrado na liga' });

      const d1 = s1.data();
      const d2 = s2.data();
      const up1 = {
        played: (d1.played || 0) + 1,
        won: (d1.won || 0) + (team1Points === pointsWin ? 1 : 0),
        draw: (d1.draw || 0) + (team1Points === pointsDraw ? 1 : 0),
        lost: (d1.lost || 0) + (team1Points === pointsLoss ? 1 : 0),
        points: (d1.points || 0) + team1Points,
        updatedAt: new Date(),
      };
      const up2 = {
        played: (d2.played || 0) + 1,
        won: (d2.won || 0) + (team2Points === pointsWin ? 1 : 0),
        draw: (d2.draw || 0) + (team2Points === pointsDraw ? 1 : 0),
        lost: (d2.lost || 0) + (team2Points === pointsLoss ? 1 : 0),
        points: (d2.points || 0) + team2Points,
        updatedAt: new Date(),
      };
      batch.update(s1Ref, up1);
      batch.update(s2Ref, up2);

      const roundRef = ref.collection('rounds').doc();
      batch.set(roundRef, {
        roundNumber,
        team1Id,
        team2Id,
        team1Score,
        team2Score,
        createdAt: new Date(),
        createdBy: req.uid,
      });
      await batch.commit();

      res.status(201).json({ ok: true, roundId: roundRef.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao registrar resultado' });
    }
  }
);

export default router;
