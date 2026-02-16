import { useState } from 'react';
import { PIECE_COLORS } from '../game/constants';
import './Tutorial.css';

type TutorialProps = {
  onBack: () => void;
};

const STEPS = [
  {
    title: 'Drag & Drop',
    description: 'Drag pieces from the tray onto the 8\u00d78 board. Place them in empty spaces.',
    blocks: [
      [1, 1],
      [1, 0],
      [1, 0],
    ],
    color: PIECE_COLORS.blue,
  },
  {
    title: 'Clear Lines',
    description: 'Fill an entire row or column to clear it. Each block cleared earns 10 points.',
    blocks: 'row',
    color: PIECE_COLORS.green,
  },
  {
    title: 'Combos & Streaks',
    description: 'Clear multiple lines at once for combo bonuses. Consecutive clears build a streak multiplier for even bigger scores!',
    blocks: 'combo',
    color: PIECE_COLORS.yellow,
  },
  {
    title: 'Game Over',
    description: "The game ends when no remaining piece can fit on the board. Plan ahead!",
    blocks: 'gameover',
    color: PIECE_COLORS.red,
  },
];

function StepIllustration({ step }: { step: typeof STEPS[number] }) {
  if (step.blocks === 'row') {
    return (
      <div className="tutorial-illustration">
        <div className="tutorial-grid-row">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="tutorial-cell tutorial-cell--filled" style={{ background: step.color }} />
          ))}
        </div>
        <div className="tutorial-clear-flash" />
      </div>
    );
  }

  if (step.blocks === 'combo') {
    return (
      <div className="tutorial-illustration">
        <div className="tutorial-combo">
          <div className="tutorial-grid-row">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="tutorial-cell tutorial-cell--filled" style={{ background: step.color }} />
            ))}
          </div>
          <div className="tutorial-grid-row">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="tutorial-cell tutorial-cell--filled" style={{ background: step.color, opacity: 0.7 }} />
            ))}
          </div>
          <div className="tutorial-streak-badge">2x Streak!</div>
        </div>
      </div>
    );
  }

  if (step.blocks === 'gameover') {
    return (
      <div className="tutorial-illustration">
        <div className="tutorial-mini-board">
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className={`tutorial-cell ${i % 3 !== 0 ? 'tutorial-cell--filled' : ''}`}
              style={i % 3 !== 0 ? { background: [PIECE_COLORS.blue, PIECE_COLORS.red, PIECE_COLORS.green, PIECE_COLORS.purple][i % 4] } : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  // Drag & drop shape
  const blocks = step.blocks as number[][];
  return (
    <div className="tutorial-illustration">
      <div className="tutorial-piece">
        {blocks.map((row, r) =>
          row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              className={`tutorial-cell ${cell ? 'tutorial-cell--filled' : 'tutorial-cell--empty'}`}
              style={cell ? { background: step.color, gridRow: r + 1, gridColumn: c + 1 } : { gridRow: r + 1, gridColumn: c + 1 }}
            />
          ))
        )}
      </div>
      <div className="tutorial-arrow">&#8595;</div>
      <div className="tutorial-mini-board tutorial-mini-board--target">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="tutorial-cell" />
        ))}
      </div>
    </div>
  );
}

export function Tutorial({ onBack }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="tutorial">
      <h2 className="tutorial-title">How to Play</h2>

      <div className="tutorial-stepper" key={currentStep}>
        <div className="tutorial-step tutorial-step--single">
          <div className="tutorial-step-number">{currentStep + 1}</div>
          <div className="tutorial-step-content">
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <StepIllustration step={step} />
          </div>
        </div>
      </div>

      <div className="tutorial-dots">
        {STEPS.map((_, i) => (
          <button
            key={i}
            className={`tutorial-dot ${i === currentStep ? 'tutorial-dot--active' : ''}`}
            onClick={() => setCurrentStep(i)}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>

      <div className="tutorial-nav">
        {!isFirst && (
          <button className="menu-btn menu-btn--secondary tutorial-nav-btn" onClick={() => setCurrentStep(s => s - 1)}>
            Back
          </button>
        )}
        {isLast ? (
          <button className="menu-btn menu-btn--play tutorial-nav-btn" onClick={onBack}>
            Got it!
          </button>
        ) : (
          <button className="menu-btn menu-btn--play tutorial-nav-btn" onClick={() => setCurrentStep(s => s + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
