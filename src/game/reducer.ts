import type { GameState, GameAction, UndoSnapshot } from './types';
import {
  createEmptyBoard,
  canPlacePiece,
  placePiece,
  findCompletedLines,
  clearLines,
  getClearingCells,
  calculateScore,
  canAnyPieceFit,
  getCelebrationText,
  clearCellsForRevive,
  isBoardEmpty,
} from './logic';
import { generateThreePieces, generateDailyPieces } from './pieces';
import { REVIVES_PER_GAME, ALL_CLEAR_BONUS, SCORE_MILESTONES, UNDOS_PER_GAME } from './constants';
import { mulberry32 } from './random';

export function createInitialState(): GameState {
  return {
    board: createEmptyBoard(),
    currentPieces: generateThreePieces(),
    score: 0,
    highScore: 0,
    streak: 0,
    isGameOver: false,
    lastClearCount: 0,
    celebrationText: null,
    revivesRemaining: REVIVES_PER_GAME,
    movesSinceLastClear: 0,
    pieceGeneration: 0,
    lastMilestone: 0,
    undoSnapshot: null,
    undosRemaining: UNDOS_PER_GAME,
    mode: 'classic',
  };
}

export function createDailyState(seed: number): GameState {
  const board = createEmptyBoard();
  const rng = mulberry32(seed);
  return {
    board,
    currentPieces: generateDailyPieces(board, rng),
    score: 0,
    highScore: 0,
    streak: 0,
    isGameOver: false,
    lastClearCount: 0,
    celebrationText: null,
    revivesRemaining: 0,
    movesSinceLastClear: 0,
    pieceGeneration: 0,
    lastMilestone: 0,
    undoSnapshot: null,
    undosRemaining: 0,
    mode: 'daily',
    dailySeed: seed,
  };
}

function takeSnapshot(state: GameState): UndoSnapshot {
  return {
    board: state.board.map(row => [...row]),
    currentPieces: [...state.currentPieces],
    score: state.score,
    streak: state.streak,
    movesSinceLastClear: state.movesSinceLastClear,
    pieceGeneration: state.pieceGeneration,
    lastMilestone: state.lastMilestone,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLACE_PIECE': {
      const { pieceIndex, row, col } = action;
      const piece = state.currentPieces[pieceIndex];
      if (!piece) return state;
      if (!canPlacePiece(state.board, piece, row, col)) return state;

      // Save undo snapshot before mutating
      const undoSnapshot = state.mode === 'classic' ? takeSnapshot(state) : null;

      // Place the piece
      let newBoard = placePiece(state.board, piece, row, col);

      // Find and clear completed lines
      const { rows, cols } = findCompletedLines(newBoard);
      const linesCleared = rows.length + cols.length;
      const clearingCells = getClearingCells(rows, cols);

      if (linesCleared > 0) {
        newBoard = clearLines(newBoard, rows, cols);
      }

      // Update streak
      const newStreak = linesCleared > 0 ? state.streak + 1 : 0;

      // Update movesSinceLastClear
      const newMovesSinceLastClear = linesCleared > 0 ? 0 : state.movesSinceLastClear + 1;

      // Calculate score
      const pointsEarned = calculateScore(
        clearingCells.length,
        linesCleared,
        linesCleared > 0 ? newStreak - 1 : 0
      );

      // All-clear detection + bonus
      const boardEmpty = linesCleared > 0 && isBoardEmpty(newBoard);
      const allClearBonus = boardEmpty ? ALL_CLEAR_BONUS : 0;

      const newScore = state.score + pointsEarned + allClearBonus;
      const newHighScore = Math.max(newScore, state.highScore);

      // Milestone detection
      let newLastMilestone = state.lastMilestone;
      for (const m of SCORE_MILESTONES) {
        if (state.score < m && newScore >= m) {
          newLastMilestone = m;
        }
      }

      // Update pieces - remove placed piece
      const newPieces = [...state.currentPieces];
      newPieces[pieceIndex] = null;

      // If all pieces are placed, generate new set
      const allPlaced = newPieces.every(p => p === null);
      let finalPieces = newPieces;
      let newPieceGeneration = state.pieceGeneration;

      if (allPlaced) {
        newPieceGeneration = state.pieceGeneration + 1;
        if (state.mode === 'daily' && state.dailySeed !== undefined) {
          const rng = mulberry32(state.dailySeed + newPieceGeneration);
          finalPieces = generateDailyPieces(newBoard, rng);
        } else {
          finalPieces = generateThreePieces(newBoard, newMovesSinceLastClear, newScore, newStreak);
        }
      }

      // Check game over
      const isGameOver = !canAnyPieceFit(newBoard, finalPieces);

      // Celebration text — priority: ALL CLEAR > line clear > milestone
      let celebrationText: string | null = null;
      if (boardEmpty) {
        celebrationText = 'ALL CLEAR!';
      } else if (linesCleared > 0) {
        celebrationText = getCelebrationText(linesCleared);
      } else if (newLastMilestone > state.lastMilestone) {
        celebrationText = newLastMilestone.toLocaleString() + '!';
      }

      return {
        ...state,
        board: newBoard,
        currentPieces: finalPieces,
        score: newScore,
        highScore: newHighScore,
        streak: newStreak,
        isGameOver,
        lastClearCount: linesCleared,
        celebrationText,
        movesSinceLastClear: newMovesSinceLastClear,
        pieceGeneration: newPieceGeneration,
        lastMilestone: newLastMilestone,
        undoSnapshot,
      };
    }

    case 'NEW_GAME': {
      return {
        ...createInitialState(),
        highScore: state.highScore,
      };
    }

    case 'NEW_DAILY_GAME': {
      return {
        ...createDailyState(action.seed),
        highScore: state.highScore,
      };
    }

    case 'REVIVE': {
      if (state.revivesRemaining <= 0 || !state.isGameOver) return state;

      const newBoard = clearCellsForRevive(state.board);
      const newPieces = generateThreePieces(newBoard, 0);

      return {
        ...state,
        board: newBoard,
        currentPieces: newPieces,
        isGameOver: false,
        movesSinceLastClear: 0,
        revivesRemaining: state.revivesRemaining - 1,
        celebrationText: null,
        pieceGeneration: state.pieceGeneration + 1,
      };
    }

    case 'UNDO': {
      if (!state.undoSnapshot || state.undosRemaining <= 0) return state;

      const snap = state.undoSnapshot;
      return {
        ...state,
        board: snap.board,
        currentPieces: snap.currentPieces,
        score: snap.score,
        streak: snap.streak,
        movesSinceLastClear: snap.movesSinceLastClear,
        pieceGeneration: snap.pieceGeneration,
        lastMilestone: snap.lastMilestone,
        isGameOver: false,
        lastClearCount: 0,
        celebrationText: null,
        undoSnapshot: null,
        undosRemaining: state.undosRemaining - 1,
      };
    }

    case 'DISMISS_CELEBRATION': {
      return { ...state, celebrationText: null };
    }

    case 'LOAD_HIGH_SCORE': {
      return { ...state, highScore: action.highScore };
    }

    default:
      return state;
  }
}
