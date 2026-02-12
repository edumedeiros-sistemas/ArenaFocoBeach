import { getAuth } from 'firebase-admin/auth';
import { db } from '../config/firebase.js';

/**
 * Valida o token Firebase Id Token do header Authorization e anexa decodedToken + uid na req.
 * Opcionalmente exige um dos roles: admin, instructor, student.
 */
export const requireAuth = (allowedRoles = []) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    const token = authHeader.slice(7);
    try {
      const decoded = await getAuth().verifyIdToken(token);
      req.uid = decoded.uid;
      req.decodedToken = decoded;

      if (allowedRoles.length === 0) return next();

      const userDoc = await db.collection('users').doc(decoded.uid).get();
      const role = userDoc.exists ? userDoc.data()?.role : null;
      if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({ error: 'Acesso negado para este recurso' });
      }
      req.userRole = role;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
  };
};
