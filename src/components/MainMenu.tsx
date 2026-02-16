import { useState } from 'react';
import type { DailyStreak } from '../game/types';
import { DailyStreakBadge } from './DailyStreakBadge';
import './MainMenu.css';

type MainMenuProps = {
  topScore: number | null;
  onPlay: () => void;
  onDaily: () => void;
  todayCompleted: boolean;
  onTutorial: () => void;
  onProfile: () => void;
  dailyStreak: DailyStreak;
  installState: 'hidden' | 'prompt' | 'ios' | 'installed';
  onInstall: () => void;
};

export function MainMenu({ topScore, onPlay, onDaily, todayCompleted, onTutorial, onProfile, dailyStreak, installState, onInstall }: MainMenuProps) {
  const [showIOSHint, setShowIOSHint] = useState(false);

  return (
    <div className="main-menu">
      <div className="main-menu-title">
        <h1>GRIDLOCK</h1>
      </div>

      <DailyStreakBadge streak={dailyStreak} />

      <div className="main-menu-buttons">
        <button className="menu-btn menu-btn--play" onClick={onPlay}>
          Play
        </button>
        <button className="menu-btn menu-btn--daily" onClick={onDaily}>
          {todayCompleted ? 'Daily Results' : 'Daily Challenge'}
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={onProfile}>
          Profile
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={onTutorial}>
          How to Play
        </button>
      </div>

      {topScore !== null && topScore > 0 && (
        <div className="main-menu-top-score">
          Top Score: {topScore.toLocaleString()}
        </div>
      )}

      {installState === 'prompt' && (
        <button className="install-btn" onClick={onInstall}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          Install App
        </button>
      )}

      {installState === 'ios' && (
        <>
          <button className="install-btn" onClick={() => setShowIOSHint(h => !h)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
            Install App
          </button>
          {showIOSHint && (
            <div className="install-ios-hint">
              Tap the share button, then "Add to Home Screen"
            </div>
          )}
        </>
      )}
    </div>
  );
}
