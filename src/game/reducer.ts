import type { GameState, GameAction, UndoSnapshot } from './types';
import {
  createEmptyBoard,
  canPlacePiece,
  placePiece,
  findCompletedLines,
  clearLines,
  getClearingCells,
  calculateScore,
  computeSpeedMultiplier,
  canAnyPieceFit,
  getCelebrationText,
  clearCellsForRevive,
  isBoardEmpty,
} from './logic';
import { generateThreePieces, generateDailyPieces, generateRevivePieces } from './pieces';
import { REVIVES_PER_GAME, ALL_CLEAR_BONUS, SCORE_MILESTONES, UNDOS_PER_GAME, PITY_THRESHOLD } from './constants';
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
    postReviveGrace: false,
    mode: 'classic',
    lastClearTimestamp: null,
    gamePiecesPlaced: 0,
    gameLinesCleared: 0,
    gameBestStreak: 0,
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
    postReviveGrace: false,
    mode: 'daily',
    dailySeed: seed,
    lastClearTimestamp: null,
    gamePiecesPlaced: 0,
    gameLinesCleared: 0,
    gameBestStreak: 0,
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
    lastClearTimestamp: state.lastClearTimestamp,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLACE_PIECE': {
      const { pieceIndex, row, col, timestamp } = action;
      const piece = state.currentPieces[pieceIndex];
      if (!piece) return state;
      if (!canPlacePiece(state.board, piece, row, col)) return state;

      // Save undo snapshot before mutating
      const undoSnapshot =
        state.mode === 'classic' && state.undosRemaining > 0
          ? takeSnapshot(state)
          : null;

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

      // Speed bonus (only applies when clearing lines and we have a reference timestamp)
      const speedMult = linesCleared > 0
        ? computeSpeedMultiplier(state.lastClearTimestamp, timestamp)
        : null;

      // Calculate score
      const pointsEarned = calculateScore(
        clearingCells.length,
        linesCleared,
        linesCleared > 0 ? newStreak - 1 : 0,
        speedMult ?? 1.0
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

      // Post-revive grace: if player can't survive the first tray after revive, lose one extra revive
      const postReviveGrace = allPlaced ? false : state.postReviveGrace;
      const revivesRemaining = (isGameOver && state.postReviveGrace)
        ? Math.max(0, state.revivesRemaining - 1)
        : state.revivesRemaining;

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
        revivesRemaining,
        postReviveGrace,
        movesSinceLastClear: newMovesSinceLastClear,
        pieceGeneration: newPieceGeneration,
        lastMilestone: newLastMilestone,
        undoSnapshot,
        lastClearTimestamp: linesCleared > 0 ? timestamp : state.lastClearTimestamp,
        gamePiecesPlaced: state.gamePiecesPlaced + 1,
        gameLinesCleared: state.gameLinesCleared + linesCleared,
        gameBestStreak: Math.max(state.gameBestStreak, newStreak),
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

      // Generate pieces first, then carve minimum space for them
      const newPieces = generateRevivePieces(state.score);
      const newBoard = clearCellsForRevive(state.board, newPieces);

      return {
        ...state,
        board: newBoard,
        currentPieces: newPieces,
        isGameOver: false,
        movesSinceLastClear: PITY_THRESHOLD,
        streak: 0,
        revivesRemaining: state.revivesRemaining - 1,
        postReviveGrace: true,
        celebrationText: null,
        pieceGeneration: state.pieceGeneration + 1,
        lastClearTimestamp: null,
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
        lastClearTimestamp: snap.lastClearTimestamp,
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
