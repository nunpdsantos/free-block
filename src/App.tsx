import { useState, useCallback, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { LeaderboardEntry, DailyResult, PlayerStats, AchievementProgress, DailyStreak, GlobalLeaderboardEntry } from './game/types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAuth } from './hooks/useAuth';
import { getThemeById, applyTheme } from './game/themes';
import { dateToSeed, getTodayDateStr, getDayNumber, getYesterdayDateStr } from './game/random';
import { checkAchievements, getAchievementById } from './game/achievements';
import type { Achievement, AchievementContext } from './game/achievements';
import { REVIVES_PER_GAME } from './game/constants';
import { playAchievement } from './audio/sounds';
import { submitScore, retryPendingScores, syncLocalBest, onTopScoresChanged } from './firebase/leaderboard';
import { Game } from './components/Game';
import { MainMenu } from './components/MainMenu';
import { Tutorial } from './components/Tutorial';
import { DailyCalendar } from './components/DailyCalendar';
import { ProfileScreen } from './components/ProfileScreen';
import { AchievementToast } from './components/AchievementToast';
import { UpdateBanner } from './components/UpdateBanner';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import './App.css';

type Screen = 'menu' | 'tutorial' | 'playing' | 'daily' | 'daily-calendar' | 'profile';

const MAX_LEADERBOARD = 5;

const DEFAULT_STATS: PlayerStats = {
  gamesPlayed: 0,
  totalScore: 0,
  totalLinesCleared: 0,
  totalPiecesPlaced: 0,
  bestStreak: 0,
  allClearCount: 0,
  totalRevivesUsed: 0,
  highestScoreWithoutRevive: 0,
};

const DEFAULT_STREAK: DailyStreak = {
  currentStreak: 0,
  bestStreak: 0,
  lastPlayedDate: null,
};

function getInitialLeaderboard(): LeaderboardEntry[] {
  try {
    const existing = window.localStorage.getItem('gridlock-leaderboard');
    if (existing) return JSON.parse(existing) as LeaderboardEntry[];
  } catch {
    // fall through to migration
  }

  try {
    const raw = window.localStorage.getItem('gridlock-highscore');
    if (raw) {
      const score = JSON.parse(raw) as number;
      window.localStorage.removeItem('gridlock-highscore');
      if (score > 0) {
        const migrated = [{ score, date: new Date().toLocaleDateString() }];
        window.localStorage.setItem('gridlock-leaderboard', JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

const INITIAL_LEADERBOARD = getInitialLeaderboard();

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [leaderboard, setLeaderboard] = useLocalStorage<LeaderboardEntry[]>(
    'gridlock-leaderboard',
    INITIAL_LEADERBOARD
  );
  const [themeId, setThemeId] = useLocalStorage<string>('gridlock-theme', 'classic');
  const [dailyResults, setDailyResults] = useLocalStorage<Record<string, DailyResult>>(
    'gridlock-daily',
    {}
  );
  const [stats, setStats] = useLocalStorage<PlayerStats>('gridlock-stats', DEFAULT_STATS);
  const [achievementProgress, setAchievementProgress] = useLocalStorage<AchievementProgress>(
    'gridlock-achievements',
    {}
  );
  const [dailyStreak, setDailyStreak] = useLocalStorage<DailyStreak>(
    'gridlock-daily-streak',
    DEFAULT_STREAK
  );
  const { state: installState, install: installApp } = useInstallPrompt();

  // --- PWA update detection ---
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  // --- Firebase auth ---
  const { user, displayName, loading: authLoading, authError, signInWithGoogle, signOut, updateDisplayName } = useAuth();

  // --- Global leaderboard (real-time from Firestore) ---
  const [globalLeaderboard, setGlobalLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [leaderboardMode, setLeaderboardMode] = useState<'classic' | 'daily'>('classic');
  const [leaderboardFromCache, setLeaderboardFromCache] = useState(false);
  const [leaderboardRefresh, setLeaderboardRefresh] = useState(0);

  useEffect(() => {
    const unsub = onTopScoresChanged(leaderboardMode, (entries, fromCache) => {
      setGlobalLeaderboard(entries);
      setLeaderboardFromCache(fromCache);
    });
    return unsub;
  }, [leaderboardMode, leaderboardRefresh]);

  const handleLeaderboardRefresh = useCallback(() => {
    setLeaderboardRefresh(n => n + 1);
  }, []);

  // On auth ready: retry any failed score submissions and sync local best to Firestore
  useEffect(() => {
    if (authLoading || !user || !displayName) return;
    const uid = user.uid;
    const name = displayName;
    const localBest = leaderboard.length > 0 ? leaderboard[0].score : 0;

    retryPendingScores().catch(() => {});
    if (localBest > 0) {
      syncLocalBest(uid, name, localBest, 'classic').catch(() => {});
    }
  }, [authLoading, user, displayName]); // eslint-disable-line react-hooks/exhaustive-deps -- run once when auth is ready

  // Reset stale streak on app load — if last played date isn't today or yesterday, streak is broken
  useEffect(() => {
    if (dailyStreak.currentStreak > 0 && dailyStreak.lastPlayedDate) {
      const today = getTodayDateStr();
      const yesterday = getYesterdayDateStr();
      if (dailyStreak.lastPlayedDate !== today && dailyStreak.lastPlayedDate !== yesterday) {
        setDailyStreak(prev => ({ ...prev, currentStreak: 0 }));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally run once on mount

  // Toast queue for achievement notifications
  const [toastQueue, setToastQueue] = useState<Achievement[]>([]);
  const currentToast = toastQueue.length > 0 ? toastQueue[0] : null;

  const dismissToast = useCallback(() => {
    setToastQueue(prev => prev.slice(1));
  }, []);

  // Game context ref — Game.tsx updates this so achievement checks can access in-game state
  const gameContextRef = useRef<{
    currentGameScore: number | null;
    currentGameRevivesRemaining: number | null;
    lastClearCount: number | null;
  }>({ currentGameScore: null, currentGameRevivesRemaining: null, lastClearCount: null });

  // Apply theme on mount and when themeId changes; fall back if locked
  useEffect(() => {
    const theme = getThemeById(themeId);
    if (theme.requiredAchievement && !achievementProgress[theme.requiredAchievement]) {
      setThemeId('classic');
      return;
    }
    applyTheme(theme);
  }, [themeId, achievementProgress, setThemeId]);

  // Achievement checking — runs whenever stats or dailyStreak change
  const achievementProgressRef = useRef(achievementProgress);
  achievementProgressRef.current = achievementProgress;

  const dailyCount = Object.keys(dailyResults).length;

  const runAchievementCheck = useCallback(() => {
    const ctx: AchievementContext = {
      stats,
      dailyStreak,
      dailyCount,
      currentGameScore: gameContextRef.current.currentGameScore,
      currentGameRevivesRemaining: gameContextRef.current.currentGameRevivesRemaining,
      lastClearCount: gameContextRef.current.lastClearCount,
    };
    const newIds = checkAchievements(ctx, achievementProgressRef.current);
    if (newIds.length > 0) {
      const now = Date.now();
      setAchievementProgress(prev => {
        const next = { ...prev };
        for (const id of newIds) {
          next[id] = now;
        }
        return next;
      });
      const newAchievements = newIds
        .map(id => getAchievementById(id))
        .filter((a): a is Achievement => a !== undefined);
      setToastQueue(prev => [...prev, ...newAchievements]);
      playAchievement();
    }
  }, [stats, dailyStreak, dailyCount, setAchievementProgress]);

  // Run check whenever stats change
  useEffect(() => {
    runAchievementCheck();
  }, [runAchievementCheck]);

  const handleStatsUpdate = useCallback(
    (updater: (prev: PlayerStats) => PlayerStats) => {
      setStats(updater);
    },
    [setStats]
  );

  const handleGameContextUpdate = useCallback(
    (ctx: { currentGameScore?: number; currentGameRevivesRemaining?: number; lastClearCount?: number | null }) => {
      if (ctx.currentGameScore !== undefined) gameContextRef.current.currentGameScore = ctx.currentGameScore;
      if (ctx.currentGameRevivesRemaining !== undefined) gameContextRef.current.currentGameRevivesRemaining = ctx.currentGameRevivesRemaining;
      if (ctx.lastClearCount !== undefined) gameContextRef.current.lastClearCount = ctx.lastClearCount;
    },
    []
  );

  // Reset game context when leaving game
  useEffect(() => {
    if (screen !== 'playing' && screen !== 'daily') {
      gameContextRef.current = { currentGameScore: null, currentGameRevivesRemaining: null, lastClearCount: null };
    }
  }, [screen]);

  const topScore = leaderboard.length > 0 ? leaderboard[0].score : 0;

  const handleSaveScore = useCallback(
    (score: number) => {
      if (score <= 0) return;
      setLeaderboard((prev) => {
        const entry: LeaderboardEntry = {
          score,
          date: new Date().toLocaleDateString(),
        };
        const next = [...prev, entry]
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_LEADERBOARD);
        return next;
      });
    },
    [setLeaderboard]
  );

  const todayStr = getTodayDateStr();
  const todayCompleted = todayStr in dailyResults;

  const handleDailyPlay = useCallback(() => {
    if (todayCompleted) {
      setScreen('daily-calendar');
    } else {
      setScreen('daily');
    }
  }, [todayCompleted]);

  const handleDailySaveResult = useCallback(
    (score: number) => {
      const date = getTodayDateStr();
      const dayNumber = getDayNumber(date);
      setDailyResults((prev) => {
        // Prune entries older than 30 days
        const cutoff = Date.now() - 30 * 86400000;
        const pruned: Record<string, DailyResult> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (new Date(k + 'T00:00:00Z').getTime() >= cutoff) {
            pruned[k] = v;
          }
        }
        pruned[date] = { date, score, dayNumber };
        return pruned;
      });

      // Update daily streak
      setDailyStreak(prev => {
        const today = getTodayDateStr();
        const yesterday = getYesterdayDateStr();
        let newStreak: number;
        if (prev.lastPlayedDate === today) {
          // Already played today, no change
          return prev;
        } else if (prev.lastPlayedDate === yesterday) {
          newStreak = prev.currentStreak + 1;
        } else {
          newStreak = 1;
        }
        return {
          currentStreak: newStreak,
          bestStreak: Math.max(newStreak, prev.bestStreak),
          lastPlayedDate: today,
        };
      });
    },
    [setDailyResults, setDailyStreak]
  );

  // Ref to hold auth state for use in handleGameOver without re-creating the callback
  const authRef = useRef<{ uid: string | null; displayName: string | null }>({ uid: null, displayName: null });
  authRef.current = { uid: user?.uid ?? null, displayName };

  const handleGameOver = useCallback(
    (score: number, revivesRemaining: number, mode: 'classic' | 'daily') => {
      setStats(prev => {
        const next = { ...prev };
        next.gamesPlayed += 1;
        next.totalScore += score;
        if (mode === 'classic') {
          next.totalRevivesUsed += (REVIVES_PER_GAME - revivesRemaining);
        }
        if (revivesRemaining === REVIVES_PER_GAME && score > next.highestScoreWithoutRevive) {
          next.highestScoreWithoutRevive = score;
        }
        return next;
      });

      // Save to local leaderboard
      handleSaveScore(score);

      // Submit to global Firestore leaderboard
      const { uid, displayName: name } = authRef.current;
      if (uid && name && score > 0) {
        submitScore(uid, name, score, mode).catch((err) => {
          console.error('[Gridlock] Score submit failed:', err);
        });
      }
    },
    [setStats, handleSaveScore]
  );

  const dailySeed = dateToSeed(todayStr);

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu
          topScore={topScore}
          onPlay={() => setScreen('playing')}
          onDaily={handleDailyPlay}
          todayCompleted={todayCompleted}
          onTutorial={() => setScreen('tutorial')}
          onProfile={() => setScreen('profile')}
          dailyStreak={dailyStreak}
          installState={installState}
          onInstall={installApp}
          displayName={displayName}
          isAnonymous={user?.isAnonymous ?? true}
          onSignIn={signInWithGoogle}
          authError={authError}
        />
      )}
      {screen === 'tutorial' && (
        <Tutorial onBack={() => setScreen('menu')} />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          stats={stats}
          achievementProgress={achievementProgress}
          dailyStreak={dailyStreak}
          dailyCount={dailyCount}
          leaderboard={leaderboard}
          globalLeaderboard={globalLeaderboard}
          leaderboardMode={leaderboardMode}
          leaderboardFromCache={leaderboardFromCache}
          onLeaderboardModeChange={setLeaderboardMode}
          currentUid={user?.uid ?? null}
          authUser={user}
          authDisplayName={displayName}
          authLoading={authLoading}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
          onUpdateDisplayName={updateDisplayName}
          onLeaderboardRefresh={handleLeaderboardRefresh}
          onBack={() => setScreen('menu')}
        />
      )}
      {screen === 'playing' && (
        <Game
          mode="classic"
          topScore={topScore}
          themeId={themeId}
          onThemeChange={setThemeId}
          onQuit={() => setScreen('menu')}
          onStatsUpdate={handleStatsUpdate}
          onGameContextUpdate={handleGameContextUpdate}
          onGameOver={handleGameOver}
          unlockedAchievements={achievementProgress}
        />
      )}
      {screen === 'daily' && (
        <Game
          mode="daily"
          dailySeed={dailySeed}
          topScore={topScore}
          themeId={themeId}
          onThemeChange={setThemeId}
          onQuit={() => setScreen('menu')}
          onDailyComplete={handleDailySaveResult}
          onViewCalendar={() => setScreen('daily-calendar')}
          onStatsUpdate={handleStatsUpdate}
          onGameContextUpdate={handleGameContextUpdate}
          onGameOver={handleGameOver}
          unlockedAchievements={achievementProgress}
        />
      )}
      {screen === 'daily-calendar' && (
        <DailyCalendar
          results={dailyResults}
          onBack={() => setScreen('menu')}
        />
      )}

      {currentToast && (
        <AchievementToast
          key={currentToast.id}
          achievement={currentToast}
          onDismiss={dismissToast}
        />
      )}

      {needRefresh && (
        <UpdateBanner onUpdate={() => updateServiceWorker(true)} />
      )}
    </div>
  );
}
