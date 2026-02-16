import type { LeaderboardEntry } from '../game/types';
import './Leaderboard.css';

type LeaderboardContentProps = {
  entries: LeaderboardEntry[];
};

export function LeaderboardContent({ entries }: LeaderboardContentProps) {
  return (
    <>
      {entries.length === 0 ? (
        <div className="leaderboard-empty">
          No scores yet — play a game!
        </div>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Score</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr
                key={i}
                className={i === 0 ? 'leaderboard-row--top' : ''}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <td className="leaderboard-rank">#{i + 1}</td>
                <td className="leaderboard-score">{entry.score.toLocaleString()}</td>
                <td className="leaderboard-date">{entry.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
