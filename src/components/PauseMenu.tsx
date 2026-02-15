import './PauseMenu.css';

type PauseMenuProps = {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
};

export function PauseMenu({ onResume, onRestart, onQuit }: PauseMenuProps) {
  return (
    <div className="pause-overlay">
      <div className="pause-card">
        <h2 className="pause-title">Paused</h2>
        <div className="pause-buttons">
          <button className="menu-btn menu-btn--play" onClick={onResume}>
            Resume
          </button>
          <button className="menu-btn menu-btn--secondary" onClick={onRestart}>
            Restart
          </button>
          <button className="menu-btn menu-btn--secondary pause-btn--quit" onClick={onQuit}>
            Quit to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
