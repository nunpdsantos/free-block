import { describe, expect, it } from 'vitest';
import { clearCellsForRevive } from '../logic';
import { createInitialState, gameReducer } from '../reducer';
import { GRID_SIZE, REVIVE_CELLS_CLEARED, REVIVES_PER_GAME } from '../constants';

function createFilledBoard(fill = '#f00') {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => fill)
  );
}

function countFilled(board: (string | null)[][]): number {
  let filled = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell !== null) filled++;
    }
  }
  return filled;
}

describe('revive board clearing', () => {
  it('clears exactly min(target, filled) cells', () => {
    const board = createFilledBoard();
    const next = clearCellsForRevive(board, REVIVE_CELLS_CLEARED, () => 0.42);
    expect(countFilled(next)).toBe(GRID_SIZE * GRID_SIZE - REVIVE_CELLS_CLEARED);
  });

  it('clears all cells when board has fewer than target', () => {
    const board = createFilledBoard().map(row => row.map(() => null as string | null));
    board[0][0] = '#f00';
    board[2][2] = '#f00';
    board[4][4] = '#f00';

    const next = clearCellsForRevive(board, REVIVE_CELLS_CLEARED, () => 0.5);
    expect(countFilled(next)).toBe(0);
  });
});

describe('revive reducer flow', () => {
  it('consumes one revive, resets streak, and generates a fresh tray', () => {
    const base = createInitialState();
    const state = {
      ...base,
      mode: 'classic' as const,
      board: createFilledBoard(),
      isGameOver: true,
      revivesRemaining: REVIVES_PER_GAME,
      streak: 6,
      movesSinceLastClear: 9,
      pieceGeneration: 4,
      score: 4200,
    };

    const next = gameReducer(state, { type: 'REVIVE' });

    expect(next.revivesRemaining).toBe(REVIVES_PER_GAME - 1);
    expect(next.streak).toBe(0);
    expect(next.movesSinceLastClear).toBe(0);
    expect(next.pieceGeneration).toBe(state.pieceGeneration + 1);
    expect(next.currentPieces.every(piece => piece !== null)).toBe(true);
    expect(countFilled(next.board)).toBe(GRID_SIZE * GRID_SIZE - REVIVE_CELLS_CLEARED);
  });
});
