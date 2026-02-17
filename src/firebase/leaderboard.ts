import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { GlobalLeaderboardEntry } from '../game/types';

const LEADERBOARD_COLLECTION = 'leaderboard';
const TOP_N = 20;

/**
 * Submit a score using one doc per player per mode ({uid}_{mode}).
 * Uses getDoc (reads from local cache offline) + setDoc (queues for sync offline).
 * Firestore rules enforce score > existing server-side as a safety net.
 */
export async function submitScore(
  uid: string,
  displayName: string,
  score: number,
  mode: 'classic' | 'daily',
): Promise<void> {
  const safeScore = Math.round(score);
  if (safeScore <= 0 || safeScore > 999999) return;

  const docRef = doc(db, LEADERBOARD_COLLECTION, `${uid}_${mode}`);

  // Local check — getDoc reads from persistent cache when offline
  const existing = await getDoc(docRef);
  if (existing.exists() && existing.data().score >= safeScore) {
    return; // existing score is equal or better — skip
  }

  await setDoc(docRef, {
    uid,
    displayName,
    score: safeScore,
    mode,
    date: new Date().toISOString().slice(0, 10),
    timestamp: serverTimestamp(),
  });
}

export function onTopScoresChanged(
  callback: (entries: GlobalLeaderboardEntry[]) => void,
): () => void {
  // Fetch more than TOP_N to handle legacy duplicate entries from addDoc era
  const q = query(
    collection(db, LEADERBOARD_COLLECTION),
    orderBy('score', 'desc'),
    limit(TOP_N * 3),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const seen = new Set<string>();
      const entries: GlobalLeaderboardEntry[] = [];

      for (const d of snapshot.docs) {
        const data = d.data();
        const uid = data.uid as string;
        // Deduplicate: keep only the highest score per player (docs are sorted desc)
        if (seen.has(uid)) continue;
        seen.add(uid);
        entries.push({
          uid,
          displayName: data.displayName as string,
          score: data.score as number,
          mode: data.mode as 'classic' | 'daily',
          date: data.date as string,
        });
        if (entries.length >= TOP_N) break;
      }

      callback(entries);
    },
    (error) => {
      console.error('[Gridlock] Leaderboard listener error:', error);
    },
  );
}
