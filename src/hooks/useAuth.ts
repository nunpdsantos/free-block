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

const NAME_CACHE_KEY = 'gridlock-display-name';

function getCachedName(uid: string): string | null {
  try {
    const raw = localStorage.getItem(NAME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.uid === uid ? parsed.name : null;
  } catch { return null; }
}

function setCachedName(uid: string, name: string): void {
  try { localStorage.setItem(NAME_CACHE_KEY, JSON.stringify({ uid, name })); } catch { /* quota */ }
}

export type AuthState = {
  user: User | null;
  displayName: string | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
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
  await setDoc(userRef, { displayName: name }, { merge: true });
  return name;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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
        setCachedName(u.uid, name);
        setUser(u);
      }
    }).catch(() => { /* redirect had no result or failed — onAuthStateChanged handles it */ });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Use cached name → Firebase Auth displayName → generate new (in that order)
        const cached = getCachedName(firebaseUser.uid);
        const fallbackName = cached ?? firebaseUser.displayName ?? generateDisplayName();
        setUser(firebaseUser);
        setDisplayName(fallbackName);
        setLoading(false);

        // Cache immediately so even first-session name survives a quick reload
        setCachedName(firebaseUser.uid, fallbackName);

        // Then try to fetch/create the Firestore display name in the background
        try {
          const name = await ensureUserDoc(firebaseUser);
          if (name !== fallbackName) {
            setDisplayName(name);
            setCachedName(firebaseUser.uid, name);
          }
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
    setAuthError(null);
    const provider = new GoogleAuthProvider();

    const finishSignIn = async (u: User) => {
      const name = u.displayName ?? displayName ?? generateDisplayName();
      await setDoc(doc(db, 'users', u.uid), { displayName: name }, { merge: true });
      setDisplayName(name);
      setCachedName(u.uid, name);
      setUser(u);
    };

    const tryPopup = async () => {
      if (user?.isAnonymous) {
        try {
          const result = await linkWithPopup(user, provider);
          await finishSignIn(result.user);
          return;
        } catch (linkErr: unknown) {
          const linkCode = (linkErr as { code?: string }).code;
          if (linkCode === 'auth/credential-already-in-use') {
            // Google account already linked to another UID — sign in as that user
            console.log('[Gridlock] Credential in use, signing in as existing Google user');
            const result = await signInWithPopup(auth, provider);
            await finishSignIn(result.user);
            return;
          }
          throw linkErr; // re-throw other errors
        }
      }
      const result = await signInWithPopup(auth, provider);
      await finishSignIn(result.user);
    };

    if (isMobile) {
      // On mobile, try link first; if credential is already in use, use regular sign-in
      if (user?.isAnonymous) {
        try {
          await linkWithPopup(user, provider);
          // If popup works on this mobile browser, great
          return;
        } catch (linkErr: unknown) {
          const linkCode = (linkErr as { code?: string }).code;
          if (linkCode === 'auth/credential-already-in-use') {
            signInWithRedirect(auth, provider);
            return;
          }
          // Popup likely blocked on mobile — fall back to redirect
          if (linkCode === 'auth/popup-blocked' || linkCode === 'auth/popup-closed-by-user' || linkCode === 'auth/cancelled-popup-request') {
            linkWithRedirect(user, provider);
            return;
          }
          setAuthError(`Sign-in failed: ${linkCode}`);
        }
      } else {
        signInWithRedirect(auth, provider);
      }
      return;
    }

    try {
      await tryPopup();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? 'unknown';
      const message = (err as { message?: string }).message ?? String(err);
      console.error('[Gridlock] Google sign-in failed:', code, message);

      // Popup blocked or closed — fall back to redirect
      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        if (user?.isAnonymous) {
          linkWithRedirect(user, provider);
        } else {
          signInWithRedirect(auth, provider);
        }
        return;
      }

      setAuthError(`Sign-in failed: ${code}`);
    }
  }, [user, displayName]);

  const updateDisplayName = useCallback(async (name: string) => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
    setCachedName(user.uid, trimmed);
    try {
      await setDoc(doc(db, 'users', user.uid), { displayName: trimmed }, { merge: true });
    } catch {
      // Firestore write will retry when online
    }
  }, [user]);

  const handleSignOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // onAuthStateChanged will fire → auto-creates a new anonymous account
  }, []);

  return { user, displayName, loading, authError, signInWithGoogle, signOut: handleSignOut, updateDisplayName };
}
