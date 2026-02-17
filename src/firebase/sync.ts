import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';
import type { PlayerStats, AchievementProgress, DailyStreak, DailyResult } from '../game/types';

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
// Firestore I/O — uses SDK (single-doc reads work fine with persistent cache)
// ---------------------------------------------------------------------------

export async function fetchPlayerData(uid: string): Promise<SyncedPlayerData | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;

    const data = snap.data();
    if (!data.stats) return null; // Doc exists but has no sync data yet

    return {
      stats: data.stats as PlayerStats,
      achievements: (data.achievements ?? {}) as AchievementProgress,
      dailyStreak: (data.dailyStreak ?? { currentStreak: 0, bestStreak: 0, lastPlayedDate: null }) as DailyStreak,
      dailyResults: (data.dailyResults ?? {}) as Record<string, DailyResult>,
      syncedAt: (data.syncedAt as number) ?? 0,
    };
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
