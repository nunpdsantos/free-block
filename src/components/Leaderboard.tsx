import { useState, useCallback } from 'react';
import type { LeaderboardEntry, GlobalLeaderboardEntry } from '../game/types';
import './Leaderboard.css';

type LeaderboardContentProps = {
  entries: LeaderboardEntry[];
  globalEntries: GlobalLeaderboardEntry[];
  globalMode: 'classic' | 'daily';
  globalFromCache: boolean;
  onGlobalModeChange: (mode: 'classic' | 'daily') => void;
  currentUid: string | null;
  onRefresh?: () => void;
};

type LeaderboardTab = 'global' | 'local';

export function LeaderboardContent({
  entries,
  globalEntries,
  globalMode,
  globalFromCache,
  onGlobalModeChange,
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
        <div className="leaderboard-toggle">
          <button
            className={`leaderboard-toggle__btn ${tab === 'global' ? 'leaderboard-toggle__btn--active' : ''}`}
            onClick={() => setTab('global')}
          >
            Global
          </button>
          <button
            className={`leaderboard-toggle__btn ${tab === 'local' ? 'leaderboard-toggle__btn--active' : ''}`}
            onClick={() => setTab('local')}
          >
            Local
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
          <div className="leaderboard-mode-toggle">
            <button
              className={`leaderboard-mode-btn ${globalMode === 'classic' ? 'leaderboard-mode-btn--active' : ''}`}
              onClick={() => onGlobalModeChange('classic')}
            >
              Classic
            </button>
            <button
              className={`leaderboard-mode-btn ${globalMode === 'daily' ? 'leaderboard-mode-btn--active' : ''}`}
              onClick={() => onGlobalModeChange('daily')}
            >
              Daily
            </button>
          </div>
          {globalFromCache && globalEntries.length > 0 && (
            <div className="leaderboard-cache-hint">Syncing...</div>
          )}
          <GlobalTable entries={globalEntries} currentUid={currentUid} />
        </>
      ) : (
        <LocalTable entries={entries} />
      )}
    </div>
  );
}

function GlobalTable({ entries, currentUid }: { entries: GlobalLeaderboardEntry[]; currentUid: string | null }) {
  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty">
        No global scores yet — play a game!
      </div>
    );
  }

  return (
    <table className="leaderboard-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, i) => {
          const isMe = currentUid != null && entry.uid === currentUid;
          let rowClass = '';
          if (i === 0) rowClass += ' leaderboard-row--top';
          if (isMe) rowClass += ' leaderboard-row--me';
          return (
            <tr
              key={`${entry.uid}-${entry.score}-${i}`}
              className={rowClass}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <td className="leaderboard-rank">#{i + 1}</td>
              <td className="leaderboard-player">{entry.displayName}</td>
              <td className="leaderboard-score">{entry.score.toLocaleString()}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LocalTable({ entries }: { entries: LeaderboardEntry[] }) {
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
  );
}
