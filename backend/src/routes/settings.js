import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const SETTINGS_PAPEIS = 'settings/papeis';

const defaultPapeis = [
  { id: 'professor', label: 'Professor' },
  { id: 'aluno', label: 'Aluno' },
  { id: 'gerente', label: 'Gerente' },
  { id: 'recepcionista', label: 'Recepcionista' },
  { id: 'outro', label: 'Outro' },
];

// Listar papéis configurados (qualquer autenticado pode ler)
router.get('/papeis', requireAuth(), async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('papeis').get();
    const items = doc.exists && doc.data()?.items?.length ? doc.data().items : defaultPapeis;
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar papéis' });
  }
});

// Atualizar lista de papéis (só admin)
router.put(
  '/papeis',
  requireAuth(['admin']),
  body('items').isArray(),
  body('items.*.id').trim().notEmpty(),
  body('items.*.label').trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const items = req.body.items.map((p) => ({ id: String(p.id).toLowerCase().replace(/\s+/g, '_'), label: p.label.trim() }));
      await db.collection('settings').doc('papeis').set({
        items,
        updatedAt: new Date(),
        updatedBy: req.uid,
      });
      res.json({ items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao salvar papéis' });
    }
  }
);

// --- Planos de aula (dias na semana + valor) - só admin cadastra/edita ---

// Listar planos (qualquer autenticado pode ler)
router.get('/planos', requireAuth(), async (req, res) => {
  try {
    const snapshot = await db.collection('planos').orderBy('daysPerWeek', 'asc').get();
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar planos' });
  }
});

// Criar plano (admin)
router.post(
  '/planos',
  requireAuth(['admin']),
  body('name').trim().notEmpty(),
  body('daysPerWeek').isInt({ min: 1, max: 7 }),
  body('price').isFloat({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const price = Number(parseFloat(req.body.price).toFixed(2));
      const name = String(req.body.name).trim();
      const ref = await db.collection('planos').add({
        name,
        daysPerWeek: Number(req.body.daysPerWeek),
        price,
        createdAt: new Date(),
        createdBy: req.uid,
      });
      res.status(201).json({ id: ref.id, name, daysPerWeek: Number(req.body.daysPerWeek), price });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao criar plano' });
    }
  }
);

// Atualizar plano (admin)
router.put(
  '/planos/:id',
  requireAuth(['admin']),
  param('id').notEmpty(),
  body('name').trim().notEmpty(),
  body('daysPerWeek').isInt({ min: 1, max: 7 }),
  body('price').isFloat({ min: 0 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('planos').doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Plano não encontrado' });

      const price = Number(parseFloat(req.body.price).toFixed(2));
      const name = String(req.body.name).trim();
      await ref.update({
        name,
        daysPerWeek: Number(req.body.daysPerWeek),
        price,
        updatedAt: new Date(),
        updatedBy: req.uid,
      });
      res.json({ id: req.params.id, name, daysPerWeek: Number(req.body.daysPerWeek), price });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar plano' });
    }
  }
);

// Excluir plano (admin)
router.delete('/planos/:id', requireAuth(['admin']), param('id').notEmpty(), async (req, res) => {
  try {
    const ref = db.collection('planos').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plano não encontrado' });
    await ref.delete();
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir plano' });
  }
});

export default router;
