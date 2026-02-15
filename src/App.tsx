import { useState, useCallback } from 'react';
import type { LeaderboardEntry } from './game/types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Game } from './components/Game';
import { MainMenu } from './components/MainMenu';
import { Tutorial } from './components/Tutorial';
import { Leaderboard } from './components/Leaderboard';
import './App.css';

type Screen = 'menu' | 'tutorial' | 'leaderboard' | 'playing';

const MAX_LEADERBOARD = 5;

function getInitialLeaderboard(): LeaderboardEntry[] {
  // Check if leaderboard already exists
  try {
    const existing = window.localStorage.getItem('blockblast-leaderboard');
    if (existing) return JSON.parse(existing) as LeaderboardEntry[];
  } catch {
    // fall through to migration
  }

  // Migrate old single highscore key
  try {
    const raw = window.localStorage.getItem('blockblast-highscore');
    if (raw) {
      const score = JSON.parse(raw) as number;
      window.localStorage.removeItem('blockblast-highscore');
      if (score > 0) {
        const migrated = [{ score, date: new Date().toLocaleDateString() }];
        window.localStorage.setItem('blockblast-leaderboard', JSON.stringify(migrated));
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
    'blockblast-leaderboard',
    INITIAL_LEADERBOARD
  );

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
