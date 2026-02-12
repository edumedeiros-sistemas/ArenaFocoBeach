import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';

/** Normaliza a chave privada (\\n -> newline) para evitar DECODER routines::unsupported no Render */
function normalizePrivateKey(key) {
  if (!key || typeof key !== 'string') return key;
  return key.replace(/\\n/g, '\n');
}

/**
 * Em produção (ex.: Render), credenciais em env var podem corromper a chave e causar
 * "error:1E08010C:DECODER routines::unsupported". Gravar o JSON em arquivo e usar
 * GOOGLE_APPLICATION_CREDENTIALS com path evita esse caminho do OpenSSL.
 */
function setupCredentialsFile() {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let parsed;
  if (base64) {
    try {
      const json = Buffer.from(base64, 'base64').toString('utf-8');
      parsed = JSON.parse(json);
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64: Base64 ou JSON inválido');
    }
  } else if (rawJson) {
    try {
      parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch (e) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON: JSON inválido');
    }
  } else {
    return null;
  }
  if (parsed.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key);
  const dir = join(tmpdir(), 'beachflow-creds');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'serviceAccount.json');
  writeFileSync(filePath, JSON.stringify(parsed), 'utf-8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = filePath;
  return filePath;
}

const initFirebase = () => {
  if (getApps().length > 0) return getApps()[0];

  setupCredentialsFile();

  const useCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasEnvCreds =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY;

  const databaseURL = process.env.FIREBASE_DATABASE_URL || null;

  let app;
  if (useCredentials) {
    app = initializeApp({
      credential: cert(useCredentials),
      ...(databaseURL && { databaseURL }),
    });
  } else if (hasEnvCreds) {
    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
      ...(databaseURL && { databaseURL }),
    });
  } else {
    throw new Error(
      'Firebase Admin: set GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_JSON, ou FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY'
    );
  }

  return app;
};

const app = initFirebase();
export const db = getFirestore(app);
// Realtime Database só é usado se FIREBASE_DATABASE_URL estiver no .env
export const rtdb = process.env.FIREBASE_DATABASE_URL ? getDatabase(app) : null;
export const storage = getStorage(app);
export default app;
