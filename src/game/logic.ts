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

export function clearCellsForRevive(board: Board): Board {
  // Collect all filled cells
  const filledCells: { row: number; col: number }[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] !== null) filledCells.push({ row: r, col: c });
    }
  }

  // Clear ~2-3 rows worth of cells (16-24 cells), targeting congested areas
  // More cells removed when board is more full
  const fillRatio = filledCells.length / (GRID_SIZE * GRID_SIZE);
  const targetCells = fillRatio > 0.5
    ? GRID_SIZE * 3  // 24 cells (~3 rows worth) when packed
    : GRID_SIZE * 2; // 16 cells (~2 rows worth) otherwise
  const toRemove = Math.min(targetCells, filledCells.length);

  // Weight cells by local congestion — cells surrounded by more filled neighbors
  // are more likely to be removed, creating gaps in crowded areas
  const weighted = filledCells.map(cell => {
    let neighbors = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = cell.row + dr;
        const nc = cell.col + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc] !== null) {
          neighbors++;
        }
      }
    }
    return { ...cell, weight: neighbors + 1 };
  });

  // Shuffle using weighted random selection (higher congestion = more likely picked)
  const selected = new Set<string>();
  const newBoard = board.map(row => [...row]);

  while (selected.size < toRemove && weighted.length > 0) {
    const totalWeight = weighted.reduce((sum, c) => sum + c.weight, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < weighted.length; i++) {
      roll -= weighted[i].weight;
      if (roll <= 0) {
        const cell = weighted[i];
        const key = `${cell.row},${cell.col}`;
        if (!selected.has(key)) {
          selected.add(key);
          newBoard[cell.row][cell.col] = null;
        }
        weighted.splice(i, 1);
        break;
      }
    }
  }

  return newBoard;
}

export function isBoardEmpty(board: Board): boolean {
  return board.every(row => row.every(cell => cell === null));
}

/** Ratio of filled cells (0 = empty, 1 = full) */
export function getBoardFillRatio(board: Board): number {
  let filled = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] !== null) filled++;
    }
  }
  return filled / (GRID_SIZE * GRID_SIZE);
}

/** Find empty cells in lines that are 7/8 filled (one cell from completion) */
export function findNearCompleteEmptyCells(board: Board): Set<string> {
  const cells = new Set<string>();

  for (let r = 0; r < GRID_SIZE; r++) {
    let emptyCount = 0;
    let emptyCol = -1;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === null) {
        emptyCount++;
        emptyCol = c;
        if (emptyCount > 1) break;
      }
    }
    if (emptyCount === 1) cells.add(`${r},${emptyCol}`);
  }

  for (let c = 0; c < GRID_SIZE; c++) {
    let emptyCount = 0;
    let emptyRow = -1;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (board[r][c] === null) {
        emptyCount++;
        emptyRow = r;
        if (emptyCount > 1) break;
      }
    }
    if (emptyCount === 1) cells.add(`${emptyRow},${c}`);
  }

  return cells;
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
