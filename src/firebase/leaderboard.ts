import {
  collection,
  doc,
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

// ---------------------------------------------------------------------------
// localStorage-based tracking — avoids Firestore cache ghost entries entirely
// ---------------------------------------------------------------------------

const BEST_KEY = 'gridlock-best-global';
const PENDING_KEY = 'gridlock-pending-scores';

type PendingScore = {
  uid: string;
  displayName: string;
  score: number;
  mode: 'classic' | 'daily';
};

function getBestSubmitted(uid: string, mode: string): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return 0;
    return (JSON.parse(raw) as Record<string, number>)[`${uid}_${mode}`] ?? 0;
  } catch {
    return 0;
  }
}

function setBestSubmitted(uid: string, mode: string, score: number): void {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const data: Record<string, number> = raw ? JSON.parse(raw) : {};
    data[`${uid}_${mode}`] = score;
    localStorage.setItem(BEST_KEY, JSON.stringify(data));
  } catch { /* quota */ }
}

function getPending(): PendingScore[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setPending(entries: PendingScore[]): void {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(PENDING_KEY);
    } else {
      localStorage.setItem(PENDING_KEY, JSON.stringify(entries));
    }
  } catch { /* quota */ }
}

// ---------------------------------------------------------------------------
// Core write — always writes to Firestore, no getDoc pre-check.
// Firestore rules enforce score > existing server-side.
// With persistentLocalCache, setDoc writes locally + queues for server sync.
// ---------------------------------------------------------------------------

async function writeScore(
  uid: string,
  displayName: string,
  score: number,
  mode: 'classic' | 'daily',
): Promise<void> {
  const docRef = doc(db, LEADERBOARD_COLLECTION, `${uid}_${mode}`);
  await setDoc(docRef, {
    uid,
    displayName,
    score,
    mode,
    date: new Date().toISOString().slice(0, 10),
    timestamp: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a score. Uses localStorage to skip if we've already submitted a
 * higher score (no Firestore cache dependency). If the write fails, the
 * score is queued in localStorage for retry on next app load.
 */
export async function submitScore(
  uid: string,
  displayName: string,
  score: number,
  mode: 'classic' | 'daily',
): Promise<void> {
  const safeScore = Math.round(score);
  if (safeScore <= 0 || safeScore > 999999) return;

  const best = getBestSubmitted(uid, mode);
  if (safeScore <= best) {
    console.log(`[Gridlock] Score ${safeScore} ≤ best submitted ${best} — skipping`);
    return;
  }

  try {
    await writeScore(uid, displayName, safeScore, mode);
    setBestSubmitted(uid, mode, safeScore);
    console.log(`[Gridlock] Score ${safeScore} submitted for ${displayName}`);
  } catch (err) {
    console.error('[Gridlock] Score submit failed, queuing for retry:', err);
    const pending = getPending();
    pending.push({ uid, displayName, score: safeScore, mode });
    setPending(pending);
  }
}

/**
 * Retry any pending score submissions that failed previously.
 * Call on app load after auth is ready.
 */
export async function retryPendingScores(): Promise<void> {
  const pending = getPending();
  if (pending.length === 0) return;

  console.log(`[Gridlock] Retrying ${pending.length} pending score(s)`);
  // Clear queue first to avoid infinite retry loops if we crash mid-retry
  setPending([]);

  const stillPending: PendingScore[] = [];
  for (const entry of pending) {
    try {
      await submitScore(entry.uid, entry.displayName, entry.score, entry.mode);
    } catch {
      stillPending.push(entry);
    }
  }
  if (stillPending.length > 0) {
    setPending(stillPending);
  }
}

/**
 * Ensure the local best score is submitted to Firestore.
 * Catches the case where a score was saved locally but the global submit
 * was lost (migration, app crash, old code, etc.).
 */
export async function syncLocalBest(
  uid: string,
  displayName: string,
  localBestScore: number,
  mode: 'classic' | 'daily',
): Promise<void> {
  if (localBestScore <= 0) return;
  // submitScore internally skips if already submitted a higher score
  await submitScore(uid, displayName, localBestScore, mode);
}

/**
 * Real-time listener for top scores from Firestore.
 */
export function onTopScoresChanged(
  callback: (entries: GlobalLeaderboardEntry[]) => void,
): () => void {
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
