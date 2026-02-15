import type { GameState, GameAction } from './types';
import {
  createEmptyBoard,
  canPlacePiece,
  placePiece,
  findCompletedLines,
  clearLines,
  getClearingCells,
  calculateScore,
  isBoardEmpty,
  canAnyPieceFit,
  getCelebrationText,
  clearRowsForRevive,
} from './logic';
import { generateThreePieces } from './pieces';
import { PERFECT_CLEAR_BONUS, PLACEMENT_POINTS, REVIVES_PER_GAME, REVIVE_ROWS_TO_CLEAR } from './constants';

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
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLACE_PIECE': {
      const { pieceIndex, row, col } = action;
      const piece = state.currentPieces[pieceIndex];
      if (!piece) return state;
      if (!canPlacePiece(state.board, piece, row, col)) return state;

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

      // Perfect clear bonus
      const perfectBonus = linesCleared > 0 && isBoardEmpty(newBoard)
        ? PERFECT_CLEAR_BONUS
        : 0;

      const newScore = state.score + pointsEarned + perfectBonus + PLACEMENT_POINTS;
      const newHighScore = Math.max(newScore, state.highScore);

      // Update pieces - remove placed piece
      const newPieces = [...state.currentPieces];
      newPieces[pieceIndex] = null;

      // If all pieces are placed, generate new set
      const allPlaced = newPieces.every(p => p === null);
      const finalPieces = allPlaced
        ? generateThreePieces(newBoard, newMovesSinceLastClear, newScore, newStreak)
        : newPieces;

      // Check game over
      const isGameOver = !canAnyPieceFit(newBoard, finalPieces);

      // Celebration text
      const celebrationText = getCelebrationText(linesCleared);

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
      };
    }

    case 'NEW_GAME': {
      return {
        ...createInitialState(),
        highScore: state.highScore,
      };
    }

    case 'REVIVE': {
      if (state.revivesRemaining <= 0 || !state.isGameOver) return state;

      const newBoard = clearRowsForRevive(state.board, REVIVE_ROWS_TO_CLEAR);
      const newPieces = generateThreePieces(newBoard, 0);

      return {
        ...state,
        board: newBoard,
        currentPieces: newPieces,
        isGameOver: false,
        streak: 0,
        movesSinceLastClear: 0,
        revivesRemaining: state.revivesRemaining - 1,
        celebrationText: null,
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
