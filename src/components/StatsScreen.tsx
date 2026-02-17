import type { PlayerStats } from '../game/types';
import './StatsScreen.css';

type StatsContentProps = {
  stats: PlayerStats;
  highScore: number;
};

export function StatsContent({ stats, highScore }: StatsContentProps) {
  if (stats.gamesPlayed === 0) {
    return (
      <div className="stats-empty">
        No stats yet — play a game!
      </div>
    );
  }

  const avgScore = Math.round(stats.totalScore / stats.gamesPlayed);

  return (
    <div className="stats-layout">
      {/* Hero: High Score */}
      <div className="stats-hero">
        <div className="stats-hero-value">{highScore.toLocaleString()}</div>
        <div className="stats-hero-label">High Score</div>
      </div>

      {/* Key metrics row */}
      <div className="stats-key-row">
        <div className="stats-key">
          <div className="stats-key-value">{stats.gamesPlayed}</div>
          <div className="stats-key-label">Played</div>
        </div>
        <div className="stats-key-divider" />
        <div className="stats-key">
          <div className="stats-key-value">{stats.bestStreak}</div>
          <div className="stats-key-label">Best Streak</div>
        </div>
        <div className="stats-key-divider" />
        <div className="stats-key">
          <div className="stats-key-value">{avgScore.toLocaleString()}</div>
          <div className="stats-key-label">Avg Score</div>
        </div>
      </div>

      {/* Detail cards */}
      <div className="stats-detail-grid">
        <div className="stats-detail" style={{ animationDelay: '0.12s' }}>
          <div className="stats-detail-value">{stats.totalLinesCleared.toLocaleString()}</div>
          <div className="stats-detail-label">Lines Cleared</div>
        </div>
        <div className="stats-detail" style={{ animationDelay: '0.18s' }}>
          <div className="stats-detail-value">{stats.totalPiecesPlaced.toLocaleString()}</div>
          <div className="stats-detail-label">Pieces Placed</div>
        </div>
        <div className="stats-detail" style={{ animationDelay: '0.24s' }}>
          <div className="stats-detail-value">{stats.allClearCount}</div>
          <div className="stats-detail-label">All Clears</div>
        </div>
        <div className="stats-detail" style={{ animationDelay: '0.30s' }}>
          <div className="stats-detail-value">{stats.totalScore.toLocaleString()}</div>
          <div className="stats-detail-label">Total Score</div>
        </div>
      </div>
    </div>
  );
}
