import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Listar campeonatos
router.get('/', requireAuth(), async (req, res) => {
  try {
    const snapshot = await db.collection('championships').orderBy('startDate', 'desc').limit(50).get();
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar campeonatos' });
  }
});

// Detalhes + grupos + partidas
router.get('/:id', requireAuth(), param('id').notEmpty(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const ref = db.collection('championships').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Campeonato não encontrado' });

    const champ = { id: doc.id, ...doc.data() };
    const [groupsSnap, matchesSnap] = await Promise.all([
      ref.collection('groups').get(),
      ref.collection('matches').orderBy('round').orderBy('order').get(),
    ]);
    champ.groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    champ.matches = matchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    res.json(champ);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar campeonato' });
  }
});

// Criar campeonato (admin)
router.post(
  '/',
  requireAuth(['admin']),
  body('name').trim().notEmpty(),
  body('sport').isIn(['beach_tennis', 'futevolei', 'volei_praia']),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('format').isIn(['duplas', 'singles', 'mistos']),
  body('numGroups').optional().isInt({ min: 1, max: 32 }),
  body('phases').optional().isArray(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const data = {
        name: req.body.name,
        sport: req.body.sport,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        format: req.body.format,
        numGroups: req.body.numGroups || 1,
        phases: req.body.phases || ['groups', 'knockout', 'semifinal', 'final'],
        status: 'draft',
        createdAt: new Date(),
        createdBy: req.uid,
      };
      const ref = await db.collection('championships').add(data);
      res.status(201).json({ id: ref.id, ...data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar campeonato' });
    }
  }
);

// Gerar chaves (grupos + partidas iniciais)
router.post(
  '/:id/generate-bracket',
  requireAuth(['admin']),
  param('id').notEmpty(),
  body('teams').isArray({ min: 2 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('championships').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Campeonato não encontrado' });

      const teams = req.body.teams; // array de { id, name } ou ids
      const numGroups = doc.data().numGroups || 1;

      // Shuffle e distribuir em grupos
      const shuffled = [...teams].sort(() => Math.random() - 0.5);
      const perGroup = Math.ceil(shuffled.length / numGroups);
      const batch = db.batch();

      for (let g = 0; g < numGroups; g++) {
        const groupTeams = shuffled.slice(g * perGroup, (g + 1) * perGroup);
        const groupRef = ref.collection('groups').doc(`group_${g + 1}`);
        batch.set(groupRef, {
          name: `Grupo ${g + 1}`,
          order: g + 1,
          teamIds: groupTeams.map((t) => (typeof t === 'object' && t.id ? t.id : t)),
          teamNames: groupTeams.map((t) => (typeof t === 'object' && t.name ? t.name : String(t))),
        });
      }
      await batch.commit();

      // Partidas mata-mata simples (ex: 4 primeiros colocados -> semi, final)
      const round1Matches = [
        { round: 1, order: 1, team1Id: null, team2Id: null, winnerId: null, score: null },
        { round: 1, order: 2, team1Id: null, team2Id: null, winnerId: null, score: null },
      ];
      const matchRef1 = ref.collection('matches').doc();
      const matchRef2 = ref.collection('matches').doc();
      batch.set(matchRef1, { ...round1Matches[0], createdAt: new Date() });
      batch.set(matchRef2, { ...round1Matches[1], createdAt: new Date() });
      const finalRef = ref.collection('matches').doc();
      batch.set(finalRef, {
        round: 2,
        order: 1,
        team1Id: null,
        team2Id: null,
        winnerId: null,
        score: null,
        createdAt: new Date(),
      });
      await batch.commit();

      res.json({ ok: true, groups: numGroups, matchesCreated: 3 });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao gerar chaves' });
    }
  }
);

// Registrar resultado de partida
router.patch(
  '/:id/matches/:matchId',
  requireAuth(['admin', 'instructor']),
  param('id').notEmpty(),
  param('matchId').notEmpty(),
  body('team1Score').optional().isInt({ min: 0 }),
  body('team2Score').optional().isInt({ min: 0 }),
  body('winnerId').optional().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const matchRef = db
        .collection('championships')
        .doc(req.params.id)
        .collection('matches')
        .doc(req.params.matchId);
      const matchDoc = await matchRef.get();
      if (!matchDoc.exists) return res.status(404).json({ error: 'Partida não encontrada' });

      const update = { updatedAt: new Date() };
      if (req.body.team1Score !== undefined) update.team1Score = req.body.team1Score;
      if (req.body.team2Score !== undefined) update.team2Score = req.body.team2Score;
      if (req.body.winnerId) update.winnerId = req.body.winnerId;
      await matchRef.update(update);
      res.json({ ok: true, matchId: req.params.matchId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar partida' });
    }
  }
);

// Inscrição em campeonato
router.post(
  '/:id/register',
  requireAuth(),
  param('id').notEmpty(),
  body('teamName').optional().trim().notEmpty(),
  body('playerIds').isArray({ min: 1 }),
  body('feePaid').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('championships').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Campeonato não encontrado' });

      const regRef = await ref.collection('registrations').add({
        teamName: req.body.teamName || 'Equipe',
        playerIds: req.body.playerIds,
        registeredBy: req.uid,
        registeredAt: new Date(),
        feePaid: req.body.feePaid || false,
      });
      res.status(201).json({ id: regRef.id, ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao inscrever' });
    }
  }
);

export default router;
