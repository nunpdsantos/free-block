import type { PieceShape, Coord, Board } from './types';
import {
  PIECE_COLORS,
  PIECE_COLOR_KEYS,
  GRID_SIZE,
  PITY_THRESHOLD,
  SOLUTION_THRESHOLD,
  PITY_WEIGHT_BOOST,
  SOLUTION_WEIGHT_BOOST,
  DIFFICULTY_SCORE_THRESHOLD,
  DIFFICULTY_SCORE_CEILING,
  DIFFICULTY_HARD_BOOST_MAX,
  DIFFICULTY_EASY_PENALTY_MAX,
  STREAK_HARDENING_THRESHOLD,
  STREAK_HARD_BOOST,
  BOARD_OPEN_THRESHOLD,
  BOARD_CRITICAL_THRESHOLD,
} from './constants';
import { canPlacePiece, placePiece, findCompletedLines } from './logic';

// 'easy' = small, many valid positions; 'hard' = large or awkward, few valid positions
type DifficultyTier = 'easy' | 'medium' | 'hard';

type PieceDef = {
  id: string;
  coords: Coord[];
  weight: number;
  tier: DifficultyTier;
};

const c = (row: number, col: number): Coord => ({ row, col });

const PIECE_DEFS: PieceDef[] = [
  // Monominoes (1 cell) — easy
  { id: 'mono', coords: [c(0,0)], weight: 3, tier: 'easy' },

  // Dominoes (2 cells) — easy
  { id: 'dom-h', coords: [c(0,0), c(0,1)], weight: 6, tier: 'easy' },
  { id: 'dom-v', coords: [c(0,0), c(1,0)], weight: 6, tier: 'easy' },

  // Triomino lines (3 cells) — easy
  { id: 'tri-h', coords: [c(0,0), c(0,1), c(0,2)], weight: 6, tier: 'easy' },
  { id: 'tri-v', coords: [c(0,0), c(1,0), c(2,0)], weight: 6, tier: 'easy' },

  // Triomino L-corners (3 cells, 4 orientations) — easy
  { id: 'tri-l-1', coords: [c(0,0), c(1,0), c(1,1)], weight: 5, tier: 'easy' },
  { id: 'tri-l-2', coords: [c(0,0), c(0,1), c(1,0)], weight: 5, tier: 'easy' },
  { id: 'tri-l-3', coords: [c(0,0), c(0,1), c(1,1)], weight: 5, tier: 'easy' },
  { id: 'tri-l-4', coords: [c(0,1), c(1,0), c(1,1)], weight: 5, tier: 'easy' },

  // Tetromino lines (4 cells) — medium (long, limited placement)
  { id: 'tet-h', coords: [c(0,0), c(0,1), c(0,2), c(0,3)], weight: 4, tier: 'medium' },
  { id: 'tet-v', coords: [c(0,0), c(1,0), c(2,0), c(3,0)], weight: 4, tier: 'medium' },

  // Square 2x2 — medium (common in original, not trivially easy as board fills)
  { id: 'sq-2', coords: [c(0,0), c(0,1), c(1,0), c(1,1)], weight: 8, tier: 'medium' },

  // L-shapes (4 cells, 8 orientations) — medium
  { id: 'l-1', coords: [c(0,0), c(1,0), c(2,0), c(2,1)], weight: 4, tier: 'medium' },
  { id: 'l-2', coords: [c(0,0), c(0,1), c(0,2), c(1,0)], weight: 4, tier: 'medium' },
  { id: 'l-3', coords: [c(0,0), c(0,1), c(1,1), c(2,1)], weight: 4, tier: 'medium' },
  { id: 'l-4', coords: [c(0,2), c(1,0), c(1,1), c(1,2)], weight: 4, tier: 'medium' },
  { id: 'j-1', coords: [c(0,0), c(0,1), c(1,0), c(2,0)], weight: 4, tier: 'medium' },
  { id: 'j-2', coords: [c(0,0), c(1,0), c(1,1), c(1,2)], weight: 4, tier: 'medium' },
  { id: 'j-3', coords: [c(0,1), c(1,1), c(2,0), c(2,1)], weight: 4, tier: 'medium' },
  { id: 'j-4', coords: [c(0,0), c(0,1), c(0,2), c(1,2)], weight: 4, tier: 'medium' },

  // T-shapes (4 cells, 4 orientations) — medium
  { id: 't-1', coords: [c(0,0), c(0,1), c(0,2), c(1,1)], weight: 4, tier: 'medium' },
  { id: 't-2', coords: [c(0,0), c(1,0), c(1,1), c(2,0)], weight: 4, tier: 'medium' },
  { id: 't-3', coords: [c(0,1), c(1,0), c(1,1), c(1,2)], weight: 4, tier: 'medium' },
  { id: 't-4', coords: [c(0,1), c(1,0), c(1,1), c(2,1)], weight: 4, tier: 'medium' },

  // S/Z shapes (4 cells, 4 orientations) — hard (awkward to place, create gaps)
  { id: 's-1', coords: [c(0,1), c(0,2), c(1,0), c(1,1)], weight: 4, tier: 'hard' },
  { id: 's-2', coords: [c(0,0), c(1,0), c(1,1), c(2,1)], weight: 4, tier: 'hard' },
  { id: 'z-1', coords: [c(0,0), c(0,1), c(1,1), c(1,2)], weight: 4, tier: 'hard' },
  { id: 'z-2', coords: [c(0,1), c(1,0), c(1,1), c(2,0)], weight: 4, tier: 'hard' },

  // Pentomino lines (5 cells) — hard (requires 5 consecutive empty cells)
  { id: 'pent-h', coords: [c(0,0), c(0,1), c(0,2), c(0,3), c(0,4)], weight: 3, tier: 'hard' },
  { id: 'pent-v', coords: [c(0,0), c(1,0), c(2,0), c(3,0), c(4,0)], weight: 3, tier: 'hard' },

  // Big L-corners (5 cells, 4 orientations) — hard
  { id: 'big-l-1', coords: [c(0,0), c(1,0), c(2,0), c(2,1), c(2,2)], weight: 3, tier: 'hard' },
  { id: 'big-l-2', coords: [c(0,0), c(0,1), c(0,2), c(1,0), c(2,0)], weight: 3, tier: 'hard' },
  { id: 'big-l-3', coords: [c(0,0), c(0,1), c(0,2), c(1,2), c(2,2)], weight: 3, tier: 'hard' },
  { id: 'big-l-4', coords: [c(0,2), c(1,2), c(2,0), c(2,1), c(2,2)], weight: 3, tier: 'hard' },

  // Rectangles (6 cells) — hard
  { id: 'rect-2x3', coords: [c(0,0), c(0,1), c(0,2), c(1,0), c(1,1), c(1,2)], weight: 1, tier: 'hard' },
  { id: 'rect-3x2', coords: [c(0,0), c(0,1), c(1,0), c(1,1), c(2,0), c(2,1)], weight: 1, tier: 'hard' },

  // Square 3x3 (9 cells) — hard (most problematic piece per community)
  { id: 'sq-3', coords: [
    c(0,0), c(0,1), c(0,2),
    c(1,0), c(1,1), c(1,2),
    c(2,0), c(2,1), c(2,2),
  ], weight: 1, tier: 'hard' },

  // Diagonal domino (2 cells, 2 orientations) — hard (non-adjacent, creates guaranteed gap)
  { id: 'diag-dom-1', coords: [c(0,0), c(1,1)], weight: 1, tier: 'hard' },
  { id: 'diag-dom-2', coords: [c(0,1), c(1,0)], weight: 1, tier: 'hard' },

  // Diagonal (3 cells, 2 orientations) — hard (non-adjacent, fragments board)
  { id: 'diag-1', coords: [c(0,0), c(1,1), c(2,2)], weight: 1, tier: 'hard' }, // top-left to bottom-right
  { id: 'diag-2', coords: [c(0,2), c(1,1), c(2,0)], weight: 1, tier: 'hard' }, // top-right to bottom-left

  // Big T (5 cells, 4 orientations) — hard (3x3 bounding box T)
  { id: 'big-t-1', coords: [c(0,0), c(0,1), c(0,2), c(1,1), c(2,1)], weight: 2, tier: 'hard' }, // T down
  { id: 'big-t-2', coords: [c(0,0), c(1,0), c(1,1), c(1,2), c(2,0)], weight: 2, tier: 'hard' }, // T right (stem left)
  { id: 'big-t-3', coords: [c(0,1), c(1,1), c(2,0), c(2,1), c(2,2)], weight: 2, tier: 'hard' }, // T up
  { id: 'big-t-4', coords: [c(0,2), c(1,0), c(1,1), c(1,2), c(2,2)], weight: 2, tier: 'hard' }, // T left (stem right)

];

function pickRandomColor(rng: () => number = Math.random): string {
  const key = PIECE_COLOR_KEYS[Math.floor(rng() * PIECE_COLOR_KEYS.length)];
  return PIECE_COLORS[key];
}

// --- Board analysis helpers ---

function countValidPositions(board: Board, coords: Coord[]): number {
  let count = 0;
  const piece = { coords, color: '', id: '' } as PieceShape;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlacePiece(board, piece, r, c)) count++;
    }
  }
  return count;
}

function canEnableClear(board: Board, coords: Coord[]): boolean {
  const piece = { coords, color: '#000', id: '' } as PieceShape;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!canPlacePiece(board, piece, r, c)) continue;
      const newBoard = placePiece(board, piece, r, c);
      const { rows, cols } = findCompletedLines(newBoard);
      if (rows.length + cols.length > 0) return true;
    }
  }
  return false;
}

function getBoardOpenness(board: Board): number {
  let empty = 0;
  const total = GRID_SIZE * GRID_SIZE;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === null) empty++;
    }
  }
  return empty / total;
}

// --- DDA weight computation ---

type DDAContext = {
  board: Board | null;
  score: number;
  streak: number;
  movesSinceLastClear: number;
};

function computeAdaptiveWeights(ctx: DDAContext): Map<string, number> {
  const weights = new Map<string, number>();

  // Score-based difficulty progression (0 at threshold, 1 at ceiling)
  const scoreProgress = ctx.board
    ? Math.min(1, Math.max(0,
        (ctx.score - DIFFICULTY_SCORE_THRESHOLD) /
        (DIFFICULTY_SCORE_CEILING - DIFFICULTY_SCORE_THRESHOLD)
      ))
    : 0;

  // Board openness factor
  const openness = ctx.board ? getBoardOpenness(ctx.board) : 0.5;

  for (const def of PIECE_DEFS) {
    let w = def.weight;

    // === DIFFICULTY SCALING (makes game harder when doing well) ===

    if (scoreProgress > 0) {
      if (def.tier === 'hard') {
        // Hard pieces get boosted as score climbs
        w *= 1 + scoreProgress * (DIFFICULTY_HARD_BOOST_MAX - 1);
      } else if (def.tier === 'easy') {
        // Easy pieces get penalized as score climbs
        w *= 1 - scoreProgress * (1 - DIFFICULTY_EASY_PENALTY_MAX);
      }
      // Medium stays at base weight
    }

    // Streak pushback: consecutive clears → harder next set
    if (ctx.streak >= STREAK_HARDENING_THRESHOLD) {
      const streakFactor = ctx.streak - STREAK_HARDENING_THRESHOLD + 1;
      if (def.tier === 'hard') {
        w *= 1 + (streakFactor * (STREAK_HARD_BOOST - 1));
      } else if (def.tier === 'easy') {
        w *= Math.max(0.4, 1 - streakFactor * 0.15);
      }
    }

    // Board-state awareness
    if (ctx.board) {
      if (openness > BOARD_OPEN_THRESHOLD) {
        // Player is managing well — push harder pieces
        const openBoost = (openness - BOARD_OPEN_THRESHOLD) / (1 - BOARD_OPEN_THRESHOLD);
        if (def.tier === 'hard') w *= 1 + openBoost * 1.5;
        if (def.tier === 'easy') w *= Math.max(0.3, 1 - openBoost * 0.5);
      } else if (openness < BOARD_CRITICAL_THRESHOLD) {
        // Board is critically full — ease off
        const critFactor = (BOARD_CRITICAL_THRESHOLD - openness) / BOARD_CRITICAL_THRESHOLD;
        if (def.tier === 'easy') w *= 1 + critFactor * 1.5;
        if (def.tier === 'hard') w *= Math.max(0.3, 1 - critFactor * 0.5);
      }
    }

    // === MERCY SYSTEMS (makes game easier when struggling) ===

    if (ctx.board && ctx.movesSinceLastClear >= PITY_THRESHOLD) {
      const positions = countValidPositions(ctx.board, def.coords);
      if (positions >= 5) {
        w *= PITY_WEIGHT_BOOST;
      }
    }

    if (ctx.board && ctx.movesSinceLastClear >= SOLUTION_THRESHOLD) {
      if (canEnableClear(ctx.board, def.coords)) {
        w *= SOLUTION_WEIGHT_BOOST;
      }
    }

    // Floor at 0.1 to never fully eliminate any piece
    weights.set(def.id, Math.max(0.1, w));
  }

  return weights;
}

function pickWeightedPiece(
  exclude: Set<string>,
  weights: Map<string, number>,
  rng: () => number = Math.random
): PieceDef {
  const available = PIECE_DEFS.filter(p => !exclude.has(p.id));
  const getWeight = (p: PieceDef) => weights.get(p.id) ?? p.weight;
  const totalWeight = available.reduce((sum, p) => sum + getWeight(p), 0);
  let roll = rng() * totalWeight;
  for (const piece of available) {
    roll -= getWeight(piece);
    if (roll <= 0) return piece;
  }
  return available[available.length - 1];
}

function pieceFitsOnBoard(board: Board, coords: Coord[]): boolean {
  const piece = { coords, color: '', id: '' } as PieceShape;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlacePiece(board, piece, r, c)) return true;
    }
  }
  return false;
}

// Fallback 1×1 monomino — always fits if any cell is empty
const FALLBACK_MONO: PieceDef = PIECE_DEFS[0]; // 'mono' — the 1×1 piece

export function generateThreePieces(
  board?: Board | null,
  movesSinceLastClear: number = 0,
  score: number = 0,
  streak: number = 0
): PieceShape[] {
  const ctx: DDAContext = {
    board: board ?? null,
    score,
    streak,
    movesSinceLastClear,
  };

  const weights = computeAdaptiveWeights(ctx);

  const used = new Set<string>();
  const pieces: PieceShape[] = [];
  for (let i = 0; i < 3; i++) {
    let def: PieceDef | null = null;

    if (board) {
      // Try up to 20 picks to find a piece that fits on the board
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidate = pickWeightedPiece(used, weights);
        if (pieceFitsOnBoard(board, candidate.coords)) {
          def = candidate;
          break;
        }
      }
      // Fallback: 1×1 mono (fits if any empty cell exists)
      if (!def) {
        def = FALLBACK_MONO;
      }
    } else {
      // No board context (initial game) — pick freely
      def = pickWeightedPiece(used, weights);
    }

    used.add(def.id);
    pieces.push({
      id: def.id + '-' + Date.now() + '-' + i,
      coords: def.coords,
      color: pickRandomColor(),
    });
  }
  return pieces;
}

/**
 * Generate 3 pieces for daily challenge mode.
 * Flat weights (no DDA), seeded RNG for determinism.
 */
export function generateDailyPieces(board: Board, rng: () => number): PieceShape[] {
  // Flat weights — every piece at its base weight, no DDA
  const weights = new Map<string, number>();
  for (const def of PIECE_DEFS) {
    weights.set(def.id, def.weight);
  }

  const used = new Set<string>();
  const pieces: PieceShape[] = [];
  for (let i = 0; i < 3; i++) {
    let def: PieceDef | null = null;

    // Try up to 20 picks to find a piece that fits
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = pickWeightedPiece(used, weights, rng);
      if (pieceFitsOnBoard(board, candidate.coords)) {
        def = candidate;
        break;
      }
    }
    if (!def) def = FALLBACK_MONO;

    used.add(def.id);
    pieces.push({
      id: def.id + '-daily-' + i,
      coords: def.coords,
      color: pickRandomColor(rng),
    });
  }
  return pieces;
}

/**
 * Generate 3 pieces for revive — pity-weighted (easy/medium favored),
 * no fit-check since we'll carve space for them on the board.
 */
export function generateRevivePieces(score: number): PieceShape[] {
  const ctx: DDAContext = {
    board: null,
    score,
    streak: 0,
    movesSinceLastClear: PITY_THRESHOLD,
  };

  // Compute weights with pity active but no board context
  // Then additionally boost easy/medium and penalize hard to keep revive fair
  const weights = computeAdaptiveWeights(ctx);
  for (const def of PIECE_DEFS) {
    const w = weights.get(def.id) ?? def.weight;
    if (def.tier === 'easy') weights.set(def.id, w * 2);
    else if (def.tier === 'hard') weights.set(def.id, w * 0.3);
  }

  const used = new Set<string>();
  const pieces: PieceShape[] = [];
  for (let i = 0; i < 3; i++) {
    const def = pickWeightedPiece(used, weights);
    used.add(def.id);
    pieces.push({
      id: def.id + '-' + Date.now() + '-' + i,
      coords: def.coords,
      color: pickRandomColor(),
    });
  }
  return pieces;
}

export function getPieceBounds(coords: Coord[]): { rows: number; cols: number } {
  let maxR = 0, maxC = 0;
  for (const { row, col } of coords) {
    if (row > maxR) maxR = row;
    if (col > maxC) maxC = col;
  }
  return { rows: maxR + 1, cols: maxC + 1 };
}
