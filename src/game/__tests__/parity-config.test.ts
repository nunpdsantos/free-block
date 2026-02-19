import { describe, expect, it } from 'vitest';
import {
  ALL_CLEAR_BONUS,
  DIFFICULTY_SCORE_CEILING,
  PITY_THRESHOLD,
  SOLUTION_THRESHOLD,
} from '../constants';
import { generateThreePieces } from '../pieces';
import { shouldCommitOnExitFromGameOver, shouldCommitOnGameOver } from '../persistence';

describe('parity constants', () => {
  it('matches configured bonus and mercy thresholds', () => {
    expect(ALL_CLEAR_BONUS).toBe(300);
    expect(PITY_THRESHOLD).toBe(7);
    expect(SOLUTION_THRESHOLD).toBe(15);
    expect(DIFFICULTY_SCORE_CEILING).toBe(15000);
  });
});

describe('piece pool parity guard', () => {
  it('never emits removed non-parity shapes', () => {
    const seen = new Set<string>();

    for (let i = 0; i < 1500; i++) {
      const pieces = generateThreePieces();
      for (const piece of pieces) {
        const baseId = piece.id.replace(/-\d+-\d+$/, '');
        seen.add(baseId);
      }
    }

    for (const id of seen) {
      expect(id.startsWith('diag-')).toBe(false);
      expect(id.startsWith('diag-dom-')).toBe(false);
      expect(id.startsWith('big-t-')).toBe(false);
    }
  });
});

describe('game-over persistence gating', () => {
  it('commits immediately only for terminal game-over states', () => {
    expect(shouldCommitOnGameOver('daily', 0)).toBe(true);
    expect(shouldCommitOnGameOver('classic', 0)).toBe(true);
    expect(shouldCommitOnGameOver('classic', 2)).toBe(false);
  });

  it('commits when exiting a non-terminal classic game-over', () => {
    expect(shouldCommitOnExitFromGameOver('classic', 2)).toBe(true);
    expect(shouldCommitOnExitFromGameOver('classic', 1)).toBe(true);
    expect(shouldCommitOnExitFromGameOver('classic', 0)).toBe(false);
    expect(shouldCommitOnExitFromGameOver('daily', 0)).toBe(false);
  });
});
