import type { LeaderboardEntry } from '../game/types';
import './Leaderboard.css';

type LeaderboardProps = {
  entries: LeaderboardEntry[];
  onBack: () => void;
};

export function Leaderboard({ entries, onBack }: LeaderboardProps) {
  return (
    <div className="leaderboard">
      <h2 className="leaderboard-title">Top Scores</h2>

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
              <tr key={i} className={i === 0 ? 'leaderboard-row--top' : ''}>
                <td className="leaderboard-rank">#{i + 1}</td>
                <td className="leaderboard-score">{entry.score.toLocaleString()}</td>
                <td className="leaderboard-date">{entry.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button className="menu-btn menu-btn--secondary leaderboard-back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
