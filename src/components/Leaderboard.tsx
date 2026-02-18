import { useState, useCallback } from 'react';
import type { LeaderboardEntry, GlobalLeaderboardEntry, PlayerRankInfo, EntriesAroundPlayer } from '../game/types';
import './Leaderboard.css';

type LeaderboardContentProps = {
  personalEntries: LeaderboardEntry[];
  globalEntries: GlobalLeaderboardEntry[];
  playerRank: PlayerRankInfo | null;
  entriesAroundPlayer: EntriesAroundPlayer | null;
  globalLoading: boolean;
  currentUid: string | null;
  onRefresh?: () => void;
};

type LeaderboardTab = 'global' | 'personal';

export function LeaderboardContent({
  personalEntries,
  globalEntries,
  playerRank,
  entriesAroundPlayer,
  globalLoading,
  currentUid,
  onRefresh,
}: LeaderboardContentProps) {
  const [tab, setTab] = useState<LeaderboardTab>('global');
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = useCallback(() => {
    if (!onRefresh || spinning) return;
    setSpinning(true);
    onRefresh();
    setTimeout(() => setSpinning(false), 800);
  }, [onRefresh, spinning]);

  return (
    <div className="leaderboard-wrapper">
      <div className="leaderboard-header">
        <div className="leaderboard-tab-toggle">
          <button
            className={`leaderboard-tab-btn ${tab === 'global' ? 'leaderboard-tab-btn--active' : ''}`}
            onClick={() => setTab('global')}
          >
            Global
          </button>
          <button
            className={`leaderboard-tab-btn ${tab === 'personal' ? 'leaderboard-tab-btn--active' : ''}`}
            onClick={() => setTab('personal')}
          >
            Personal
          </button>
        </div>
        {tab === 'global' && onRefresh && (
          <button
            className={`leaderboard-refresh${spinning ? ' leaderboard-refresh--spinning' : ''}`}
            onClick={handleRefresh}
            aria-label="Refresh leaderboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        )}
      </div>

      {tab === 'global' ? (
        <>
          {globalLoading && (
            <div className="leaderboard-cache-hint">Loading...</div>
          )}
          <GlobalTable entries={globalEntries} currentUid={currentUid} playerRank={playerRank} entriesAroundPlayer={entriesAroundPlayer} />
        </>
      ) : (
        <PersonalTable entries={personalEntries} />
      )}
    </div>
  );
}

function GlobalTable({
  entries,
  currentUid,
  playerRank,
  entriesAroundPlayer,
}: {
  entries: GlobalLeaderboardEntry[];
  currentUid: string | null;
  playerRank: PlayerRankInfo | null;
  entriesAroundPlayer: EntriesAroundPlayer | null;
}) {
  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty">
        No scores yet — play a game!
      </div>
    );
  }

  const playerInTopList = currentUid != null && entries.some((e) => e.uid === currentUid);
  // Show nearby section when player is outside the top 10
  const showNearby = !playerInTopList && playerRank != null && playerRank.rank > 10 && entriesAroundPlayer != null;
  // If player is in the list but beyond top 10, still show full list; nearby only when no top-20 data
  const displayEntries = showNearby ? entries.slice(0, 10) : entries;

  const renderRow = (entry: GlobalLeaderboardEntry, rankNum: number, animDelay: number) => {
    const isMe = currentUid != null && entry.uid === currentUid;
    let rowClass = '';
    if (rankNum === 1) rowClass += ' leaderboard-row--top';
    if (isMe) rowClass += ' leaderboard-row--me';
    return (
      <tr
        key={`${entry.uid}-${entry.score}-${rankNum}`}
        className={rowClass}
        style={{ animationDelay: `${animDelay}ms` }}
      >
        <td className="leaderboard-rank">#{rankNum}</td>
        <td className="leaderboard-player">{entry.displayName}</td>
        <td className="leaderboard-score">{entry.score.toLocaleString()}</td>
      </tr>
    );
  };

  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {displayEntries.map((entry, i) => renderRow(entry, i + 1, i * 80))}

          {showNearby && (
            <>
              <tr className="leaderboard-row--divider">
                <td colSpan={3} className="leaderboard-divider-cell">···</td>
              </tr>
              {entriesAroundPlayer!.above.map((entry, i) => {
                const aboveRank = playerRank!.rank - (entriesAroundPlayer!.above.length - i);
                return renderRow(entry, aboveRank, 0);
              })}
              <tr className="leaderboard-row--me">
                <td className="leaderboard-rank">#{playerRank!.rank}</td>
                <td className="leaderboard-player leaderboard-player--me">{playerRank!.displayName}</td>
                <td className="leaderboard-score">{playerRank!.score.toLocaleString()}</td>
              </tr>
              {entriesAroundPlayer!.below.map((entry, i) =>
                renderRow(entry, playerRank!.rank + i + 1, 0)
              )}
            </>
          )}
        </tbody>
      </table>

      {/* Legacy footer — only show if player has a rank but nearby section is not active */}
      {!showNearby && !playerInTopList && playerRank != null && playerRank.rank > 0 && (
        <div className="leaderboard-you">
          <span className="leaderboard-you__rank">#{playerRank.rank}</span>
          <span className="leaderboard-you__name">{playerRank.displayName}</span>
          <span className="leaderboard-you__score">{playerRank.score.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

function PersonalTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty">
        No scores yet — play a game!
      </div>
    );
  }

  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
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
            <td className="leaderboard-rank">{i + 1}</td>
            <td className="leaderboard-score">{entry.score.toLocaleString()}</td>
            <td className="leaderboard-date">{entry.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
