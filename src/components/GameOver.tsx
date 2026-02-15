import './GameOver.css';

type GameOverProps = {
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  revivesRemaining: number;
  onRevive: () => void;
  onPlayAgain: () => void;
  onQuit: () => void;
};

export function GameOver({
  score,
  highScore,
  isNewHighScore,
  revivesRemaining,
  onRevive,
  onPlayAgain,
  onQuit,
}: GameOverProps) {
  return (
    <div className="game-over-overlay">
      <div className="game-over-card">
        {isNewHighScore ? (
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
          {revivesRemaining > 0 && (
            <button className="game-over-btn game-over-btn--revive" onClick={onRevive}>
              Revive
            </button>
          )}
          <button className="game-over-btn" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="game-over-btn game-over-btn--secondary" onClick={onQuit}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}
