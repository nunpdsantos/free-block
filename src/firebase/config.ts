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

// Full reset: wipe all localStorage + Firestore IndexedDB when Firestore data
// has been cleared server-side. Bump DATA_V to force all clients to reset.
const DATA_V = 'gridlock-data-v1';
if (!localStorage.getItem(DATA_V)) {
  // Preserve nothing — Firestore was wiped, local data is orphaned
  localStorage.clear();
  localStorage.setItem(DATA_V, '1');
  try {
    const dbNames = [
      'firestore/[DEFAULT]/gridlock-b2f24/main',
      'firestore/gridlock-b2f24/main',
    ];
    for (const name of dbNames) {
      try { indexedDB.deleteDatabase(name); } catch { /* ignore */ }
    }
  } catch { /* ignore in SSR or unsupported envs */ }
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
