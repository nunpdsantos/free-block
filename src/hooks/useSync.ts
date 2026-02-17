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

  const hasSyncedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a ref to current data so push callbacks always read latest values
  const dataRef = useRef({ stats, achievements, dailyStreak, dailyResults });
  dataRef.current = { stats, achievements, dailyStreak, dailyResults };

  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.uid ?? null;

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

  // ------ Pull once on auth ready, merge, then push merged result ------
  useEffect(() => {
    if (authLoading || !user || hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    const uid = user.uid;

    fetchPlayerData(uid).then((remote) => {
      if (!remote) {
        // No remote data — push local as initial seed
        console.log('[Gridlock] Sync: no remote data, pushing local');
        pushNow();
        return;
      }

      console.log('[Gridlock] Sync: merging remote data', remote);

      try {
        const local: SyncedPlayerData = {
          ...dataRef.current,
          syncedAt: Date.now(),
        };

        const merged = mergePlayerData(local, remote);

        // Apply merged data to local state
        setStats(merged.stats);
        setAchievements(merged.achievements);
        setDailyStreak(merged.dailyStreak);
        setDailyResults(merged.dailyResults);

        // Push merged result back so both sides converge
        pushPlayerData(uid, { ...merged, syncedAt: Date.now() });
      } catch (err) {
        console.error('[Gridlock] Sync merge/apply failed:', err);
      }
    }).catch((err) => {
      console.error('[Gridlock] Sync pull failed:', err);
    });
  }, [authLoading, user, setStats, setAchievements, setDailyStreak, setDailyResults, pushNow]);

  // ------ Debounced push ------
  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(pushNow, DEBOUNCE_MS);
  }, [pushNow]);

  // ------ Push on visibilitychange (tab hidden / app background) ------
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && uidRef.current) {
        // Flush any pending debounce
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        pushNow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pushNow]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { scheduleSync };
}
