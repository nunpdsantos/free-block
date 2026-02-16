import { useEffect } from 'react';
import type { Achievement } from '../game/achievements';
import './AchievementToast.css';

type AchievementToastProps = {
  achievement: Achievement;
  onDismiss: () => void;
};

const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD740',
};

export function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="achievement-toast" onClick={onDismiss}>
      <div
        className="achievement-toast-icon"
        style={{ color: TIER_COLORS[achievement.tier] }}
      >
        &#9733;
      </div>
      <div className="achievement-toast-content">
        <div className="achievement-toast-label">Achievement Unlocked</div>
        <div className="achievement-toast-title">{achievement.title}</div>
      </div>
    </div>
  );
}
