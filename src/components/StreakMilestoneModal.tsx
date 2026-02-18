import './StreakMilestoneModal.css';

type StreakMilestoneModalProps = {
  streak: number;
  onDismiss: () => void;
};

const MILESTONE_COPY: Record<number, { title: string; subtitle: string }> = {
  7: {
    title: 'One Week Strong!',
    subtitle: 'Seven days in a row — you\'re on fire. Keep the chain alive!',
  },
  30: {
    title: 'Thirty Days!',
    subtitle: 'A full month of daily Gridlock. Absolutely unstoppable.',
  },
};

export function StreakMilestoneModal({ streak, onDismiss }: StreakMilestoneModalProps) {
  const copy = MILESTONE_COPY[streak] ?? {
    title: `${streak}-Day Streak!`,
    subtitle: 'Keep the daily habit alive!',
  };

  return (
    <div className="streak-milestone-overlay" onClick={onDismiss}>
      <div className="streak-milestone-card" onClick={e => e.stopPropagation()}>
        <div className="streak-milestone-burst" />
        <div className="streak-milestone-icon">🔥</div>
        <div className="streak-milestone-count">{streak}</div>
        <div className="streak-milestone-label">Day Streak</div>
        <div className="streak-milestone-title">{copy.title}</div>
        <div className="streak-milestone-subtitle">{copy.subtitle}</div>
        <button className="streak-milestone-btn" onClick={onDismiss}>
          Awesome!
        </button>
      </div>
    </div>
  );
}
