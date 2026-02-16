import {
  collection,
  addDoc,
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

export async function submitScore(
  uid: string,
  displayName: string,
  score: number,
  mode: 'classic' | 'daily',
): Promise<void> {
  if (score <= 0 || score > 999999) return;

  await addDoc(collection(db, LEADERBOARD_COLLECTION), {
    uid,
    displayName,
    score,
    mode,
    date: new Date().toISOString().slice(0, 10),
    timestamp: serverTimestamp(),
  });
}

export function onTopScoresChanged(
  callback: (entries: GlobalLeaderboardEntry[]) => void,
): () => void {
  const q = query(
    collection(db, LEADERBOARD_COLLECTION),
    orderBy('score', 'desc'),
    limit(TOP_N),
  );

  return onSnapshot(q, (snapshot) => {
    const entries: GlobalLeaderboardEntry[] = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        uid: d.uid as string,
        displayName: d.displayName as string,
        score: d.score as number,
        mode: d.mode as 'classic' | 'daily',
        date: d.date as string,
      };
    });
    callback(entries);
  });
}
