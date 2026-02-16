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
  onRevive,
  onPlayAgain,
  onQuit,
  onViewCalendar,
}: GameOverProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const dayNum = getDayNumber(getTodayDateStr());
    const text = `Gridlock Daily #${dayNum} — ${score.toLocaleString()} pts`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const isDaily = mode === 'daily';

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
          </>
        ) : isNewHighScore ? (
          <div className="new-best-celebration">
            <div className="new-best-burst" />
            <div className="new-best-crown">&#9813;</div>
            <div className="new-best-banner">NEW BEST</div>
            <div className="new-best-score">{score.toLocaleString()}</div>
          </div>
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
