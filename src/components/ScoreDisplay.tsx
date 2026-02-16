import { useState, useEffect, useRef } from 'react';
import { STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_CAP } from '../game/constants';
import './ScoreDisplay.css';

type ScoreDisplayProps = {
  score: number;
  topScore: number;
  streak: number;
};

/** Smoothly animate a number counting up/down */
function useAnimatedNumber(target: number, duration = 300): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    prevRef.current = target;

    if (from === to) return;

    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

export function ScoreDisplay({ score, topScore, streak }: ScoreDisplayProps) {
  const animatedScore = useAnimatedNumber(score);
  const multiplier = Math.min(1 + streak * STREAK_MULTIPLIER_INCREMENT, STREAK_MULTIPLIER_CAP);
  const fillPct = Math.min(streak / 5, 1) * 100;

  return (
    <div className="score-display">
      <div className="score-row">
        <div className="score-section">
          <div className="score-label">Score</div>
          <div className="score-value">{animatedScore.toLocaleString()}</div>
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
      {streak > 0 && (
        <div className="combo-bar">
          <div className="combo-bar-label">
            &times;{multiplier % 1 === 0 ? multiplier : multiplier.toFixed(1)}
          </div>
          <div className="combo-bar-track">
            <div
              className={`combo-bar-fill${streak >= 5 ? ' combo-bar-fill--max' : ''}`}
              style={{
                width: `${fillPct}%`,
                backgroundColor: streak >= 5 ? '#EF5350' : streak >= 3 ? '#FFD740' : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
