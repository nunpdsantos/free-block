import type { GameMode } from './types';

/** Persist immediately only for terminal game-over states. */
export function shouldCommitOnGameOver(mode: GameMode, revivesRemaining: number): boolean {
  return mode === 'daily' || revivesRemaining <= 0;
}

/** If player exits from game-over while revives remain, treat it as finalizing the run. */
export function shouldCommitOnExitFromGameOver(mode: GameMode, revivesRemaining: number): boolean {
  return mode === 'classic' && revivesRemaining > 0;
}
