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
  displayName: string | null;
  isAnonymous: boolean;
  onSignIn: () => void;
  authError: string | null;
};

export function MainMenu({ topScore, onPlay, onDaily, todayCompleted, onTutorial, onProfile, dailyStreak, installState, onInstall, displayName, isAnonymous, onSignIn, authError }: MainMenuProps) {
  const [showIOSHint, setShowIOSHint] = useState(false);

  return (
    <div className="main-menu">
      <div className="main-menu-title">
        <h1>GRIDLOCK</h1>
      </div>

      {displayName && (
        <div className="main-menu-identity">
          <span className="main-menu-identity__name">{displayName}</span>
          {isAnonymous && (
            <button className="main-menu-identity__signin" onClick={onSignIn}>
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          )}
          {isAnonymous && (
            <span className="main-menu-identity__hint">Keep your scores across devices</span>
          )}
          {authError && (
            <span className="main-menu-identity__error">{authError}</span>
          )}
        </div>
      )}

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
