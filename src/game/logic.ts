import type { Board, PieceShape } from './types';
import {
  GRID_SIZE,
  POINTS_PER_CELL,
  COMBO_BASE_BONUS,
  COMBO_INCREMENT,
  STREAK_MULTIPLIER_INCREMENT,
  STREAK_MULTIPLIER_CAP,
  CELEBRATION_TEXTS,
} from './constants';

export function createEmptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null)
  );
}

export function canPlacePiece(
  board: Board,
  piece: PieceShape,
  row: number,
  col: number
): boolean {
  for (const coord of piece.coords) {
    const r = row + coord.row;
    const c = col + coord.col;
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
    if (board[r][c] !== null) return false;
  }
  return true;
}

export function placePiece(
  board: Board,
  piece: PieceShape,
  row: number,
  col: number
): Board {
  const newBoard = board.map(r => [...r]);
  for (const coord of piece.coords) {
    newBoard[row + coord.row][col + coord.col] = piece.color;
  }
  return newBoard;
}

export function findCompletedLines(board: Board): {
  rows: number[];
  cols: number[];
} {
  const rows: number[] = [];
  const cols: number[] = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    if (board[r].every(cell => cell !== null)) {
      rows.push(r);
    }
  }

  for (let c = 0; c < GRID_SIZE; c++) {
    let complete = true;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (board[r][c] === null) {
        complete = false;
        break;
      }
    }
    if (complete) cols.push(c);
  }

  return { rows, cols };
}

export function getClearingCells(
  rows: number[],
  cols: number[]
): { row: number; col: number }[] {
  const set = new Set<string>();
  const cells: { row: number; col: number }[] = [];

  for (const r of rows) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const key = `${r},${c}`;
      if (!set.has(key)) {
        set.add(key);
        cells.push({ row: r, col: c });
      }
    }
  }

  for (const c of cols) {
    for (let r = 0; r < GRID_SIZE; r++) {
      const key = `${r},${c}`;
      if (!set.has(key)) {
        set.add(key);
        cells.push({ row: r, col: c });
      }
    }
  }

  return cells;
}

export function clearLines(board: Board, rows: number[], cols: number[]): Board {
  const newBoard = board.map(r => [...r]);
  for (const r of rows) {
    for (let c = 0; c < GRID_SIZE; c++) {
      newBoard[r][c] = null;
    }
  }
  for (const c of cols) {
    for (let r = 0; r < GRID_SIZE; r++) {
      newBoard[r][c] = null;
    }
  }
  return newBoard;
}

export function calculateScore(
  cellsCleared: number,
  linesCleared: number,
  streak: number
): number {
  if (linesCleared === 0) return 0;

  const basePoints = cellsCleared * POINTS_PER_CELL;
  const comboBonus =
    linesCleared >= 1
      ? COMBO_BASE_BONUS + (linesCleared - 1) * COMBO_INCREMENT
      : 0;
  const subtotal = basePoints + comboBonus;
  const streakMultiplier = Math.min(
    STREAK_MULTIPLIER_CAP,
    1 + streak * STREAK_MULTIPLIER_INCREMENT
  );
  return Math.round(subtotal * streakMultiplier);
}

export function isBoardEmpty(board: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] !== null) return false;
    }
  }
  return true;
}

export function canPieceFitAnywhere(board: Board, piece: PieceShape): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlacePiece(board, piece, r, c)) return true;
    }
  }
  return false;
}

export function canAnyPieceFit(
  board: Board,
  pieces: (PieceShape | null)[]
): boolean {
  for (const piece of pieces) {
    if (piece && canPieceFitAnywhere(board, piece)) return true;
  }
  return false;
}

export function clearRowsForRevive(board: Board, rowCount: number): Board {
  // Find the rows with the most filled cells — clearing those creates the most space
  const rowFills = Array.from({ length: GRID_SIZE }, (_, r) => ({
    row: r,
    filled: board[r].filter(cell => cell !== null).length,
  }));
  rowFills.sort((a, b) => b.filled - a.filled);
  const rowsToClear = rowFills.slice(0, rowCount).map(r => r.row);

  const newBoard = board.map(row => [...row]);
  for (const r of rowsToClear) {
    for (let c = 0; c < GRID_SIZE; c++) {
      newBoard[r][c] = null;
    }
  }
  return newBoard;
}

export function getCelebrationText(linesCleared: number): string | null {
  let text: string | null = null;
  for (const entry of CELEBRATION_TEXTS) {
    if (linesCleared >= entry.minLines) {
      text = entry.text;
    }
  }
  return text;
}
