import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// One-time Firestore cache clear: wipe stale IndexedDB so the SDK re-fetches
// from server. Bump version when query shape changes (e.g. new composite index).
// NOTE: only clears Firestore IndexedDB — local leaderboard (localStorage) is preserved.
const CACHE_V = 'gridlock-cache-v4';
if (!localStorage.getItem(CACHE_V)) {
  try {
    const dbNames = [
      'firestore/[DEFAULT]/gridlock-b2f24/main',
      'firestore/gridlock-b2f24/main',
    ];
    for (const name of dbNames) {
      try { indexedDB.deleteDatabase(name); } catch { /* ignore */ }
    }
  } catch { /* ignore in SSR or unsupported envs */ }
  localStorage.setItem(CACHE_V, '1');
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Offline persistence for PWA support via non-deprecated API
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(undefined),
  }),
});

// Emulator support for local dev
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
}
