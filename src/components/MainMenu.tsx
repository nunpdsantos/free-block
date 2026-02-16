import './MainMenu.css';

type MainMenuProps = {
  topScore: number | null;
  onPlay: () => void;
  onDaily: () => void;
  todayCompleted: boolean;
  onTutorial: () => void;
  onLeaderboard: () => void;
};

export function MainMenu({ topScore, onPlay, onDaily, todayCompleted, onTutorial, onLeaderboard }: MainMenuProps) {
  return (
    <div className="main-menu">
      <div className="main-menu-title">
        <h1>GRIDLOCK</h1>
      </div>

      <div className="main-menu-buttons">
        <button className="menu-btn menu-btn--play" onClick={onPlay}>
          Play
        </button>
        <button className="menu-btn menu-btn--daily" onClick={onDaily}>
          {todayCompleted ? 'Daily Results' : 'Daily Challenge'}
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={onTutorial}>
          How to Play
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={onLeaderboard}>
          Leaderboard
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
