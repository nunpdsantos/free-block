import type { Board, PieceShape } from './types';
import {
  GRID_SIZE,
  POINTS_PER_CELL,
  COMBO_BASE_BONUS,
  COMBO_INCREMENT,
  STREAK_MULTIPLIER_INCREMENT,
  CELEBRATION_TEXTS,
} from './constants';

export function isFilledCell(cell: string | null | undefined): cell is string {
  return typeof cell === 'string' && cell.length > 0;
}

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
    if (!Array.isArray(board[r])) return false;
    if (isFilledCell(board[r][c])) return false;
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
    let complete = true;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!isFilledCell(board[r]?.[c])) {
        complete = false;
        break;
      }
    }
    if (complete) rows.push(r);
  }

  for (let c = 0; c < GRID_SIZE; c++) {
    let complete = true;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (!isFilledCell(board[r]?.[c])) {
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
  const comboBonus = COMBO_BASE_BONUS + (linesCleared - 1) * COMBO_INCREMENT;
  const subtotal = basePoints + comboBonus;
  const streakMultiplier = 1 + streak * STREAK_MULTIPLIER_INCREMENT;
  return Math.round(subtotal * streakMultiplier);
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

export function clearCellsForRevive(
  board: Board,
  cellsToClear: number,
  rng: () => number = Math.random
): Board {
  const newBoard = board.map(row => [...row]);
  const filledCells: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (isFilledCell(newBoard[r]?.[c])) {
        filledCells.push({ row: r, col: c });
      }
    }
  }

  for (let i = filledCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [filledCells[i], filledCells[j]] = [filledCells[j], filledCells[i]];
  }

  const removeCount = Math.min(cellsToClear, filledCells.length);
  for (let i = 0; i < removeCount; i++) {
    const cell = filledCells[i];
    newBoard[cell.row][cell.col] = null;
  }

  return newBoard;
}

export function isBoardEmpty(board: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (isFilledCell(board[r]?.[c])) return false;
    }
  }
  return true;
}

/** Ratio of filled cells (0 = empty, 1 = full) */
export function getBoardFillRatio(board: Board): number {
  let filled = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (isFilledCell(board[r]?.[c])) filled++;
    }
  }
  return filled / (GRID_SIZE * GRID_SIZE);
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
