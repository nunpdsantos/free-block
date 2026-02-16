import type { PlayerStats, DailyStreak, AchievementProgress } from './types';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export type AchievementProgressInfo = { current: number; target: number };

export type Achievement = {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  check: (ctx: AchievementContext) => boolean;
  progress?: (ctx: AchievementContext) => AchievementProgressInfo;
};

export type AchievementContext = {
  stats: PlayerStats;
  dailyStreak: DailyStreak;
  dailyCount: number;
  currentGameScore: number | null;
  currentGameRevivesRemaining: number | null;
  lastClearCount: number | null;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_steps',
    title: 'First Steps',
    description: 'Complete your first game',
    tier: 'bronze',
    check: (ctx) => ctx.stats.gamesPlayed >= 1,
    progress: (ctx) => ({ current: ctx.stats.gamesPlayed, target: 1 }),
  },
  {
    id: 'century',
    title: 'Century',
    description: 'Score 100+ in a single game',
    tier: 'bronze',
    check: (ctx) => ctx.currentGameScore !== null && ctx.currentGameScore >= 100,
  },
  {
    id: 'hot_streak',
    title: 'Hot Streak',
    description: 'Reach a 5-streak',
    tier: 'silver',
    check: (ctx) => ctx.stats.bestStreak >= 5,
    progress: (ctx) => ({ current: ctx.stats.bestStreak, target: 5 }),
  },
  {
    id: 'inferno',
    title: 'Inferno',
    description: 'Reach a 10-streak',
    tier: 'gold',
    check: (ctx) => ctx.stats.bestStreak >= 10,
    progress: (ctx) => ({ current: ctx.stats.bestStreak, target: 10 }),
  },
  {
    id: 'clean_slate',
    title: 'Clean Slate',
    description: 'Get an all-clear',
    tier: 'silver',
    check: (ctx) => ctx.stats.allClearCount >= 1,
    progress: (ctx) => ({ current: ctx.stats.allClearCount, target: 1 }),
  },
  {
    id: 'no_safety_net',
    title: 'No Safety Net',
    description: 'Score 5,000+ without using any revives',
    tier: 'gold',
    check: (ctx) => ctx.stats.highestScoreWithoutRevive >= 5000,
    progress: (ctx) => ({ current: ctx.stats.highestScoreWithoutRevive, target: 5000 }),
  },
  {
    id: 'marathon',
    title: 'Marathon',
    description: 'Play 50 games',
    tier: 'bronze',
    check: (ctx) => ctx.stats.gamesPlayed >= 50,
    progress: (ctx) => ({ current: ctx.stats.gamesPlayed, target: 50 }),
  },
  {
    id: 'daily_devotee',
    title: 'Daily Devotee',
    description: 'Complete 7 daily challenges',
    tier: 'silver',
    check: (ctx) => ctx.dailyCount >= 7,
    progress: (ctx) => ({ current: ctx.dailyCount, target: 7 }),
  },
  {
    id: 'daily_warrior',
    title: 'Daily Warrior',
    description: 'Reach a 7-day daily streak',
    tier: 'gold',
    check: (ctx) => ctx.dailyStreak.bestStreak >= 7,
    progress: (ctx) => ({ current: ctx.dailyStreak.bestStreak, target: 7 }),
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Score 10,000+ in a single game',
    tier: 'silver',
    check: (ctx) => ctx.currentGameScore !== null && ctx.currentGameScore >= 10000,
  },
  {
    id: 'legend',
    title: 'Legend',
    description: 'Score 25,000+ in a single game',
    tier: 'gold',
    check: (ctx) => ctx.currentGameScore !== null && ctx.currentGameScore >= 25000,
  },
  {
    id: 'line_master',
    title: 'Line Master',
    description: 'Clear 500 lines total',
    tier: 'silver',
    check: (ctx) => ctx.stats.totalLinesCleared >= 500,
    progress: (ctx) => ({ current: ctx.stats.totalLinesCleared, target: 500 }),
  },
  {
    id: 'piece_prodigy',
    title: 'Piece Prodigy',
    description: 'Place 1,000 pieces total',
    tier: 'bronze',
    check: (ctx) => ctx.stats.totalPiecesPlaced >= 1000,
    progress: (ctx) => ({ current: ctx.stats.totalPiecesPlaced, target: 1000 }),
  },
  {
    id: 'combo_king',
    title: 'Combo King',
    description: 'Clear 4+ lines in a single move',
    tier: 'gold',
    check: (ctx) => ctx.lastClearCount !== null && ctx.lastClearCount >= 4,
  },
  {
    id: 'survivor',
    title: 'Survivor',
    description: 'Use all 3 revives in a single game',
    tier: 'bronze',
    check: (ctx) => ctx.currentGameRevivesRemaining === 0,
  },
];

/** Check all achievements and return IDs of newly unlocked ones. */
export function checkAchievements(
  ctx: AchievementContext,
  alreadyUnlocked: AchievementProgress
): string[] {
  const newlyUnlocked: string[] = [];
  for (const achievement of ACHIEVEMENTS) {
    if (alreadyUnlocked[achievement.id]) continue;
    if (achievement.check(ctx)) {
      newlyUnlocked.push(achievement.id);
    }
  }
  return newlyUnlocked;
}

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}
