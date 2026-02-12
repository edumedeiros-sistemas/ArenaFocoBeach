import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';

const initFirebase = () => {
  if (getApps().length > 0) return getApps()[0];

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
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      ...(databaseURL && { databaseURL }),
    });
  } else {
    throw new Error(
      'Firebase Admin: set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
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
