import { useReducer, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { gameReducer, createInitialState, createDailyState } from '../game/reducer';
import type { Board as BoardType, GameMode, PlayerStats, AchievementProgress } from '../game/types';
import { getThemeById } from '../game/themes';
import type { BgPalette } from '../game/themes';
import { shouldCommitOnGameOver, shouldCommitOnExitFromGameOver } from '../game/persistence';
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
import { playPlace, playClear, playAllClear, playGameOver, playRevive, playMilestone, getVolume, setVolume, getSfxEnabled, setSfxEnabled } from '../audio/sounds';
import { Board } from './Board';
import { PieceTray } from './PieceTray';
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
  onDailyComplete?: (score: number) => void;
  onViewCalendar?: () => void;
  onStatsUpdate?: (updater: (prev: PlayerStats) => PlayerStats) => void;
  onGameContextUpdate?: (ctx: { currentGameScore?: number; currentGameRevivesRemaining?: number; lastClearCount?: number | null }) => void;
  onGameOver?: (score: number, revivesRemaining: number, mode: GameMode) => void;
  unlockedAchievements?: AchievementProgress;
};

type InterpolatedBg = { bg: string; bgDark: string; bgTense: string; bgDarkTense: string };
const DRAG_LINE_PREVIEW_ENABLED = true;

/** Continuously interpolate between adjacent palette stops based on exact score */
function getInterpolatedBg(score: number, palettes: BgPalette[]): InterpolatedBg {
  // Find lower bound
  let lo = 0;
  for (let i = palettes.length - 1; i >= 0; i--) {
    if (score >= palettes[i].score) { lo = i; break; }
  }
  // At or beyond last stop — return final palette directly
  if (lo >= palettes.length - 1) {
    const p = palettes[palettes.length - 1];
    return { bg: p.bg, bgDark: p.bgDark, bgTense: p.bgTense, bgDarkTense: p.bgDarkTense };
  }
  const lower = palettes[lo];
  const upper = palettes[lo + 1];
  const upperPct = Math.round(((score - lower.score) / (upper.score - lower.score)) * 100);
  // No mix needed at exact boundary
  if (upperPct <= 0) {
    return { bg: lower.bg, bgDark: lower.bgDark, bgTense: lower.bgTense, bgDarkTense: lower.bgDarkTense };
  }
  const mix = (a: string, b: string) => `color-mix(in oklch, ${a} ${100 - upperPct}%, ${b})`;
  return {
    bg: mix(lower.bg, upper.bg),
    bgDark: mix(lower.bgDark, upper.bgDark),
    bgTense: mix(lower.bgTense, upper.bgTense),
    bgDarkTense: mix(lower.bgDarkTense, upper.bgDarkTense),
  };
}

export function Game({ mode, dailySeed, topScore, themeId, onThemeChange, onQuit, onDailyComplete, onViewCalendar, onStatsUpdate, onGameContextUpdate, onGameOver, unlockedAchievements }: GameProps) {
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
  const [sfxOn, setSfxOn] = useState(getSfxEnabled);
  const gameRef = useRef<HTMLDivElement>(null);
  const prevGameOverRef = useRef(false);
  const boardElRef = useRef<HTMLDivElement>(null);
  const prevMilestoneRef = useRef(0);
  const scoreCommittedRef = useRef(false);
  const activeTimerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animationRunRef = useRef(0);

  const clearActiveTimers = useCallback(() => {
    for (const timerId of activeTimerIdsRef.current) {
      clearTimeout(timerId);
    }
    activeTimerIdsRef.current = [];
  }, []);

  const scheduleTimer = useCallback((callback: () => void, delayMs: number) => {
    const timerId = setTimeout(() => {
      activeTimerIdsRef.current = activeTimerIdsRef.current.filter(id => id !== timerId);
      callback();
    }, delayMs);
    activeTimerIdsRef.current.push(timerId);
    return timerId;
  }, []);

  const resetTransientAnimation = useCallback(() => {
    animationRunRef.current += 1;
    clearActiveTimers();
    setPreClearCells(new Set());
    setClearingCells(new Map());
    setClearedLines(null);
    setAnimBoard(null);
    setAnimPieces(null);
    setSettleCells(new Set());
    setScreenFlash(false);
    setScorePop(null);
    setReviveFlash(false);
    setIsAnimating(false);
  }, [clearActiveTimers]);

  const commitGameOverIfNeeded = useCallback(() => {
    if (scoreCommittedRef.current) return;
    if (!onGameOver) return;
    onGameOver(state.score, state.revivesRemaining, mode);
    scoreCommittedRef.current = true;
  }, [onGameOver, state.score, state.revivesRemaining, mode]);

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

  useEffect(() => {
    return () => {
      clearActiveTimers();
    };
  }, [clearActiveTimers]);

  // --- Background palette cycling (theme-aware) ---
  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const bgPalettes = theme.bgPalettes;
  const interpolatedBg = useMemo(() => getInterpolatedBg(state.score, bgPalettes), [state.score, bgPalettes]);

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
    const root = document.documentElement;

    if (tension > 0.05) {
      // Interpolate toward tense variant using color-mix in oklch
      const pct = Math.round(tension * 100);
      root.style.setProperty('--bg', `color-mix(in oklch, ${interpolatedBg.bg} ${100 - pct}%, ${interpolatedBg.bgTense})`);
      root.style.setProperty('--bg-dark', `color-mix(in oklch, ${interpolatedBg.bgDark} ${100 - pct}%, ${interpolatedBg.bgDarkTense})`);
    } else {
      root.style.setProperty('--bg', interpolatedBg.bg);
      root.style.setProperty('--bg-dark', interpolatedBg.bgDark);
    }

    return () => {
      // Reset to theme default when leaving game
      root.style.setProperty('--bg', bgPalettes[0].bg);
      root.style.setProperty('--bg-dark', bgPalettes[0].bgDark);
    };
  }, [interpolatedBg, bgPalettes, tension]);

  // Game over — shatter then show UI, save daily result
  useEffect(() => {
    let shatterTimer: ReturnType<typeof setTimeout> | null = null;
    let showUiTimer: ReturnType<typeof setTimeout> | null = null;

    if (state.isGameOver && !prevGameOverRef.current) {
      playGameOver();
      if (mode === 'daily' && onDailyComplete) {
        onDailyComplete(state.score);
      }
      if (shouldCommitOnGameOver(mode, state.revivesRemaining)) {
        commitGameOverIfNeeded();
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
  }, [state.isGameOver, mode, onDailyComplete, state.score, state.revivesRemaining, commitGameOverIfNeeded]);

  // Milestone audio — fires whenever a score milestone is crossed
  useEffect(() => {
    if (state.lastMilestone > prevMilestoneRef.current) {
      playMilestone();
    }
    prevMilestoneRef.current = state.lastMilestone;
  }, [state.lastMilestone]);

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

  const handleSfxToggle = useCallback(() => {
    setSfxOn((prev: boolean) => {
      const next = !prev;
      setSfxEnabled(next);
      return next;
    });
  }, []);

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

      // Stats: piece placed
      if (onStatsUpdate) {
        const newStreak = linesCleared > 0 ? state.streak + 1 : 0;
        onStatsUpdate(prev => ({
          ...prev,
          totalPiecesPlaced: prev.totalPiecesPlaced + 1,
          totalLinesCleared: prev.totalLinesCleared + linesCleared,
          bestStreak: Math.max(prev.bestStreak, newStreak),
          allClearCount: prev.allClearCount + (linesCleared > 0 && isBoardEmpty(clearLines(boardAfterPlace, rows, cols)) ? 1 : 0),
        }));
      }
      // Update game context for achievement checking
      if (onGameContextUpdate) {
        const clearCellsForCtx = getClearingCells(rows, cols);
        const pointsForCtx = linesCleared > 0 ? calculateScore(clearCellsForCtx.length, linesCleared, state.streak) + (isBoardEmpty(clearLines(boardAfterPlace, rows, cols)) ? ALL_CLEAR_BONUS : 0) : 0;
        onGameContextUpdate({
          currentGameScore: state.score + pointsForCtx,
          currentGameRevivesRemaining: state.revivesRemaining,
          lastClearCount: linesCleared > 0 ? linesCleared : null,
        });
      }

      if (linesCleared > 0) {
        clearActiveTimers();
        const animationRunId = animationRunRef.current + 1;
        animationRunRef.current = animationRunId;

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
        scheduleTimer(() => {
          if (animationRunRef.current !== animationRunId) return;

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
            scheduleTimer(() => {
              if (animationRunRef.current !== animationRunId) return;
              setScreenFlash(false);
            }, 200);
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

        scheduleTimer(() => {
          if (animationRunRef.current !== animationRunId) return;

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
          scheduleTimer(() => {
            if (animationRunRef.current !== animationRunId) return;
            setSettleCells(new Set());
          }, 350);

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
    [state.board, state.currentPieces, state.streak, state.score, state.revivesRemaining, onStatsUpdate, onGameContextUpdate, clearActiveTimers, scheduleTimer]
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
    const moveEvent = ('onpointerrawupdate' in window ? 'pointerrawupdate' : 'pointermove') as 'pointerrawupdate' | 'pointermove';

    const handleMove = (e: Event | PointerEvent) => {
      if (!(e instanceof PointerEvent)) return;
      // Use the freshest coalesced sample to reduce input lag under heavy event bursts.
      const coalesced = typeof e.getCoalescedEvents === 'function'
        ? e.getCoalescedEvents()
        : [];
      const latest = coalesced.length > 0 ? coalesced[coalesced.length - 1] : e;
      onPointerMove(latest.clientX, latest.clientY);
    };
    const handleUp = (e: PointerEvent) => {
      onPointerUp(e.clientX, e.clientY);
    };
    const handleCancel = () => {
      cancelDrag();
    };

    document.addEventListener(moveEvent, handleMove, { passive: true });
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleCancel);

    return () => {
      document.removeEventListener(moveEvent, handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleCancel);
    };
  }, [onPointerMove, onPointerUp, cancelDrag]);

  const handlePlayAgain = useCallback(() => {
    if (state.isGameOver && shouldCommitOnExitFromGameOver(mode, state.revivesRemaining)) {
      commitGameOverIfNeeded();
    }
    resetTransientAnimation();
    scoreCommittedRef.current = false;
    dispatch({ type: 'NEW_GAME' });
  }, [resetTransientAnimation, state.isGameOver, state.revivesRemaining, commitGameOverIfNeeded, mode]);

  const handleRevive = useCallback(() => {
    resetTransientAnimation();
    playRevive();
    dispatch({ type: 'REVIVE' });
    setReviveFlash(true);
    setTimeout(() => setReviveFlash(false), 600);
  }, [resetTransientAnimation]);

  const handleQuit = useCallback(() => {
    if (state.isGameOver && shouldCommitOnExitFromGameOver(mode, state.revivesRemaining)) {
      commitGameOverIfNeeded();
    }
    resetTransientAnimation();
    scoreCommittedRef.current = false;
    onQuit();
  }, [onQuit, resetTransientAnimation, state.isGameOver, state.revivesRemaining, commitGameOverIfNeeded, mode]);

  const handleDismissCelebration = useCallback(() => {
    dispatch({ type: 'DISMISS_CELEBRATION' });
  }, []);

  const handleRestart = useCallback(() => {
    resetTransientAnimation();
    setIsPaused(false);
    scoreCommittedRef.current = false;
    if (mode === 'daily' && dailySeed !== undefined) {
      dispatch({ type: 'NEW_DAILY_GAME', seed: dailySeed });
    } else {
      dispatch({ type: 'NEW_GAME' });
    }
  }, [mode, dailySeed, resetTransientAnimation]);

  const isNewHighScore = state.score > 0 && state.score >= topScore && state.isGameOver;
  const ghostColor = dragState?.piece.color ?? null;

  // Board danger level based on fill ratio
  const fillRatio = useMemo(() => getBoardFillRatio(displayBoard), [displayBoard]);
  const dangerLevel = fillRatio >= 0.85 ? 2 : fillRatio >= 0.75 ? 1 : 0;

  // Ghost cells that would complete a line — glow brighter as anticipation cue
  // + preview all cells in completing rows/cols
  const { ghostCompletingCells, previewClearCells } = useMemo(() => {
    if (!DRAG_LINE_PREVIEW_ENABLED) {
      return { ghostCompletingCells: undefined, previewClearCells: undefined };
    }

    if (!dragState || !dragState.isValid || dragState.boardRow === null || dragState.boardCol === null) {
      return { ghostCompletingCells: undefined, previewClearCells: undefined };
    }
    const simBoard = placePiece(displayBoard, dragState.piece, dragState.boardRow, dragState.boardCol);
    const { rows, cols } = findCompletedLines(simBoard);
    if (rows.length === 0 && cols.length === 0) {
      return { ghostCompletingCells: undefined, previewClearCells: undefined };
    }

    const completing = new Set<string>();
    for (const key of ghostCells.keys()) {
      const [r, c] = key.split(',').map(Number);
      if (rows.includes(r) || cols.includes(c)) {
        completing.add(key);
      }
    }

    // All cells in the completing rows/cols (excluding ghost cells — they have their own style)
    const preview = new Set<string>();
    for (const row of rows) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const key = `${row},${c}`;
        if (!ghostCells.has(key)) preview.add(key);
      }
    }
    for (const col of cols) {
      for (let r = 0; r < GRID_SIZE; r++) {
        const key = `${r},${col}`;
        if (!ghostCells.has(key)) preview.add(key);
      }
    }

    return {
      ghostCompletingCells: completing.size > 0 ? completing : undefined,
      previewClearCells: preview.size > 0 ? preview : undefined,
    };
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
          boardElRef.current = el;
        }}
      >
        <Board
          boardRef={boardRef}
          board={displayBoard}
          ghostCells={ghostCells}
          ghostCompletingCells={ghostCompletingCells}
          previewClearCells={previewClearCells}
          clearingCells={clearingCells}
          preClearCells={preClearCells}
          ghostColor={ghostColor}
          clearedLines={clearedLines}
          isShattered={isShattered}
          dangerLevel={dangerLevel}
          settleCells={settleCells}
          isDragging={dragState !== null}
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
          <div
            className="score-pop"
            key={scorePopKey}
          >
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

      {screenFlash && <div className="screen-flash" />}

      {isPaused && !state.isGameOver && (
        <PauseMenu
          volume={volume}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
          sfxOn={sfxOn}
          onSfxToggle={handleSfxToggle}
          themeId={themeId}
          onThemeChange={onThemeChange}
          onResume={() => setIsPaused(false)}
          onRestart={handleRestart}
          onQuit={handleQuit}
          unlockedAchievements={unlockedAchievements ?? {}}
        />
      )}

      {showGameOverUI && (
        <GameOver
          score={state.score}
          highScore={topScore}
          isNewHighScore={isNewHighScore}
          revivesRemaining={state.revivesRemaining}
          mode={mode}
          piecesPlaced={state.gamePiecesPlaced}
          linesCleared={state.gameLinesCleared}
          bestStreak={state.gameBestStreak}
          onRevive={handleRevive}
          onPlayAgain={handlePlayAgain}
          onQuit={handleQuit}
          onViewCalendar={onViewCalendar}
        />
      )}
    </div>
  );
}
