import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { getAuth } from 'firebase-admin/auth';
import { db } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
// Tipo de usuário (permissões no sistema) – só outro admin pode alterar
const ROLES = ['admin', 'instructor', 'student'];
// Papéis são configuráveis em /settings/papeis; aceitamos qualquer string curta

/** Converte doc do Firestore em objeto JSON-safe (Timestamps → ISO string) para evitar 500 em res.json() */
function toJSONSafe(data) {
  if (!data || typeof data !== 'object') return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v.toDate === 'function') out[k] = v.toDate().toISOString();
    else if (Array.isArray(v)) out[k] = v.map((item) => (item && typeof item === 'object' && typeof item.toDate === 'function' ? item.toDate().toISOString() : item));
    else out[k] = v;
  }
  return out;
}

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
function validateSchedule(schedule) {
  if (!Array.isArray(schedule)) return 'schedule deve ser um array';
  for (let i = 0; i < schedule.length; i++) {
    const s = schedule[i];
    if (!s || typeof s !== 'object') return `slot ${i + 1}: objeto inválido`;
    if (typeof s.dayOfWeek !== 'number' || s.dayOfWeek < 0 || s.dayOfWeek > 6) return `slot ${i + 1}: dayOfWeek deve ser 0-6`;
    if (!TIME_REGEX.test(String(s.start || ''))) return `slot ${i + 1}: start deve ser HH:mm`;
    if (!TIME_REGEX.test(String(s.end || ''))) return `slot ${i + 1}: end deve ser HH:mm`;
    if (!s.courtId || typeof s.courtId !== 'string') return `slot ${i + 1}: courtId obrigatório`;
    // professorId opcional por slot (pode ser diferente por dia)
  }
  return null;
}

// Listar usuários (admin/instrutor vê todos; filtro por role)
router.get(
  '/',
  requireAuth(['admin', 'instructor']),
  async (req, res) => {
    try {
      let q = db.collection('users').orderBy('displayName');
      if (req.query.role) q = q.where('role', '==', req.query.role);
      const snapshot = await q.limit(200).get();
      const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json(users);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  }
);

// Meu perfil
router.get('/me', requireAuth(), async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'Perfil não encontrado' });
    const data = toJSONSafe(doc.data());
    res.json({ id: doc.id, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// Atualizar meu perfil (campos permitidos; tipo de usuário não pode ser alterado por aqui). Aluno só pode ver, não editar.
router.patch(
  '/me',
  requireAuth(),
  body('displayName').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('preferredSport').optional().isIn(['beach_tennis', 'futevolei', 'volei_praia']),
  body('papel').optional().trim().isLength({ max: 50 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const ref = db.collection('users').doc(req.uid);
      const me = await ref.get();
      if (me.exists && me.data()?.role === 'student') {
        return res.status(403).json({ error: 'Alunos podem apenas visualizar o perfil. Alterações devem ser feitas por um admin ou instrutor.' });
      }
      const update = { updatedAt: new Date() };
      if (req.body.displayName !== undefined) update.displayName = req.body.displayName;
      if (req.body.phone !== undefined) update.phone = req.body.phone;
      if (req.body.preferredSport !== undefined) update.preferredSport = req.body.preferredSport;
      if (req.body.papel !== undefined) update.papel = req.body.papel;
      await ref.update(update);
      const doc = await ref.get();
      res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
  }
);

// Criar usuário aluno (admin/instrutor) - cria no Auth + perfil no Firestore
router.post(
  '/',
  requireAuth(['admin', 'instructor']),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('displayName').trim().notEmpty(),
  body('phone').optional().trim(),
  body('preferredSport').optional().isIn(['beach_tennis', 'futevolei', 'volei_praia']),
  body('role').optional().isIn(ROLES),
  body('papel').optional().trim().isLength({ max: 50 }),
  body('schedule').optional().isArray(),
  body('planId').optional().trim().notEmpty(),
  body('contractStart').optional().isISO8601(),
  body('contractEnd').optional().isISO8601(),
  body('paymentDueDay').optional().isInt({ min: 1, max: 28 }),
  body('professorId').optional().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const role = req.body.role || 'student';
    if (role === 'student' && req.body.schedule) {
      const err = validateSchedule(req.body.schedule);
      if (err) return res.status(400).json({ error: err });
    }

    try {
      if (role === 'admin' && req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Apenas admin pode criar outro admin' });
      }

      const userRecord = await getAuth().createUser({
        email: req.body.email,
        password: req.body.password,
        displayName: req.body.displayName,
      });

      const userData = {
        email: req.body.email,
        displayName: req.body.displayName,
        phone: req.body.phone || null,
        preferredSport: req.body.preferredSport || null,
        role,
        papel: req.body.papel || null,
        paymentStatus: 'pending',
        createdAt: new Date(),
        createdBy: req.uid,
      };
      if (role === 'student') {
        if (Array.isArray(req.body.schedule) && req.body.schedule.length > 0) {
          userData.schedule = req.body.schedule;
        }
        if (req.body.planId) userData.planId = req.body.planId.trim();
        if (req.body.contractStart) {
          const start = new Date(req.body.contractStart);
          userData.contractStart = start;
          userData.contractEnd = req.body.contractEnd ? new Date(req.body.contractEnd) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
        } else if (req.body.contractEnd) {
          userData.contractEnd = new Date(req.body.contractEnd);
        }
        if (req.body.paymentDueDay) userData.paymentDueDay = Number(req.body.paymentDueDay);
        if (req.body.professorId) userData.professorId = req.body.professorId.trim();
      }
      await db.collection('users').doc(userRecord.uid).set(userData);

      if (role === 'student' && req.body.planId && userData.contractStart && userData.contractEnd && req.body.paymentDueDay) {
        try {
          const planDoc = await db.collection('planos').doc(req.body.planId.trim()).get();
          const plan = planDoc.exists ? planDoc.data() : null;
          const amount = plan && typeof plan.price === 'number' ? plan.price : 0;
          const start = new Date(userData.contractStart);
          const end = new Date(userData.contractEnd);
          const dueDay = Number(req.body.paymentDueDay);
          const batch = db.batch();
          let d = new Date(start.getFullYear(), start.getMonth(), 1);
          const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
          while (d <= endMonth) {
            const day = Math.min(dueDay, 28);
            const dueDate = new Date(d.getFullYear(), d.getMonth(), day);
            const monthLabel = dueDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
            const paymentRef = db.collection('payments').doc();
            batch.set(paymentRef, {
              userId: userRecord.uid,
              type: 'mensalidade',
              amount,
              dueDate,
              description: `Mensalidade ${monthLabel}`,
              referenceId: req.body.planId.trim(),
              status: dueDate < new Date() ? 'overdue' : 'pending',
              paidAt: null,
              createdAt: new Date(),
              createdBy: req.uid,
            });
            d.setMonth(d.getMonth() + 1);
          }
          await batch.commit();
        } catch (genErr) {
          console.error('Erro ao gerar mensalidades:', genErr);
        }
      }

      res.status(201).json({
        id: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role,
        papel: req.body.papel || null,
        schedule: userData.schedule || null,
      });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }
      res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  }
);

// Atualizar usuário (admin: role, paymentStatus; instrutor limitado)
router.patch(
  '/:uid',
  requireAuth(['admin', 'instructor']),
  param('uid').notEmpty(),
  body('displayName').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('preferredSport').optional().isIn(['beach_tennis', 'futevolei', 'volei_praia']),
  body('role').optional().isIn(ROLES),
  body('papel').optional().trim().isLength({ max: 50 }),
  body('paymentStatus').optional().isIn(['pending', 'paid', 'overdue']),
  body('schedule').optional().isArray(),
  body('planId').optional().trim(),
  body('contractStart').optional().isISO8601(),
  body('contractEnd').optional().isISO8601(),
  body('paymentDueDay').optional().isInt({ min: 1, max: 28 }),
  body('professorId').optional().trim(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    if (req.body.schedule !== undefined) {
      const err = validateSchedule(req.body.schedule);
      if (err) return res.status(400).json({ error: err });
    }

    if (req.params.uid === req.uid) {
      return res.status(403).json({
        error: 'Não é permitido alterar o próprio usuário nesta tela. Use o menu Perfil para seus dados. Alteração de tipo de usuário só pode ser feita por outro administrador.',
      });
    }

    try {
      if (req.body.role === 'admin' && req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Apenas admin pode alterar role para admin' });
      }

      const ref = db.collection('users').doc(req.params.uid);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: 'Usuário não encontrado' });

      const update = { updatedAt: new Date() };
      if (req.body.displayName !== undefined) update.displayName = req.body.displayName;
      if (req.body.phone !== undefined) update.phone = req.body.phone;
      if (req.body.preferredSport !== undefined) update.preferredSport = req.body.preferredSport;
      if (req.body.role !== undefined && req.userRole === 'admin') update.role = req.body.role;
      if (req.body.papel !== undefined) update.papel = req.body.papel;
      if (req.body.paymentStatus !== undefined) update.paymentStatus = req.body.paymentStatus;
      if (req.body.schedule !== undefined) update.schedule = req.body.schedule;
      if (req.body.planId !== undefined) update.planId = req.body.planId ? req.body.planId.trim() : null;
      if (req.body.contractStart !== undefined) {
        const start = new Date(req.body.contractStart);
        update.contractStart = start;
        update.contractEnd = req.body.contractEnd ? new Date(req.body.contractEnd) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
      } else       if (req.body.contractEnd !== undefined) {
        update.contractEnd = new Date(req.body.contractEnd);
      }
      if (req.body.paymentDueDay !== undefined) update.paymentDueDay = req.body.paymentDueDay;
      if (req.body.professorId !== undefined) update.professorId = req.body.professorId ? req.body.professorId.trim() : null;
      await ref.update(update);
      const updated = await ref.get();
      res.json({ id: updated.id, ...updated.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
  }
);

export default router;
