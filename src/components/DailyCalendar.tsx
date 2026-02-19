import { useState } from 'react';
import type { DailyResult } from '../game/types';
import './DailyCalendar.css';

type DailyCalendarProps = {
  results: Record<string, DailyResult>;
  onBack: () => void;
};

export function DailyCalendar({ results, onBack }: DailyCalendarProps) {
  const [copiedDate, setCopiedDate] = useState<string | null>(null);

  const entries = Object.values(results)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleShare = (result: DailyResult) => {
    const text = `Free Block Daily #${result.dayNumber} — ${result.score.toLocaleString()} pts`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedDate(result.date);
      setTimeout(() => setCopiedDate(null), 2000);
    }).catch(() => {});
  };

  return (
    <div className="daily-calendar">
      <h2 className="daily-calendar-title">Daily Challenges</h2>

      {entries.length === 0 ? (
        <div className="daily-calendar-empty">
          No daily challenges completed yet.
        </div>
      ) : (
        <div className="daily-calendar-list">
          {entries.map((result, i) => (
            <div
              key={result.date}
              className="daily-calendar-entry"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="daily-calendar-entry-info">
                <div className="daily-calendar-entry-day">
                  Daily #{result.dayNumber}
                </div>
                <div className="daily-calendar-entry-date">
                  {new Date(result.date + 'T00:00:00').toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <div className="daily-calendar-entry-score">
                {result.score.toLocaleString()}
              </div>
              <button
                className="daily-calendar-share-btn"
                onClick={() => handleShare(result)}
              >
                {copiedDate === result.date ? 'Copied!' : 'Share'}
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="menu-btn menu-btn--play daily-calendar-back" onClick={onBack}>
        Back to Menu
      </button>
    </div>
  );
}
