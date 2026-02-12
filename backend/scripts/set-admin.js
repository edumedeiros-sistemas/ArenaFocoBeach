/**
 * Define um usuário como admin pelo e-mail.
 * Uso: node scripts/set-admin.js email@exemplo.com
 * (rode na pasta backend)
 */
import 'dotenv/config';
import { getAuth } from 'firebase-admin/auth';
import { db } from '../src/config/firebase.js';

const email = process.argv[2];
if (!email) {
  console.error('Uso: node scripts/set-admin.js email@exemplo.com');
  process.exit(1);
}

async function setAdmin() {
  try {
    const auth = getAuth();
    const user = await auth.getUserByEmail(email);
    const uid = user.uid;
    await db.collection('users').doc(uid).set(
      { role: 'admin', updatedAt: new Date() },
      { merge: true }
    );
    console.log(`OK: ${email} (UID: ${uid}) definido como admin.`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`Usuário com e-mail "${email}" não encontrado. Peça para a pessoa se cadastrar no app primeiro.`);
    } else {
      console.error('Erro:', err.message);
    }
    process.exit(1);
  }
  process.exit(0);
}

setAdmin();
