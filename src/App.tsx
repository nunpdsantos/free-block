import { useState, useCallback, useEffect } from 'react';
import type { LeaderboardEntry, DailyResult } from './game/types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getThemeById, applyTheme } from './game/themes';
import { dateToSeed, getTodayDateStr, getDayNumber } from './game/random';
import { Game } from './components/Game';
import { MainMenu } from './components/MainMenu';
import { Tutorial } from './components/Tutorial';
import { Leaderboard } from './components/Leaderboard';
import { DailyCalendar } from './components/DailyCalendar';
import './App.css';

type Screen = 'menu' | 'tutorial' | 'leaderboard' | 'playing' | 'daily' | 'daily-calendar';

const MAX_LEADERBOARD = 5;

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

  // Apply theme on mount and when themeId changes
  useEffect(() => {
    const theme = getThemeById(themeId);
    applyTheme(theme);
  }, [themeId]);

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
    },
    [setDailyResults]
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
          onLeaderboard={() => setScreen('leaderboard')}
        />
      )}
      {screen === 'tutorial' && (
        <Tutorial onBack={() => setScreen('menu')} />
      )}
      {screen === 'leaderboard' && (
        <Leaderboard entries={leaderboard} onBack={() => setScreen('menu')} />
      )}
      {screen === 'playing' && (
        <Game
          mode="classic"
          topScore={topScore}
          themeId={themeId}
          onThemeChange={setThemeId}
          onQuit={() => setScreen('menu')}
          onSaveScore={handleSaveScore}
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
          onSaveScore={handleSaveScore}
          onDailyComplete={handleDailySaveResult}
          onViewCalendar={() => setScreen('daily-calendar')}
        />
      )}
      {screen === 'daily-calendar' && (
        <DailyCalendar
          results={dailyResults}
          onBack={() => setScreen('menu')}
        />
      )}
    </div>
  );
}
