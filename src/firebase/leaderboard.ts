import { auth } from './config';
import type { GlobalLeaderboardEntry, PlayerRankInfo, EntriesAroundPlayer } from '../game/types';

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
// Direct Firestore REST API — bypasses SDK persistent cache entirely.
// Gives immediate success/failure, no ghost entries, no stuck pending writes.
// ---------------------------------------------------------------------------

/** Read the current server score for a uid+mode via REST GET. */
async function readScoreREST(
  uid: string,
  mode: 'classic' | 'daily',
): Promise<number | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const idToken = await user.getIdToken();
  const docId = `${uid}_${mode}`;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${LEADERBOARD_COLLECTION}/${docId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${idToken}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) return null;

  const doc = await response.json();
  const scoreField = doc?.fields?.score;
  if (scoreField?.integerValue) return Number(scoreField.integerValue);
  if (scoreField?.doubleValue) return Number(scoreField.doubleValue);
  return null;
}

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
    const status = response.status;

    // 403 = security rules rejected — most likely the server already has a
    // higher score (update rule: new > old). Read the actual server score
    // and sync our localStorage best so we stop retrying.
    if (status === 403) {
      const serverScore = await readScoreREST(uid, mode).catch(() => null);
      if (serverScore != null && serverScore >= score) {
        setBestSubmitted(uid, mode, serverScore);
        console.log(`[Gridlock] Server already has score ${serverScore} ≥ ${score} — synced localStorage`);
        return; // Not a real failure — just stale local tracking
      }
    }

    const errorText = await response.text().catch(() => '');
    throw new Error(`Firestore REST ${status}: ${errorText}`);
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

  // Don't clear the pending list upfront — only write back what failed.
  // Clearing early means a tab-close mid-loop would silently lose scores.
  const stillPending: PendingScore[] = [];
  for (const entry of pending) {
    try {
      await submitScore(entry.uid, entry.displayName, entry.score, entry.mode);
    } catch {
      stillPending.push(entry);
    }
  }
  setPending(stillPending);
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
 * Fetch top scores from Firestore via REST API, filtered by game mode.
 * Bypasses the SDK persistent cache entirely — direct server query.
 *
 * NOTE: requires a composite Firestore index on (mode ASC, score DESC).
 */
export async function fetchTopScores(
  mode: 'classic' | 'daily',
): Promise<GlobalLeaderboardEntry[]> {
  const body = {
    structuredQuery: {
      from: [{ collectionId: LEADERBOARD_COLLECTION }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'mode' },
          op: 'EQUAL',
          value: { stringValue: mode },
        },
      },
      orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
      limit: TOP_N,
    },
  };

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Firestore query failed: ${response.status}`);
  }

  const results = await response.json() as Array<{ document?: { fields: Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number }> } }>;
  const entries: GlobalLeaderboardEntry[] = [];

  for (const result of results) {
    const fields = result.document?.fields;
    if (!fields) continue;
    const score = fields.score?.integerValue
      ? Number(fields.score.integerValue)
      : fields.score?.doubleValue ?? 0;
    entries.push({
      uid: fields.uid?.stringValue ?? '',
      displayName: fields.displayName?.stringValue ?? 'Unknown',
      score,
      mode: (fields.mode?.stringValue as 'classic' | 'daily') ?? mode,
      date: fields.date?.stringValue ?? '',
    });
  }

  return entries;
}

/**
 * Fetch the current player's rank and score for a given mode.
 * Uses a public doc read + count aggregation query (no auth needed).
 * Returns null if the player has no submitted score for this mode.
 */
export async function fetchPlayerRank(
  uid: string,
  mode: 'classic' | 'daily',
): Promise<PlayerRankInfo | null> {
  const docId = `${uid}_${mode}`;
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${LEADERBOARD_COLLECTION}/${docId}`;

  const docResponse = await fetch(docUrl);
  if (!docResponse.ok) return null;

  const doc = await docResponse.json();
  const fields = doc?.fields;
  if (!fields) return null;

  const score = fields.score?.integerValue
    ? Number(fields.score.integerValue)
    : fields.score?.doubleValue ?? 0;
  const displayName = fields.displayName?.stringValue ?? 'Unknown';

  if (score <= 0) return null;

  // Count players with a strictly higher score in the same mode
  const countUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runAggregationQuery`;
  const countBody = {
    structuredAggregationQuery: {
      structuredQuery: {
        from: [{ collectionId: LEADERBOARD_COLLECTION }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'mode' },
                  op: 'EQUAL',
                  value: { stringValue: mode },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'score' },
                  op: 'GREATER_THAN',
                  value: { integerValue: String(score) },
                },
              },
            ],
          },
        },
      },
      aggregations: [{ count: {}, alias: 'count' }],
    },
  };

  const countResponse = await fetch(countUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(countBody),
  });

  let rank = -1;
  if (countResponse.ok) {
    const countResult = await countResponse.json();
    const countValue = countResult?.[0]?.result?.aggregateFields?.count?.integerValue;
    if (countValue != null) rank = Number(countValue) + 1;
  }

  return { rank, score, displayName };
}

/**
 * Fetch up to 2 entries immediately above and 2 immediately below the given score.
 * Uses GREATER_THAN/LESS_THAN with ordering to get closest neighbours only.
 * No auth required — public query.
 */
export async function fetchEntriesAroundScore(
  score: number,
  mode: 'classic' | 'daily',
): Promise<EntriesAroundPlayer> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

  type RawResult = Array<{ document?: { fields: Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number }> } }>;

  const makeBody = (op: 'GREATER_THAN' | 'LESS_THAN', direction: 'DESCENDING' | 'ASCENDING', limit: number) => ({
    structuredQuery: {
      from: [{ collectionId: LEADERBOARD_COLLECTION }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'mode' }, op: 'EQUAL', value: { stringValue: mode } } },
            { fieldFilter: { field: { fieldPath: 'score' }, op, value: { integerValue: String(score) } } },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'score' }, direction }],
      limit,
    },
  });

  const parseEntries = (results: RawResult): GlobalLeaderboardEntry[] => {
    const entries: GlobalLeaderboardEntry[] = [];
    for (const result of results) {
      const fields = result.document?.fields;
      if (!fields) continue;
      const s = fields.score?.integerValue ? Number(fields.score.integerValue) : fields.score?.doubleValue ?? 0;
      entries.push({
        uid: fields.uid?.stringValue ?? '',
        displayName: fields.displayName?.stringValue ?? 'Unknown',
        score: s,
        mode: (fields.mode?.stringValue as 'classic' | 'daily') ?? mode,
        date: fields.date?.stringValue ?? '',
      });
    }
    return entries;
  };

  const [aboveRes, belowRes] = await Promise.all([
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makeBody('GREATER_THAN', 'ASCENDING', 2)) }),
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(makeBody('LESS_THAN', 'DESCENDING', 2)) }),
  ]);

  if (!aboveRes.ok || !belowRes.ok) {
    throw new Error(`fetchEntriesAroundScore failed: ${aboveRes.status}/${belowRes.status}`);
  }

  const [aboveRaw, belowRaw]: [RawResult, RawResult] = await Promise.all([aboveRes.json(), belowRes.json()]);

  // "above" returns lowest-above first (ASCENDING); reverse to get highest-above first for display
  const above = parseEntries(aboveRaw).reverse();
  const below = parseEntries(belowRaw);

  return { above, below };
}
