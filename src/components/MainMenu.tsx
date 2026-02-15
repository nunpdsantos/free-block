import type { ThemeId } from '../App';
import './MainMenu.css';

const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'midnight', label: 'Midnight', swatch: '#58a6ff' },
  { id: 'forest', label: 'Ember', swatch: '#f97316' },
  { id: 'ocean', label: 'Frost', swatch: '#22d3ee' },
  { id: 'space', label: 'Neon', swatch: '#c084fc' },
];

type MainMenuProps = {
  topScore: number | null;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  onPlay: () => void;
  onTutorial: () => void;
  onLeaderboard: () => void;
};

export function MainMenu({ topScore, theme, onThemeChange, onPlay, onTutorial, onLeaderboard }: MainMenuProps) {
  return (
    <div className="main-menu">
      <div className="main-menu-title">
        <h1>GRIDLOCK</h1>
      </div>

      <div className="main-menu-buttons">
        <button className="menu-btn menu-btn--play" onClick={onPlay}>
          Play
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={onTutorial}>
          How to Play
        </button>
        <button className="menu-btn menu-btn--secondary" onClick={onLeaderboard}>
          Leaderboard
        </button>
      </div>

      <div className="theme-picker">
        <div className="theme-picker-label">Theme</div>
        <div className="theme-picker-options">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-swatch${theme === t.id ? ' theme-swatch--active' : ''}`}
              style={{ backgroundColor: t.swatch }}
              onClick={() => onThemeChange(t.id)}
              aria-label={t.label}
              title={t.label}
            />
          ))}
        </div>
      </div>

      {topScore !== null && topScore > 0 && (
        <div className="main-menu-top-score">
          Top Score: {topScore.toLocaleString()}
        </div>
      )}
    </div>
  );
}
