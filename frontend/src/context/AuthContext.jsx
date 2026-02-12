import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  getIdToken,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import { apiGet } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const token = await getIdToken(fbUser);
        window.localStorage.setItem('beach_flow_token', token);
        setUser(fbUser);
        const profileSnap = await getDoc(doc(db, 'users', fbUser.uid));
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setProfile({ id: profileSnap.id, ...data });
        } else {
          await setDoc(doc(db, 'users', fbUser.uid), {
            email: fbUser.email || null,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Usuário',
            phone: null,
            preferredSport: null,
            role: 'student',
            paymentStatus: 'pending',
            createdAt: serverTimestamp(),
          });
          setProfile({ id: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName, role: 'student', paymentStatus: 'pending' });
        }
      } catch (err) {
        console.error('Auth error:', err);
        try {
          const me = await apiGet('/users/me');
          setProfile(me && typeof me === 'object' ? { ...me } : null);
        } catch (_) {
          setProfile({ id: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName, role: 'student' });
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || profile || !window.localStorage.getItem('beach_flow_token')) return;
    apiGet('/users/me')
      .then((me) => me && typeof me === 'object' && setProfile({ ...me }))
      .catch(() => {});
  }, [user, profile]);

  const signIn = (email, password) => (auth ? signInWithEmailAndPassword(auth, email, password) : Promise.reject(new Error('Firebase não configurado')));
  const register = (email, password) => (auth ? createUserWithEmailAndPassword(auth, email, password) : Promise.reject(new Error('Firebase não configurado')));
  const signInWithGoogle = () => (auth && googleProvider ? signInWithPopup(auth, googleProvider) : Promise.reject(new Error('Firebase não configurado')));
  const signOut = () => {
    window.localStorage.removeItem('beach_flow_token');
    return auth ? fbSignOut(auth) : Promise.resolve();
  };

  const refreshToken = async () => {
    if (auth?.currentUser) {
      const token = await getIdToken(auth.currentUser, true);
      window.localStorage.setItem('beach_flow_token', token);
      return token;
    }
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    register,
    signInWithGoogle,
    signOut,
    refreshToken,
    isAdmin: profile?.role === 'admin',
    isInstructor: profile?.role === 'instructor' || profile?.role === 'admin',
    isStudent: profile?.role === 'student',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
