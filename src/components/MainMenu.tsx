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
};

export function MainMenu({ topScore, onPlay, onDaily, todayCompleted, onTutorial, onProfile, dailyStreak }: MainMenuProps) {
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
    </div>
  );
}
