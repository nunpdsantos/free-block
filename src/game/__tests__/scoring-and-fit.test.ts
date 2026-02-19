import { describe, expect, it } from 'vitest';
import { calculateScore, canAnyPieceFit, createEmptyBoard } from '../logic';
import type { PieceShape } from '../types';

function mono(color = '#fff'): PieceShape {
  return { id: 'mono-test', color, coords: [{ row: 0, col: 0 }] };
}

function domH(color = '#fff'): PieceShape {
  return {
    id: 'dom-h-test',
    color,
    coords: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ],
  };
}

describe('scoring parity', () => {
  it('matches single-line baseline example', () => {
    expect(calculateScore(8, 1, 0)).toBe(100);
  });

  it('matches streaked single-line example', () => {
    expect(calculateScore(8, 1, 1)).toBe(150);
  });

  it('matches multi-line + streak example', () => {
    expect(calculateScore(16, 2, 3)).toBe(475);
  });
});

describe('game-over fit checks', () => {
  it('reports no fit on a full board', () => {
    const board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => '#f00'));
    expect(canAnyPieceFit(board, [mono()])).toBe(false);
  });

  it('reports fit when a mono can use a single empty cell', () => {
    const board: (string | null)[][] = createEmptyBoard().map(row => row.map(() => '#f00'));
    board[3][4] = null;
    expect(canAnyPieceFit(board, [mono()])).toBe(true);
  });

  it('rejects larger piece when only one cell is free', () => {
    const board: (string | null)[][] = createEmptyBoard().map(row => row.map(() => '#f00'));
    board[1][1] = null;
    expect(canAnyPieceFit(board, [domH()])).toBe(false);
  });
});
