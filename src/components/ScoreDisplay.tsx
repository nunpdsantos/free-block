import './ScoreDisplay.css';

type ScoreDisplayProps = {
  score: number;
  topScore: number;
  streak: number;
};

export function ScoreDisplay({ score, topScore, streak }: ScoreDisplayProps) {
  return (
    <div className="score-display">
      <div className="score-section">
        <div className="score-label">Score</div>
        <div className="score-value">{score.toLocaleString()}</div>
      </div>
      {streak > 0 && (
        <div className="streak-badge">{streak}x</div>
      )}
      <div className="score-section">
        <div className="score-label score-label--best">
          <span className="crown-icon">&#9813;</span>
          Best
        </div>
        <div className="score-value score-value--best">
          {topScore.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
