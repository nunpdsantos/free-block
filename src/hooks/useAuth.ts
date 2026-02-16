import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { generateDisplayName } from '../firebase/names';

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export type AuthState = {
  user: User | null;
  displayName: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

async function ensureUserDoc(user: User): Promise<string> {
  const userRef = doc(db, 'users', user.uid);

  try {
    // Try cache first (fast path for returning users)
    const cached = await getDoc(userRef);
    if (cached.exists()) {
      return cached.data().displayName as string;
    }
  } catch {
    // Cache miss or offline — try server directly
    try {
      const server = await getDocFromServer(userRef);
      if (server.exists()) {
        return server.data().displayName as string;
      }
    } catch {
      // Both failed — fall through to create new doc
    }
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
    // Handle redirect result from mobile Google sign-in
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        const u = result.user;
        const name = u.displayName ?? generateDisplayName();
        try {
          await setDoc(doc(db, 'users', u.uid), { displayName: name }, { merge: true });
        } catch { /* Firestore write will retry when online */ }
        setDisplayName(name);
        setUser(u);
      }
    }).catch(() => { /* redirect had no result or failed — onAuthStateChanged handles it */ });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Set user + fallback name immediately so UI never blocks on Firestore
        const fallbackName = firebaseUser.displayName ?? generateDisplayName();
        setUser(firebaseUser);
        setDisplayName(fallbackName);
        setLoading(false);

        // Then try to fetch/create the Firestore display name in the background
        try {
          const name = await ensureUserDoc(firebaseUser);
          if (name !== fallbackName) setDisplayName(name);
        } catch {
          // Firestore unavailable — fallback name already set above
        }
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

    if (isMobile) {
      // Mobile: use redirect (popups are blocked on mobile browsers)
      if (user?.isAnonymous) {
        linkWithRedirect(user, provider);
      } else {
        signInWithRedirect(auth, provider);
      }
      return;
    }

    // Desktop: use popup
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
