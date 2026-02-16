import {
  collection,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { GlobalLeaderboardEntry } from '../game/types';

const LEADERBOARD_COLLECTION = 'leaderboard';
const TOP_N = 20;

/**
 * Submit a score using one doc per player per mode ({uid}_{mode}).
 * Only writes if the new score beats the existing personal best.
 */
export async function submitScore(
  uid: string,
  displayName: string,
  score: number,
  mode: 'classic' | 'daily',
): Promise<void> {
  if (score <= 0 || score > 999999) return;

  const docRef = doc(db, LEADERBOARD_COLLECTION, `${uid}_${mode}`);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(docRef);
    if (existing.exists() && existing.data().score >= score) {
      return; // existing score is equal or better — skip
    }
    tx.set(docRef, {
      uid,
      displayName,
      score,
      mode,
      date: new Date().toISOString().slice(0, 10),
      timestamp: serverTimestamp(),
    });
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

  return onSnapshot(q, (snapshot) => {
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
  });
}
