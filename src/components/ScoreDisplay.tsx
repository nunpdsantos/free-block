import { useState, useEffect, useRef } from 'react';
import { STREAK_MULTIPLIER_INCREMENT } from '../game/constants';
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
  const scoreElRef = useRef<HTMLDivElement>(null);
  const prevScoreBump = useRef(score);

  // Scale bump on score increase via WAAPI
  useEffect(() => {
    if (score > prevScoreBump.current && scoreElRef.current) {
      scoreElRef.current.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.08)' },
          { transform: 'scale(1)' },
        ],
        { duration: 200, easing: 'ease-out' },
      );
    }
    prevScoreBump.current = score;
  }, [score]);
  const multiplier = 1 + streak * STREAK_MULTIPLIER_INCREMENT;
  const fillPct = Math.min(streak / 5, 1) * 100;

  // Progress toward personal best
  const isBeatingBest = topScore > 0 && score > topScore;
  const progressPct = topScore > 0
    ? Math.min((score / topScore) * 100, 100)
    : 0;
  const showProgress = topScore > 0 && score <= topScore;

  return (
    <div className="score-display">
      <div className="score-row">
        <div className="score-section">
          <div className="score-label">Score</div>
          <div className={`score-value${isBeatingBest ? ' score-value--beating-best' : ''}`} ref={scoreElRef}>{animatedScore.toLocaleString()}</div>
        </div>
        {streak > 0 && (
          <div className="streak-badge">{streak}x</div>
        )}
        <div className="score-section">
          {isBeatingBest ? (
            <>
              <div className="score-label score-label--best score-label--new-best">NEW BEST!</div>
              <div className="score-value score-value--best score-value--new-best">
                {animatedScore.toLocaleString()}
              </div>
            </>
          ) : (
            <>
              <div className="score-label score-label--best">
                <span className="crown-icon">&#9813;</span>
                Best
              </div>
              <div className="score-value score-value--best">
                {topScore.toLocaleString()}
              </div>
            </>
          )}
        </div>
      </div>
      {showProgress && (
        <div className="best-progress">
          <div className="best-progress-track">
            <div
              className={`best-progress-fill${progressPct >= 90 ? ' best-progress-fill--close' : ''}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
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
