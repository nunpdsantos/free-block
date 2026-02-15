import { useReducer, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { gameReducer, createInitialState } from '../game/reducer';
import type { Board as BoardType } from '../game/types';
import { canPlacePiece, placePiece, findCompletedLines } from '../game/logic';
import { useDrag } from '../hooks/useDrag';
import { CLEAR_ANIMATION_MS, CLEAR_STAGGER_MS, GRID_SIZE, BG_PALETTES } from '../game/constants';
import { playPlace, playClear, playGameOver, isSoundMuted, setSoundMuted } from '../audio/sounds';
import { Board } from './Board';
import { PieceTray } from './PieceTray';
import { DragOverlay } from './DragOverlay';
import { ScoreDisplay } from './ScoreDisplay';
import { GameOver } from './GameOver';
import { CelebrationText } from './CelebrationText';
import { PauseMenu } from './PauseMenu';
import { Confetti } from './Confetti';
import './Game.css';

type GameProps = {
  topScore: number;
  onQuit: () => void;
  onSaveScore: (score: number) => void;
};

/** Determine background palette index from score */
function getBgPaletteIndex(score: number): number {
  let idx = 0;
  for (let i = BG_PALETTES.length - 1; i >= 0; i--) {
    if (score >= BG_PALETTES[i].score) {
      idx = i;
      break;
    }
  }
  return idx;
}

export function Game({ topScore, onQuit, onSaveScore }: GameProps) {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const [clearingCells, setClearingCells] = useState<Map<string, number>>(new Map());
  const [isAnimating, setIsAnimating] = useState(false);
  const [animBoard, setAnimBoard] = useState<BoardType | null>(null);
  const [animPieces, setAnimPieces] = useState<typeof state.currentPieces | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [muted, setMuted] = useState(isSoundMuted);
  const gameRef = useRef<HTMLDivElement>(null);
  const scoreSavedRef = useRef(false);
  const prevGameOverRef = useRef(false);

  // --- Background palette cycling ---
  const bgIndex = useMemo(() => getBgPaletteIndex(state.score), [state.score]);

  useEffect(() => {
    const palette = BG_PALETTES[bgIndex];
    const root = document.documentElement;
    root.style.setProperty('--bg', palette.bg);
    root.style.setProperty('--bg-dark', palette.bgDark);

    return () => {
      // Reset to default when leaving game
      root.style.setProperty('--bg', BG_PALETTES[0].bg);
      root.style.setProperty('--bg-dark', BG_PALETTES[0].bgDark);
    };
  }, [bgIndex]);

  // Reset save flag on new game
  useEffect(() => {
    if (!state.isGameOver) {
      scoreSavedRef.current = false;
    }
  }, [state.isGameOver]);

  // Game over sound
  useEffect(() => {
    if (state.isGameOver && !prevGameOverRef.current) {
      playGameOver();
    }
    prevGameOverRef.current = state.isGameOver;
  }, [state.isGameOver]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      setSoundMuted(next);
      return next;
    });
  }, []);

  const handleDrop = useCallback(
    (pieceIndex: number, row: number, col: number) => {
      const piece = state.currentPieces[pieceIndex];
      if (!piece) return;
      if (!canPlacePiece(state.board, piece, row, col)) return;

      playPlace();

      const boardAfterPlace = placePiece(state.board, piece, row, col);
      const { rows, cols } = findCompletedLines(boardAfterPlace);
      const linesCleared = rows.length + cols.length;

      if (linesCleared > 0) {
        playClear(state.streak, linesCleared);

        setAnimBoard(boardAfterPlace);
        const newPieces = [...state.currentPieces];
        newPieces[pieceIndex] = null;
        setAnimPieces(newPieces);

        // Build staggered delay map
        const cellMap = new Map<string, number>();
        for (const rowIdx of rows) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const key = `${rowIdx},${c}`;
            const delay = c * CLEAR_STAGGER_MS;
            const existing = cellMap.get(key);
            cellMap.set(key, existing !== undefined ? Math.min(existing, delay) : delay);
          }
        }
        for (const colIdx of cols) {
          for (let r = 0; r < GRID_SIZE; r++) {
            const key = `${r},${colIdx}`;
            const delay = r * CLEAR_STAGGER_MS;
            const existing = cellMap.get(key);
            cellMap.set(key, existing !== undefined ? Math.min(existing, delay) : delay);
          }
        }

        setClearingCells(cellMap);
        setIsAnimating(true);
        if (linesCleared >= 2) {
          setConfettiTrigger(t => t + 1);
        }

        // Total time = max stagger delay + cell animation duration
        const maxDelay = (GRID_SIZE - 1) * CLEAR_STAGGER_MS;
        const totalMs = CLEAR_ANIMATION_MS + maxDelay;

        setTimeout(() => {
          setClearingCells(new Map());
          setAnimBoard(null);
          setAnimPieces(null);
          setIsAnimating(false);
          dispatch({ type: 'PLACE_PIECE', pieceIndex, row, col });
        }, totalMs);
      } else {
        dispatch({ type: 'PLACE_PIECE', pieceIndex, row, col });
      }
    },
    [state.board, state.currentPieces, state.streak]
  );

  const displayBoard = animBoard ?? state.board;
  const displayPieces = animPieces ?? state.currentPieces;

  const {
    dragState,
    ghostCells,
    boardRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cancelDrag,
  } = useDrag(displayBoard, handleDrop, isAnimating);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      onPointerMove(e.clientX, e.clientY);
    };
    const handleUp = () => {
      onPointerUp();
    };
    const handleCancel = () => {
      cancelDrag();
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleCancel);

    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleCancel);
    };
  }, [onPointerMove, onPointerUp, cancelDrag]);

  const saveScore = useCallback(() => {
    if (!scoreSavedRef.current && state.score > 0) {
      scoreSavedRef.current = true;
      onSaveScore(state.score);
    }
  }, [state.score, onSaveScore]);

  const handlePlayAgain = useCallback(() => {
    saveScore();
    dispatch({ type: 'NEW_GAME' });
  }, [saveScore]);

  const handleRevive = useCallback(() => {
    dispatch({ type: 'REVIVE' });
  }, []);

  const handleQuit = useCallback(() => {
    saveScore();
    onQuit();
  }, [saveScore, onQuit]);

  const handleDismissCelebration = useCallback(() => {
    dispatch({ type: 'DISMISS_CELEBRATION' });
  }, []);

  const handleRestart = useCallback(() => {
    setIsPaused(false);
    dispatch({ type: 'NEW_GAME' });
  }, []);

  const isNewHighScore = state.score > 0 && state.score >= topScore && state.isGameOver;

  return (
    <div className="game" ref={gameRef} style={{ touchAction: 'none' }}>
      <div className="game-header">
        <ScoreDisplay
          score={state.score}
          topScore={topScore}
          streak={state.streak}
        />
        {!state.isGameOver && (
          <button className="pause-btn" onClick={() => setIsPaused(true)} aria-label="Pause">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="1" width="4" height="14" rx="1" />
              <rect x="10" y="1" width="4" height="14" rx="1" />
            </svg>
          </button>
        )}
      </div>

      <div className={`board-container${state.streak > 0 ? ' board-container--streak' : ''}`} ref={boardRef}>
        <Board
          board={displayBoard}
          ghostCells={ghostCells}
          clearingCells={clearingCells}
        />
        <CelebrationText
          text={state.celebrationText}
          onDismiss={handleDismissCelebration}
        />
        <Confetti trigger={confettiTrigger} />
      </div>

      <PieceTray
        pieces={displayPieces}
        onPointerDown={onPointerDown}
        draggingIndex={dragState?.pieceIndex ?? null}
        generation={state.pieceGeneration}
      />

      <DragOverlay dragState={dragState} />

      {isPaused && !state.isGameOver && (
        <PauseMenu
          isMuted={muted}
          onToggleSound={toggleMute}
          onResume={() => setIsPaused(false)}
          onRestart={handleRestart}
          onQuit={handleQuit}
        />
      )}

      {state.isGameOver && (
        <GameOver
          score={state.score}
          highScore={topScore}
          isNewHighScore={isNewHighScore}
          revivesRemaining={state.revivesRemaining}
          onRevive={handleRevive}
          onPlayAgain={handlePlayAgain}
          onQuit={handleQuit}
        />
      )}
    </div>
  );
}
