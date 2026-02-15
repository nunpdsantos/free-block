import { useState, useCallback, useEffect } from 'react';
import type { LeaderboardEntry } from './game/types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Game } from './components/Game';
import { MainMenu } from './components/MainMenu';
import { Tutorial } from './components/Tutorial';
import { Leaderboard } from './components/Leaderboard';
import './App.css';

export type ThemeId = 'midnight' | 'forest' | 'ocean' | 'space';

type Screen = 'menu' | 'tutorial' | 'leaderboard' | 'playing';

const MAX_LEADERBOARD = 5;

function getInitialLeaderboard(): LeaderboardEntry[] {
  // Check if leaderboard already exists
  try {
    const existing = window.localStorage.getItem('gridlock-leaderboard');
    if (existing) return JSON.parse(existing) as LeaderboardEntry[];
  } catch {
    // fall through to migration
  }

  // Migrate old single highscore key
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
  const [theme, setTheme] = useLocalStorage<ThemeId>('gridlock-theme', 'midnight');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu
          topScore={topScore}
          theme={theme}
          onThemeChange={setTheme}
          onPlay={() => setScreen('playing')}
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
          topScore={topScore}
          onQuit={() => setScreen('menu')}
          onSaveScore={handleSaveScore}
        />
      )}
    </div>
  );
}
