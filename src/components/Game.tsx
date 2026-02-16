import { useReducer, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { gameReducer, createInitialState, createDailyState } from '../game/reducer';
import type { Board as BoardType, GameMode } from '../game/types';
import { getThemeById } from '../game/themes';
import type { BgPalette } from '../game/themes';
import {
  canPlacePiece,
  placePiece,
  findCompletedLines,
  getClearingCells,
  calculateScore,
  clearLines,
  isBoardEmpty,
  getBoardFillRatio,
} from '../game/logic';
import { useDrag } from '../hooks/useDrag';
import {
  CLEAR_ANIMATION_MS,
  CLEAR_STAGGER_MS,
  CLEAR_ANTICIPATION_MS,
  GRID_SIZE,
  ALL_CLEAR_BONUS,
  SCORE_MILESTONES,
  SOLUTION_THRESHOLD,
} from '../game/constants';
import { playPlace, playClear, playAllClear, playGameOver, getVolume, setVolume } from '../audio/sounds';
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
  mode: GameMode;
  dailySeed?: number;
  topScore: number;
  themeId: string;
  onThemeChange: (id: string) => void;
  onQuit: () => void;
  onSaveScore: (score: number) => void;
  onDailyComplete?: (score: number) => void;
  onViewCalendar?: () => void;
};

/** Determine background palette index from score using given palettes */
function getBgPaletteIndex(score: number, palettes: BgPalette[]): number {
  let idx = 0;
  for (let i = palettes.length - 1; i >= 0; i--) {
    if (score >= palettes[i].score) {
      idx = i;
      break;
    }
  }
  return idx;
}

export function Game({ mode, dailySeed, topScore, themeId, onThemeChange, onQuit, onSaveScore, onDailyComplete, onViewCalendar }: GameProps) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => mode === 'daily' && dailySeed !== undefined ? createDailyState(dailySeed) : createInitialState()
  );
  const [clearingCells, setClearingCells] = useState<Map<string, number>>(new Map());
  const [isAnimating, setIsAnimating] = useState(false);
  const [animBoard, setAnimBoard] = useState<BoardType | null>(null);
  const [animPieces, setAnimPieces] = useState<typeof state.currentPieces | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [confettiCount, setConfettiCount] = useState(12);
  const [volume, setVolumeState] = useState(getVolume);
  const [scorePop, setScorePop] = useState<number | null>(null);
  const [scorePopKey, setScorePopKey] = useState(0);
  const [reviveFlash, setReviveFlash] = useState(false);
  const [clearedLines, setClearedLines] = useState<{ rows: number[]; cols: number[] } | null>(null);
  const [cellParticleTrigger, setCellParticleTrigger] = useState(0);
  const [isShattered, setIsShattered] = useState(false);
  const [showGameOverUI, setShowGameOverUI] = useState(false);
  const [placedCells, setPlacedCells] = useState<PlacedCell[]>([]);
  const [placeTrigger, setPlaceTrigger] = useState(0);
  const [preClearCells, setPreClearCells] = useState<Set<string>>(new Set());
  const [screenFlash, setScreenFlash] = useState(false);
  const [settleCells, setSettleCells] = useState<Set<string>>(new Set());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const gameRef = useRef<HTMLDivElement>(null);
  const scoreSavedRef = useRef(false);
  const prevGameOverRef = useRef(false);
  const boardElRef = useRef<HTMLDivElement>(null);

  // --- Offline detection ---
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // --- Background palette cycling (theme-aware) ---
  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const bgPalettes = theme.bgPalettes;
  const bgIndex = useMemo(() => getBgPaletteIndex(state.score, bgPalettes), [state.score, bgPalettes]);

  // Tension signal (0-1): drives background desaturation + particle reactivity
  const stateFillRatio = useMemo(() => getBoardFillRatio(state.board), [state.board]);
  const tension = useMemo(() => {
    const movePressure = Math.min(state.movesSinceLastClear / SOLUTION_THRESHOLD, 1);
    const fillPressure = stateFillRatio < 0.4 ? 0 : Math.min(1, (stateFillRatio - 0.4) / 0.45);
    return Math.min(1, movePressure * 0.6 + fillPressure * 0.4);
  }, [state.movesSinceLastClear, stateFillRatio]);

  // Pressure signal (0-1): drives board-edge vignette, with dead zone
  const pressure = useMemo(() => {
    const raw = state.movesSinceLastClear / SOLUTION_THRESHOLD;
    return raw < 0.25 ? 0 : Math.min(1, (raw - 0.25) / 0.75);
  }, [state.movesSinceLastClear]);

  useEffect(() => {
    const palette = bgPalettes[bgIndex];
    const root = document.documentElement;

    if (tension > 0.05) {
      // Interpolate toward tense variant using color-mix in oklch
      const pct = Math.round(tension * 100);
      root.style.setProperty('--bg', `color-mix(in oklch, ${palette.bg} ${100 - pct}%, ${palette.bgTense})`);
      root.style.setProperty('--bg-dark', `color-mix(in oklch, ${palette.bgDark} ${100 - pct}%, ${palette.bgDarkTense})`);
    } else {
      root.style.setProperty('--bg', palette.bg);
      root.style.setProperty('--bg-dark', palette.bgDark);
    }

    return () => {
      // Reset to theme default when leaving game
      root.style.setProperty('--bg', bgPalettes[0].bg);
      root.style.setProperty('--bg-dark', bgPalettes[0].bgDark);
    };
  }, [bgIndex, bgPalettes, tension]);

  // Reset save flag on new game
  useEffect(() => {
    if (!state.isGameOver) {
      scoreSavedRef.current = false;
    }
  }, [state.isGameOver]);

  // Game over — shatter then show UI, save daily result
  useEffect(() => {
    let shatterTimer: ReturnType<typeof setTimeout> | null = null;
    let showUiTimer: ReturnType<typeof setTimeout> | null = null;

    if (state.isGameOver && !prevGameOverRef.current) {
      playGameOver();
      if (mode === 'daily' && onDailyComplete) {
        onDailyComplete(state.score);
      }
      shatterTimer = setTimeout(() => setIsShattered(true), 0);
      showUiTimer = setTimeout(() => setShowGameOverUI(true), 800);
    }
    if (!state.isGameOver && prevGameOverRef.current) {
      shatterTimer = setTimeout(() => setIsShattered(false), 0);
      showUiTimer = setTimeout(() => setShowGameOverUI(false), 0);
    }

    prevGameOverRef.current = state.isGameOver;

    return () => {
      if (shatterTimer) clearTimeout(shatterTimer);
      if (showUiTimer) clearTimeout(showUiTimer);
    };
  }, [state.isGameOver, mode, onDailyComplete, state.score]);

  const prevVolumeRef = useRef(80);

  const handleVolumeChange = useCallback((v: number) => {
    setVolumeState(v);
    setVolume(v);
    if (v > 0) prevVolumeRef.current = v;
  }, []);

  const handleToggleMute = useCallback(() => {
    if (volume === 0) {
      const restore = prevVolumeRef.current > 0 ? prevVolumeRef.current : 80;
      handleVolumeChange(restore);
    } else {
      prevVolumeRef.current = volume;
      handleVolumeChange(0);
    }
  }, [volume, handleVolumeChange]);

  const handleDrop = useCallback(
    (pieceIndex: number, row: number, col: number) => {
      const piece = state.currentPieces[pieceIndex];
      if (!piece) return;
      if (!canPlacePiece(state.board, piece, row, col)) return;

      // Danger level for audio thinning — compute from current board
      const fr = getBoardFillRatio(state.board);
      const dl = fr >= 0.85 ? 2 : fr >= 0.75 ? 1 : 0;
      playPlace(dl);

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
        // Check for all-clear
        const boardAfterClear = clearLines(boardAfterPlace, rows, cols);
        const allClear = isBoardEmpty(boardAfterClear);

        // Compute points for score pop display
        const clearCells = getClearingCells(rows, cols);
        const points = calculateScore(clearCells.length, linesCleared, state.streak);
        const totalPoints = points + (allClear ? ALL_CLEAR_BONUS : 0);

        // Build staggered delay map (used in phase 2)
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

        // --- Phase 1: Anticipation (all cells pulse simultaneously) ---
        playClear(state.streak, linesCleared);
        if (allClear) playAllClear();

        setPreClearCells(new Set(cellMap.keys()));
        setAnimBoard(boardAfterPlace);
        const newPieces = [...state.currentPieces];
        newPieces[pieceIndex] = null;
        setAnimPieces(newPieces);
        setIsAnimating(true);
        setScorePop(totalPoints);
        setScorePopKey(k => k + 1);

        // --- Phase 2: After anticipation, fire cascade + effects ---
        setTimeout(() => {
          setPreClearCells(new Set());
          setClearingCells(cellMap);
          setClearedLines({ rows, cols });
          setCellParticleTrigger(t => t + 1);

          // Screen shake — intensity scales with lines cleared
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

          // Screen flash on multi-clears
          if (linesCleared >= 2 || allClear) {
            setScreenFlash(true);
            setTimeout(() => setScreenFlash(false), 200);
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
        }, CLEAR_ANTICIPATION_MS);

        // --- Phase 3: Animation complete, dispatch ---
        const maxDelay = (GRID_SIZE - 1) * CLEAR_STAGGER_MS;
        const totalMs = CLEAR_ANTICIPATION_MS + CLEAR_ANIMATION_MS + maxDelay;

        setTimeout(() => {
          // Post-clear settle bounce: cells adjacent to cleared cells that survived
          const boardAfterClear = clearLines(boardAfterPlace, rows, cols);
          const settleSet = new Set<string>();
          for (const key of cellMap.keys()) {
            const [cr, cc] = key.split(',').map(Number);
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as const) {
              const nr = cr + dr;
              const nc = cc + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
                const nk = `${nr},${nc}`;
                if (!cellMap.has(nk) && boardAfterClear[nr][nc] !== null) {
                  settleSet.add(nk);
                }
              }
            }
          }
          setSettleCells(settleSet);
          setTimeout(() => setSettleCells(new Set()), 350);

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
    if (mode === 'daily' && dailySeed !== undefined) {
      dispatch({ type: 'NEW_DAILY_GAME', seed: dailySeed });
    } else {
      dispatch({ type: 'NEW_GAME' });
    }
  }, [mode, dailySeed]);

  const isNewHighScore = state.score > 0 && state.score >= topScore && state.isGameOver;
  const ghostColor = dragState?.piece.color ?? null;

  // Board danger level based on fill ratio
  const fillRatio = useMemo(() => getBoardFillRatio(displayBoard), [displayBoard]);
  const dangerLevel = fillRatio >= 0.85 ? 2 : fillRatio >= 0.75 ? 1 : 0;

  // Ghost cells that would complete a line — glow brighter as anticipation cue
  const ghostCompletingCells = useMemo(() => {
    if (!dragState || !dragState.isValid || dragState.boardRow === null || dragState.boardCol === null) {
      return undefined;
    }
    const simBoard = placePiece(displayBoard, dragState.piece, dragState.boardRow, dragState.boardCol);
    const { rows, cols } = findCompletedLines(simBoard);
    if (rows.length === 0 && cols.length === 0) return undefined;

    const completing = new Set<string>();
    for (const key of ghostCells.keys()) {
      const [r, c] = key.split(',').map(Number);
      if (rows.includes(r) || cols.includes(c)) {
        completing.add(key);
      }
    }
    return completing.size > 0 ? completing : undefined;
  }, [dragState, displayBoard, ghostCells]);

  // Build board container class with streak intensity (5 tiers)
  let boardContainerClass = 'board-container';
  if (state.streak > 0) {
    if (state.streak >= 11) {
      boardContainerClass += ' board-container--streak-supernova';
    } else if (state.streak >= 8) {
      boardContainerClass += ' board-container--streak-whitehot';
    } else if (state.streak >= 5) {
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
      {isOffline && <div className="offline-badge">Offline</div>}
      <AmbientParticles
        tension={tension}
        streak={state.streak}
        clearBurst={cellParticleTrigger}
      />

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
        style={{ '--pressure': pressure } as React.CSSProperties}
        ref={(el) => {
          boardRef.current = el;
          boardElRef.current = el;
        }}
      >
        <Board
          board={displayBoard}
          ghostCells={ghostCells}
          ghostCompletingCells={ghostCompletingCells}
          clearingCells={clearingCells}
          preClearCells={preClearCells}
          ghostColor={ghostColor}
          clearedLines={clearedLines}
          isShattered={isShattered}
          dangerLevel={dangerLevel}
          settleCells={settleCells}
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
          <div className="score-pop" key={scorePopKey}>
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

      {state.mode === 'classic' && state.undoSnapshot && state.undosRemaining > 0 && !isAnimating && !state.isGameOver && (
        <button className="undo-btn" onClick={() => dispatch({ type: 'UNDO' })} aria-label="Undo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Undo
        </button>
      )}

      <DragOverlay dragState={dragState} />

      {screenFlash && <div className="screen-flash" />}

      {isPaused && !state.isGameOver && (
        <PauseMenu
          volume={volume}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
          themeId={themeId}
          onThemeChange={onThemeChange}
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
          mode={mode}
          onRevive={handleRevive}
          onPlayAgain={handlePlayAgain}
          onQuit={handleQuit}
          onViewCalendar={onViewCalendar}
        />
      )}
    </div>
  );
}
