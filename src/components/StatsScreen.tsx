import type { PlayerStats } from '../game/types';
import './StatsScreen.css';

const STAT_CARDS: { key: keyof PlayerStats; label: string; format?: (v: number) => string }[] = [
  { key: 'gamesPlayed', label: 'Games Played' },
  { key: 'totalScore', label: 'Total Score', format: (v) => v.toLocaleString() },
  { key: 'totalLinesCleared', label: 'Lines Cleared', format: (v) => v.toLocaleString() },
  { key: 'totalPiecesPlaced', label: 'Pieces Placed', format: (v) => v.toLocaleString() },
  { key: 'bestStreak', label: 'Best Streak' },
  { key: 'allClearCount', label: 'All Clears' },
  { key: 'totalRevivesUsed', label: 'Revives Used' },
  { key: 'highestScoreWithoutRevive', label: 'Best No-Revive', format: (v) => v.toLocaleString() },
];

type StatsContentProps = {
  stats: PlayerStats;
};

export function StatsContent({ stats }: StatsContentProps) {
  const hasPlayed = stats.gamesPlayed > 0;

  return (
    <>
      {!hasPlayed ? (
        <div className="stats-empty">
          No stats yet — play a game!
        </div>
      ) : (
        <div className="stats-grid">
          {STAT_CARDS.map((card, i) => {
            const value = stats[card.key];
            const display = card.format ? card.format(value) : String(value);
            return (
              <div
                key={card.key}
                className="stats-card"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="stats-card-value">{display}</div>
                <div className="stats-card-label">{card.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
