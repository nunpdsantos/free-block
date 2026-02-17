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

// One-time cache clear: wipe ghost leaderboard entries from failed writes
// (old 'score is int' rule rejected all JS numbers — 0 docs on server)
const CACHE_V = 'gridlock-cache-v3';
if (!localStorage.getItem(CACHE_V)) {
  try {
    // Delete ALL Firestore IndexedDB databases to clear ghost entries
    // This is async but Firestore will block on opening until deletion completes
    const dbNames = [
      'firestore/[DEFAULT]/gridlock-b2f24/main',
      'firestore/gridlock-b2f24/main',
    ];
    for (const name of dbNames) {
      try { indexedDB.deleteDatabase(name); } catch { /* ignore */ }
    }
  } catch { /* ignore in SSR or unsupported envs */ }
  localStorage.removeItem('gridlock-leaderboard');
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
