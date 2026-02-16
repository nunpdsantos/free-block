import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { generateDisplayName } from '../firebase/names';

export type AuthState = {
  user: User | null;
  displayName: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

async function ensureUserDoc(user: User): Promise<string> {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data().displayName as string;
  }

  // New user — generate a name and create doc
  const name = user.displayName ?? generateDisplayName();
  await setDoc(userRef, { displayName: name });
  return name;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const name = await ensureUserDoc(firebaseUser);
        setDisplayName(name);
        setLoading(false);
      } else {
        // No user — auto sign in anonymously
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the anonymous user
        } catch {
          setLoading(false);
        }
      }
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();

    if (user?.isAnonymous) {
      // Link anonymous account to Google — preserves UID and scores
      try {
        const result = await linkWithPopup(user, provider);
        const linked = result.user;
        const name = linked.displayName ?? displayName ?? generateDisplayName();
        await setDoc(doc(db, 'users', linked.uid), { displayName: name });
        setDisplayName(name);
        setUser(linked);
        return;
      } catch (err: unknown) {
        // If linking fails (e.g. Google account already used), fall back to regular sign-in
        if ((err as { code?: string }).code !== 'auth/credential-already-in-use') {
          throw err;
        }
      }
    }

    // Regular Google sign-in (non-anonymous or link failed)
    const result = await signInWithPopup(auth, provider);
    const googleUser = result.user;
    const name = googleUser.displayName ?? generateDisplayName();
    await setDoc(doc(db, 'users', googleUser.uid), { displayName: name }, { merge: true });
    setDisplayName(name);
    setUser(googleUser);
  }, [user, displayName]);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // onAuthStateChanged will fire → auto-creates a new anonymous account
  }, []);

  return { user, displayName, loading, signInWithGoogle, signOut: handleSignOut };
}
