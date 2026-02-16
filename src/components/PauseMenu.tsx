import { useState } from 'react';
import { THEMES } from '../game/themes';
import { getAchievementById } from '../game/achievements';
import type { AchievementProgress } from '../game/types';
import './PauseMenu.css';

type PauseMenuProps = {
  volume: number;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  themeId: string;
  onThemeChange: (id: string) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  unlockedAchievements: AchievementProgress;
};

function SpeakerIcon({ volume }: { volume: number }) {
  if (volume === 0) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {volume > 30 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
      {volume > 60 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
    </svg>
  );
}

export function PauseMenu({
  volume, onVolumeChange, onToggleMute,
  themeId, onThemeChange,
  onResume, onRestart, onQuit,
  unlockedAchievements,
}: PauseMenuProps) {
  const [lockHint, setLockHint] = useState<string | null>(null);

  return (
    <div className="pause-overlay">
      <div className="pause-card">
        <h2 className="pause-title">Paused</h2>

        <div className="pause-volume-row">
          <button className="pause-volume-icon" onClick={onToggleMute} aria-label={volume === 0 ? 'Unmute' : 'Mute'}>
            <SpeakerIcon volume={volume} />
          </button>
          <input
            type="range"
            className="pause-volume-slider"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Volume"
          />
          <span className="pause-volume-value">{volume}</span>
        </div>

        <div className="pause-theme-section">
          <div className="pause-theme-label">Theme</div>
          <div className="pause-theme-swatches">
            {THEMES.map((t) => {
              const locked = !!t.requiredAchievement && !unlockedAchievements[t.requiredAchievement];
              const achievement = t.requiredAchievement ? getAchievementById(t.requiredAchievement) : null;
              return (
                <button
                  key={t.id}
                  className={`pause-theme-swatch ${t.id === themeId ? 'pause-theme-swatch--active' : ''} ${locked ? 'pause-theme-swatch--locked' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${t.swatchFrom}, ${t.swatchTo})` }}
                  onClick={locked ? () => setLockHint(
                    achievement ? achievement.description : 'Locked'
                  ) : () => { setLockHint(null); onThemeChange(t.id); }}
                  aria-label={locked && achievement ? `Locked: ${achievement.description}` : t.name}
                />
              );
            })}
          </div>
          {lockHint && (
            <div className="pause-theme-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {lockHint}
            </div>
          )}
        </div>

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
