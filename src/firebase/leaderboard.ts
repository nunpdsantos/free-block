import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from './config';
import type { GlobalLeaderboardEntry } from '../game/types';

const LEADERBOARD_COLLECTION = 'leaderboard';
const TOP_N = 20;
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string;

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
// Direct Firestore REST API write — bypasses SDK persistent cache entirely.
// Gives immediate success/failure, no ghost entries, no stuck pending writes.
// ---------------------------------------------------------------------------

async function writeScoreREST(
  uid: string,
  displayName: string,
  score: number,
  mode: 'classic' | 'daily',
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const idToken = await user.getIdToken();
  const docId = `${uid}_${mode}`;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${LEADERBOARD_COLLECTION}/${docId}`;

  const body = {
    fields: {
      uid: { stringValue: uid },
      displayName: { stringValue: displayName },
      score: { integerValue: String(score) },
      mode: { stringValue: mode },
      date: { stringValue: new Date().toISOString().slice(0, 10) },
      timestamp: { timestampValue: new Date().toISOString() },
    },
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Firestore REST ${response.status}: ${errorText}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit a score via direct REST API call (bypasses SDK cache).
 * Uses localStorage to skip if we've already submitted a higher score.
 * If the write fails, the score is queued in localStorage for retry.
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
    await writeScoreREST(uid, displayName, safeScore, mode);
    setBestSubmitted(uid, mode, safeScore);
    console.log(`[Gridlock] Score ${safeScore} submitted for ${displayName} ✓`);
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
  await submitScore(uid, displayName, localBestScore, mode);
}

/**
 * Real-time listener for top scores from Firestore.
 * Uses SDK onSnapshot (reads benefit from cache for offline support).
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
