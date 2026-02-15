import './ScoreDisplay.css';

type ScoreDisplayProps = {
  score: number;
  topScore: number;
  streak: number;
};

export function ScoreDisplay({ score, topScore, streak }: ScoreDisplayProps) {
  return (
    <div className="score-display">
      <div className="score-main">
        <div className="score-label">Score</div>
        <div className="score-value">{score.toLocaleString()}</div>
      </div>
      <div className="score-secondary">
        <div className="score-item">
          <span className="score-item-label">Best</span>
          <span className="score-item-value">{topScore.toLocaleString()}</span>
        </div>
        {streak > 0 && (
          <div className="score-item score-item--streak">
            <span className="score-item-label">Streak</span>
            <span className="score-item-value streak-value">
              {streak}x
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
