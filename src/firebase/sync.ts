import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './config';
import type { PlayerStats, AchievementProgress, DailyStreak, DailyResult } from '../game/types';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncedPlayerData = {
  stats: PlayerStats;
  achievements: AchievementProgress;
  dailyStreak: DailyStreak;
  dailyResults: Record<string, DailyResult>;
  syncedAt: number;
};

// ---------------------------------------------------------------------------
// Merge functions — always pick the "higher" value so no data is lost
// ---------------------------------------------------------------------------

export function mergeStats(local: PlayerStats, remote: PlayerStats): PlayerStats {
  return {
    gamesPlayed: Math.max(local.gamesPlayed, remote.gamesPlayed),
    totalScore: Math.max(local.totalScore, remote.totalScore),
    totalLinesCleared: Math.max(local.totalLinesCleared, remote.totalLinesCleared),
    totalPiecesPlaced: Math.max(local.totalPiecesPlaced, remote.totalPiecesPlaced),
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
    allClearCount: Math.max(local.allClearCount, remote.allClearCount),
    totalRevivesUsed: Math.max(local.totalRevivesUsed, remote.totalRevivesUsed),
    highestScoreWithoutRevive: Math.max(local.highestScoreWithoutRevive, remote.highestScoreWithoutRevive),
  };
}

export function mergeAchievements(
  local: AchievementProgress,
  remote: AchievementProgress,
): AchievementProgress {
  const merged: AchievementProgress = { ...local };
  for (const [id, ts] of Object.entries(remote)) {
    // Keep earliest unlock timestamp
    if (!(id in merged) || ts < merged[id]) {
      merged[id] = ts;
    }
  }
  return merged;
}

export function mergeDailyStreak(local: DailyStreak, remote: DailyStreak): DailyStreak {
  // Pick the record with the more recent lastPlayedDate as the source of truth
  // for currentStreak, then take max of bestStreak
  let base: DailyStreak;
  if (!local.lastPlayedDate && !remote.lastPlayedDate) {
    base = local;
  } else if (!local.lastPlayedDate) {
    base = remote;
  } else if (!remote.lastPlayedDate) {
    base = local;
  } else if (local.lastPlayedDate > remote.lastPlayedDate) {
    base = local;
  } else if (remote.lastPlayedDate > local.lastPlayedDate) {
    base = remote;
  } else {
    // Same date — pick higher current streak
    base = local.currentStreak >= remote.currentStreak ? local : remote;
  }

  return {
    currentStreak: base.currentStreak,
    bestStreak: Math.max(local.bestStreak, remote.bestStreak),
    lastPlayedDate: base.lastPlayedDate,
  };
}

export function mergeDailyResults(
  local: Record<string, DailyResult>,
  remote: Record<string, DailyResult>,
): Record<string, DailyResult> {
  const merged: Record<string, DailyResult> = { ...local };
  for (const [date, result] of Object.entries(remote)) {
    if (!(date in merged) || result.score > merged[date].score) {
      merged[date] = result;
    }
  }
  return merged;
}

export function mergePlayerData(
  local: SyncedPlayerData,
  remote: SyncedPlayerData,
): SyncedPlayerData {
  return {
    stats: mergeStats(local.stats, remote.stats),
    achievements: mergeAchievements(local.achievements, remote.achievements),
    dailyStreak: mergeDailyStreak(local.dailyStreak, remote.dailyStreak),
    dailyResults: mergeDailyResults(local.dailyResults, remote.dailyResults),
    syncedAt: Math.max(local.syncedAt, remote.syncedAt),
  };
}

// ---------------------------------------------------------------------------
// Firestore I/O — reads use REST API to bypass SDK persistent cache
// (SDK getDoc returns stale cached data; same class of bug as leaderboard)
// ---------------------------------------------------------------------------

function parseFirestoreValue(val: Record<string, unknown>): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('mapValue' in val) {
    const fields = (val.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields;
    if (!fields) return {};
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = parseFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

export async function fetchPlayerData(uid: string): Promise<SyncedPlayerData | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const idToken = await user.getIdToken();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${idToken}` },
    });

    if (!response.ok) return null;

    const doc = await response.json();
    const fields = doc?.fields;
    if (!fields?.stats) return null; // Doc exists but has no sync data yet

    const stats = parseFirestoreValue(fields.stats) as PlayerStats;
    const achievements = fields.achievements
      ? parseFirestoreValue(fields.achievements) as AchievementProgress
      : {};
    const dailyStreak = fields.dailyStreak
      ? parseFirestoreValue(fields.dailyStreak) as DailyStreak
      : { currentStreak: 0, bestStreak: 0, lastPlayedDate: null };
    const dailyResults = fields.dailyResults
      ? parseFirestoreValue(fields.dailyResults) as Record<string, DailyResult>
      : {};
    const syncedAt = fields.syncedAt
      ? Number((fields.syncedAt as Record<string, unknown>).integerValue ?? (fields.syncedAt as Record<string, unknown>).doubleValue ?? 0)
      : 0;

    return { stats, achievements, dailyStreak, dailyResults, syncedAt };
  } catch (err) {
    console.error('[Gridlock] Sync fetch failed:', err);
    return null;
  }
}

export async function pushPlayerData(uid: string, data: SyncedPlayerData): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), {
      stats: data.stats,
      achievements: data.achievements,
      dailyStreak: data.dailyStreak,
      dailyResults: data.dailyResults,
      syncedAt: data.syncedAt,
    }, { merge: true });
    console.log('[Gridlock] Sync push complete');
  } catch (err) {
    console.error('[Gridlock] Sync push failed:', err);
  }
}
