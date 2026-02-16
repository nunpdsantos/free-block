import type { DailyStreak } from '../game/types';

type DailyStreakBadgeProps = {
  streak: DailyStreak;
};

export function DailyStreakBadge({ streak }: DailyStreakBadgeProps) {
  if (streak.currentStreak <= 0) return null;

  const tier =
    streak.currentStreak >= 14 ? 'streak-badge--fire' :
    streak.currentStreak >= 7 ? 'streak-badge--hot' :
    'streak-badge--warm';

  return (
    <div className={`streak-badge ${tier}`}>
      <span className="streak-badge-flame">&#128293;</span>
      <span className="streak-badge-count">{streak.currentStreak} day streak</span>
    </div>
  );
}
