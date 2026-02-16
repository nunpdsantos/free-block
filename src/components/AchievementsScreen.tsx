import type { AchievementProgress } from '../game/types';
import { ACHIEVEMENTS } from '../game/achievements';
import type { AchievementTier } from '../game/achievements';
import './AchievementsScreen.css';

type AchievementsScreenProps = {
  progress: AchievementProgress;
  onBack: () => void;
};

const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD740',
};

const TIER_ICONS: Record<AchievementTier, string> = {
  bronze: '\u2605',
  silver: '\u2605\u2605',
  gold: '\u2605\u2605\u2605',
};

export function AchievementsScreen({ progress, onBack }: AchievementsScreenProps) {
  const unlockedCount = Object.keys(progress).length;

  return (
    <div className="achievements-screen">
      <h2 className="achievements-title">Achievements</h2>
      <div className="achievements-count">
        {unlockedCount} / {ACHIEVEMENTS.length} Unlocked
      </div>

      <div className="achievements-list">
        {ACHIEVEMENTS.map((a, i) => {
          const unlocked = !!progress[a.id];
          return (
            <div
              key={a.id}
              className={`achievement-card ${unlocked ? 'achievement-card--unlocked' : 'achievement-card--locked'}`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div
                className="achievement-tier"
                style={{ color: unlocked ? TIER_COLORS[a.tier] : 'var(--text-secondary)' }}
              >
                {TIER_ICONS[a.tier]}
              </div>
              <div className="achievement-info">
                <div className="achievement-name">
                  {unlocked ? a.title : a.title}
                </div>
                <div className="achievement-desc">
                  {a.description}
                </div>
              </div>
              {unlocked && <div className="achievement-check">&#10003;</div>}
            </div>
          );
        })}
      </div>

      <button className="menu-btn menu-btn--secondary achievements-back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
