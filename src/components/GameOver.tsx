import { useState } from 'react';
import type { GameMode } from '../game/types';
import { getDayNumber, getTodayDateStr } from '../game/random';
import './GameOver.css';

type GameOverProps = {
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  revivesRemaining: number;
  mode: GameMode;
  piecesPlaced: number;
  linesCleared: number;
  bestStreak: number;
  onRevive: () => void;
  onPlayAgain: () => void;
  onQuit: () => void;
  onViewCalendar?: () => void;
};

export function GameOver({
  score,
  highScore,
  isNewHighScore,
  revivesRemaining,
  mode,
  piecesPlaced,
  linesCleared,
  bestStreak,
  onRevive,
  onPlayAgain,
  onQuit,
  onViewCalendar,
}: GameOverProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const dayNum = getDayNumber(getTodayDateStr());
    const text = `Free Block Daily #${dayNum} — ${score.toLocaleString()} pts`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const isDaily = mode === 'daily';

  const breakdown = (
    <div className="game-over-breakdown">
      <div className="game-over-breakdown-row">
        <span className="game-over-breakdown-label">Lines cleared</span>
        <span className="game-over-breakdown-value">{linesCleared}</span>
      </div>
      <div className="game-over-breakdown-row">
        <span className="game-over-breakdown-label">Pieces placed</span>
        <span className="game-over-breakdown-value">{piecesPlaced}</span>
      </div>
      {bestStreak > 0 && (
        <div className={`game-over-breakdown-row${bestStreak >= 3 ? ' game-over-breakdown-row--streak' : ''}`}>
          <span className="game-over-breakdown-label">Best streak</span>
          <span className="game-over-breakdown-value">{bestStreak >= 3 ? '🔥 ' : ''}{bestStreak}x</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="game-over-overlay">
      <div className="game-over-card">
        {isDaily ? (
          <>
            <h2 className="game-over-title">Daily Complete</h2>
            <div className="game-over-score">
              <div className="game-over-score-label">Score</div>
              <div className="game-over-score-value">{score.toLocaleString()}</div>
            </div>
            {breakdown}
          </>
        ) : isNewHighScore ? (
          <>
            <div className="new-best-celebration">
              <div className="new-best-burst" />
              <div className="new-best-crown">&#9813;</div>
              <div className="new-best-banner">NEW BEST</div>
              <div className="new-best-score">{score.toLocaleString()}</div>
            </div>
            {breakdown}
          </>
        ) : (
          <>
            <h2 className="game-over-title">Game Over</h2>
            <div className="game-over-score">
              <div className="game-over-score-label">Score</div>
              <div className="game-over-score-value">{score.toLocaleString()}</div>
            </div>
            <div className="game-over-best">
              <span className="game-over-best-label">Best: </span>
              <span>{highScore.toLocaleString()}</span>
            </div>
            {breakdown}
          </>
        )}
        <div className="game-over-buttons">
          {isDaily ? (
            <>
              <button className="game-over-btn" onClick={handleShare}>
                {copied ? 'Copied!' : 'Share Result'}
              </button>
              {onViewCalendar && (
                <button className="game-over-btn game-over-btn--secondary" onClick={onViewCalendar}>
                  View Calendar
                </button>
              )}
              <button className="game-over-btn game-over-btn--secondary" onClick={onQuit}>
                Menu
              </button>
            </>
          ) : (
            <>
              {revivesRemaining > 0 && (
                <button className="game-over-btn game-over-btn--revive" onClick={onRevive}>
                  Revive ({revivesRemaining} left)
                </button>
              )}
              <button className="game-over-btn" onClick={onPlayAgain}>
                Play Again
              </button>
              <button className="game-over-btn game-over-btn--secondary" onClick={onQuit}>
                Menu
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
