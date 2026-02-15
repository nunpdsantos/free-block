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
    color: '#3498db',
  },
  {
    title: 'Clear Lines',
    description: 'Fill an entire row or column to clear it and earn points.',
    blocks: 'row',
    color: '#2ecc71',
  },
  {
    title: 'Combos',
    description: 'Clear multiple lines at once or in a row for streak bonuses and higher scores.',
    blocks: 'combo',
    color: '#f1c40f',
  },
  {
    title: 'Game Over',
    description: "The game ends when no remaining piece can fit on the board. Plan ahead!",
    blocks: 'gameover',
    color: '#e74c3c',
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
              style={i % 3 !== 0 ? { background: ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6'][i % 4] } : undefined}
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
  return (
    <div className="tutorial">
      <h2 className="tutorial-title">How to Play</h2>

      <div className="tutorial-steps">
        {STEPS.map((step, i) => (
          <div key={i} className="tutorial-step">
            <div className="tutorial-step-number">{i + 1}</div>
            <div className="tutorial-step-content">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <StepIllustration step={step} />
            </div>
          </div>
        ))}
      </div>

      <button className="menu-btn menu-btn--play tutorial-back-btn" onClick={onBack}>
        Got it!
      </button>
    </div>
  );
}
