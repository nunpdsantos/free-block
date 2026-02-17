import { useEffect, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { PlayerStats, AchievementProgress, DailyStreak, DailyResult } from '../game/types';
import {
  fetchPlayerData,
  pushPlayerData,
  mergePlayerData,
  type SyncedPlayerData,
} from '../firebase/sync';

const DEBOUNCE_MS = 2000;
const PULL_COOLDOWN_MS = 30_000; // minimum 30s between pulls

export type SyncConfig = {
  user: User | null;
  authLoading: boolean;
  stats: PlayerStats;
  achievements: AchievementProgress;
  dailyStreak: DailyStreak;
  dailyResults: Record<string, DailyResult>;
  setStats: (value: PlayerStats | ((prev: PlayerStats) => PlayerStats)) => void;
  setAchievements: (value: AchievementProgress | ((prev: AchievementProgress) => AchievementProgress)) => void;
  setDailyStreak: (value: DailyStreak | ((prev: DailyStreak) => DailyStreak)) => void;
  setDailyResults: (value: Record<string, DailyResult> | ((prev: Record<string, DailyResult>) => Record<string, DailyResult>)) => void;
};

export function useSync(config: SyncConfig): { scheduleSync: () => void } {
  const {
    user, authLoading,
    stats, achievements, dailyStreak, dailyResults,
    setStats, setAchievements, setDailyStreak, setDailyResults,
  } = config;

  const syncedUidRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPullRef = useRef(0);

  // Keep a ref to current data so push callbacks always read latest values
  const dataRef = useRef({ stats, achievements, dailyStreak, dailyResults });
  dataRef.current = { stats, achievements, dailyStreak, dailyResults };

  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.uid ?? null;

  // Refs for setters so pull doesn't depend on them changing
  const settersRef = useRef({ setStats, setAchievements, setDailyStreak, setDailyResults });
  settersRef.current = { setStats, setAchievements, setDailyStreak, setDailyResults };

  // ------ Pull + merge helper (reused by initial sync and re-pull) ------
  const pullAndMerge = useCallback((uid: string) => {
    lastPullRef.current = Date.now();

    fetchPlayerData(uid).then((result) => {
      if (result.status === 'error') {
        console.warn('[Gridlock] Sync: fetch failed, skipping (will NOT push over remote)');
        return;
      }

      if (result.status === 'empty') {
        console.log('[Gridlock] Sync: no remote data, pushing local as seed');
        pushPlayerData(uid, { ...dataRef.current, syncedAt: Date.now() });
        return;
      }

      // status === 'found'
      const remote = result.data;
      console.log('[Gridlock] Sync: merging remote data', remote);

      try {
        const local: SyncedPlayerData = {
          ...dataRef.current,
          syncedAt: Date.now(),
        };

        const merged = mergePlayerData(local, remote);

        const { setStats: ss, setAchievements: sa, setDailyStreak: sds, setDailyResults: sdr } = settersRef.current;
        ss(merged.stats);
        sa(merged.achievements);
        sds(merged.dailyStreak);
        sdr(merged.dailyResults);

        // Push merged result back so both sides converge
        pushPlayerData(uid, { ...merged, syncedAt: Date.now() });
      } catch (err) {
        console.error('[Gridlock] Sync merge/apply failed:', err);
      }
    }).catch((err) => {
      console.error('[Gridlock] Sync pull failed:', err);
    });
  }, []);

  // ------ Push current local data to Firestore ------
  const pushNow = useCallback(() => {
    const uid = uidRef.current;
    if (!uid) return;

    const data: SyncedPlayerData = {
      ...dataRef.current,
      syncedAt: Date.now(),
    };
    pushPlayerData(uid, data);
  }, []);

  // ------ Pull on auth ready + reset when UID changes ------
  useEffect(() => {
    if (authLoading || !user) return;

    const uid = user.uid;

    // Already synced this UID — skip
    if (syncedUidRef.current === uid) return;

    // New UID (first load, or sign-out/sign-in) — pull fresh
    syncedUidRef.current = uid;
    pullAndMerge(uid);
  }, [authLoading, user, pullAndMerge]);

  // ------ Debounced push ------
  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(pushNow, DEBOUNCE_MS);
  }, [pushNow]);

  // ------ Visibility change: push on hidden, re-pull on visible ------
  useEffect(() => {
    const handleVisibility = () => {
      const uid = uidRef.current;
      if (!uid) return;

      if (document.visibilityState === 'hidden') {
        // Flush any pending debounce and push
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        pushNow();
      } else if (document.visibilityState === 'visible') {
        // Re-pull when tab becomes visible (with cooldown)
        if (Date.now() - lastPullRef.current > PULL_COOLDOWN_MS) {
          pullAndMerge(uid);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pushNow, pullAndMerge]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { scheduleSync };
}
