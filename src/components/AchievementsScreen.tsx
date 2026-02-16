import type { AchievementProgress, PlayerStats, DailyStreak } from '../game/types';
import { ACHIEVEMENTS } from '../game/achievements';
import type { AchievementTier, AchievementContext } from '../game/achievements';
import './AchievementsScreen.css';

type AchievementsScreenProps = {
  progress: AchievementProgress;
  stats: PlayerStats;
  dailyStreak: DailyStreak;
  dailyCount: number;
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

function formatNumber(n: number): string {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

export function AchievementsScreen({ progress, stats, dailyStreak, dailyCount, onBack }: AchievementsScreenProps) {
  const unlockedCount = Object.keys(progress).length;

  const ctx: AchievementContext = {
    stats,
    dailyStreak,
    dailyCount,
    currentGameScore: null,
    currentGameRevivesRemaining: null,
    lastClearCount: null,
  };

  return (
    <div className="achievements-screen">
      <h2 className="achievements-title">Achievements</h2>
      <div className="achievements-count">
        {unlockedCount} / {ACHIEVEMENTS.length} Unlocked
      </div>

      <div className="achievements-list">
        {ACHIEVEMENTS.map((a, i) => {
          const unlocked = !!progress[a.id];
          const progressInfo = !unlocked && a.progress ? a.progress(ctx) : null;
          const progressPct = progressInfo
            ? Math.min(1, progressInfo.current / progressInfo.target)
            : null;

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
                  {a.title}
                </div>
                <div className="achievement-desc">
                  {a.description}
                </div>
                {progressInfo && progressPct !== null && (
                  <div className="achievement-progress">
                    <div className="achievement-progress-bar">
                      <div
                        className="achievement-progress-fill"
                        style={{ width: `${Math.max(progressPct * 100, 2)}%` }}
                      />
                    </div>
                    <div className="achievement-progress-text">
                      {formatNumber(progressInfo.current)} / {formatNumber(progressInfo.target)}
                    </div>
                  </div>
                )}
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
