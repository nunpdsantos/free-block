import { useReducer, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { gameReducer, createInitialState } from '../game/reducer';
import type { Board as BoardType } from '../game/types';
import {
  canPlacePiece,
  placePiece,
  findCompletedLines,
  getClearingCells,
  calculateScore,
  clearLines,
  isBoardEmpty,
} from '../game/logic';
import { useDrag } from '../hooks/useDrag';
import {
  CLEAR_ANIMATION_MS,
  CLEAR_STAGGER_MS,
  GRID_SIZE,
  BG_PALETTES,
  ALL_CLEAR_BONUS,
  SCORE_MILESTONES,
} from '../game/constants';
import { playPlace, playClear, playAllClear, playGameOver, isSoundMuted, setSoundMuted } from '../audio/sounds';
import { Board } from './Board';
import { PieceTray } from './PieceTray';
import { DragOverlay } from './DragOverlay';
import { ScoreDisplay } from './ScoreDisplay';
import { GameOver } from './GameOver';
import { CelebrationText } from './CelebrationText';
import { PauseMenu } from './PauseMenu';
import { Confetti } from './Confetti';
import { CellParticles } from './CellParticles';
import { PlaceSparkles } from './PlaceSparkles';
import type { PlacedCell } from './PlaceSparkles';
import { AmbientParticles } from './AmbientParticles';
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
  const [confettiCount, setConfettiCount] = useState(12);
  const [muted, setMuted] = useState(isSoundMuted);
  const [scorePop, setScorePop] = useState<number | null>(null);
  const [reviveFlash, setReviveFlash] = useState(false);
  const [clearedLines, setClearedLines] = useState<{ rows: number[]; cols: number[] } | null>(null);
  const [cellParticleTrigger, setCellParticleTrigger] = useState(0);
  const [isShattered, setIsShattered] = useState(false);
  const [showGameOverUI, setShowGameOverUI] = useState(false);
  const [placedCells, setPlacedCells] = useState<PlacedCell[]>([]);
  const [placeTrigger, setPlaceTrigger] = useState(0);
  const gameRef = useRef<HTMLDivElement>(null);
  const scoreSavedRef = useRef(false);
  const prevGameOverRef = useRef(false);
  const scorePopKeyRef = useRef(0);
  const boardElRef = useRef<HTMLDivElement>(null);

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

  // Game over — shatter then show UI
  useEffect(() => {
    if (state.isGameOver && !prevGameOverRef.current) {
      playGameOver();
      setIsShattered(true);
      const timer = setTimeout(() => setShowGameOverUI(true), 800);
      return () => clearTimeout(timer);
    }
    if (!state.isGameOver) {
      setIsShattered(false);
      setShowGameOverUI(false);
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

      // Sparkle particles at placed cell positions
      const sparkCells = piece.coords.map(c => ({
        row: row + c.row,
        col: col + c.col,
        color: piece.color,
      }));
      setPlacedCells(sparkCells);
      setPlaceTrigger(t => t + 1);

      const boardAfterPlace = placePiece(state.board, piece, row, col);
      const { rows, cols } = findCompletedLines(boardAfterPlace);
      const linesCleared = rows.length + cols.length;

      if (linesCleared > 0) {
        playClear(state.streak, linesCleared);

        // Check for all-clear
        const boardAfterClear = clearLines(boardAfterPlace, rows, cols);
        const allClear = isBoardEmpty(boardAfterClear);
        if (allClear) playAllClear();

        // Compute points for score pop display
        const clearCells = getClearingCells(rows, cols);
        const points = calculateScore(clearCells.length, linesCleared, state.streak);
        const totalPoints = points + (allClear ? ALL_CLEAR_BONUS : 0);
        setScorePop(totalPoints);
        scorePopKeyRef.current += 1;

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

        // Shockwave lines
        setClearedLines({ rows, cols });

        // Cell particle burst — fires on ALL line clears
        setCellParticleTrigger(t => t + 1);

        // Screen shake — intensity scales with lines cleared
        {
          const el = boardElRef.current;
          if (el) {
            let px: number, py: number, dur: number;
            if (allClear)                      { px = 6;   py = 3;   dur = 450; }
            else if (linesCleared >= 4)         { px = 5;   py = 2;   dur = 380; }
            else if (linesCleared >= 3)         { px = 3.5; py = 1;   dur = 320; }
            else if (linesCleared >= 2)         { px = 2.5; py = 0.5; dur = 280; }
            else                                { px = 1;   py = 0;   dur = 200; }
            el.animate([
              { transform: 'translate(0, 0)' },
              { transform: `translate(${px}px, ${-py}px)` },
              { transform: `translate(${-px}px, ${py * 0.5}px)` },
              { transform: `translate(${px * 0.7}px, ${-py * 0.3}px)` },
              { transform: `translate(${-px * 0.4}px, ${py * 0.2}px)` },
              { transform: `translate(${px * 0.15}px, 0)` },
              { transform: 'translate(0, 0)' },
            ], { duration: dur, easing: 'ease-out' });
          }
        }

        // Confetti — bigger for all-clear
        if (linesCleared >= 2 || allClear) {
          setConfettiCount(allClear ? 30 : 12);
          setConfettiTrigger(t => t + 1);
        }

        // Milestone confetti (if we crossed a milestone)
        const newScore = state.score + totalPoints;
        const crossedMilestone = SCORE_MILESTONES.some(
          m => state.score < m && newScore >= m
        );
        if (crossedMilestone && linesCleared < 2 && !allClear) {
          setConfettiCount(18);
          setConfettiTrigger(t => t + 1);
        }

        // Total time = max stagger delay + cell animation duration
        const maxDelay = (GRID_SIZE - 1) * CLEAR_STAGGER_MS;
        const totalMs = CLEAR_ANIMATION_MS + maxDelay;

        setTimeout(() => {
          setClearingCells(new Map());
          setClearedLines(null);
          setAnimBoard(null);
          setAnimPieces(null);
          setIsAnimating(false);
          setScorePop(null);
          dispatch({ type: 'PLACE_PIECE', pieceIndex, row, col });
        }, totalMs);
      } else {
        dispatch({ type: 'PLACE_PIECE', pieceIndex, row, col });
      }
    },
    [state.board, state.currentPieces, state.streak, state.score]
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
    setReviveFlash(true);
    setTimeout(() => setReviveFlash(false), 600);
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
  const ghostColor = dragState?.piece.color ?? null;

  // Build board container class with streak intensity
  let boardContainerClass = 'board-container';
  if (state.streak > 0) {
    if (state.streak >= 5) {
      boardContainerClass += ' board-container--streak-fire';
    } else if (state.streak >= 3) {
      boardContainerClass += ' board-container--streak-hot';
    } else {
      boardContainerClass += ' board-container--streak';
    }
  }
  if (state.isGameOver && !isShattered) boardContainerClass += ' board-container--gameover';
  if (reviveFlash) boardContainerClass += ' board-container--revive';

  return (
    <div className="game" ref={gameRef} style={{ touchAction: 'none' }}>
      <AmbientParticles />

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

      <div
        className={boardContainerClass}
        ref={(el) => {
          boardRef.current = el;
          boardElRef.current = el;
        }}
      >
        <Board
          board={displayBoard}
          ghostCells={ghostCells}
          clearingCells={clearingCells}
          ghostColor={ghostColor}
          clearedLines={clearedLines}
          isShattered={isShattered}
        />
        <CelebrationText
          text={state.celebrationText}
          onDismiss={handleDismissCelebration}
        />
        <Confetti trigger={confettiTrigger} particleCount={confettiCount} />
        <CellParticles
          clearingCells={clearingCells}
          board={displayBoard}
          trigger={cellParticleTrigger}
        />
        <PlaceSparkles cells={placedCells} trigger={placeTrigger} />
        {scorePop !== null && (
          <div className="score-pop" key={scorePopKeyRef.current}>
            +{scorePop.toLocaleString()}
          </div>
        )}
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

      {showGameOverUI && (
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
