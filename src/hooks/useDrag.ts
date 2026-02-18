import { useRef, useCallback, useState, useEffect, startTransition } from 'react';
import type { PieceShape, DragState, GhostCells, Board } from '../game/types';
import { canPlacePiece } from '../game/logic';
import { GRID_SIZE } from '../game/constants';
import { getCSSPx } from '../game/responsive';
import { getPieceBounds } from '../game/pieces';
import '../components/DragOverlay.css';

export function useDrag(
  board: Board,
  onDrop: (pieceIndex: number, row: number, col: number) => void,
  isAnimating: boolean
) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [ghostCells, setGhostCells] = useState<GhostCells>(new Map());
  const boardRef = useRef<HTMLDivElement>(null);

  // Internal refs — never trigger React re-renders
  const dragRef = useRef<DragState | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const boardPaddingRef = useRef(0);
  const totalCellRef = useRef(0);
  const fingerOffsetRef = useRef(0);
  const pieceRowsRef = useRef(0);
  const pieceColsRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastGridRef = useRef<{ row: number | null; col: number | null }>({ row: null, col: null });

  // Imperative overlay — no React involvement
  const overlayElRef = useRef<HTMLDivElement | null>(null);
  const overlayHalfW = useRef(0);
  const overlayHalfH = useRef(0);
  const overlayFingerOffset = useRef(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const el = overlayElRef.current;
      if (el?.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  // --- Imperative overlay helpers (pure DOM, zero React) ---

  function createOverlayEl(piece: PieceShape, cellSize: number, cellGap: number): HTMLDivElement {
    const { rows, cols } = getPieceBounds(piece.coords);
    const coordSet = new Set(piece.coords.map(co => `${co.row},${co.col}`));

    const overlay = document.createElement('div');
    overlay.className = 'drag-overlay';
    const w = cols * (cellSize + cellGap) - cellGap;
    const h = rows * (cellSize + cellGap) - cellGap;
    overlay.style.width = w + 'px';
    overlay.style.height = h + 'px';

    const grid = document.createElement('div');
    grid.className = 'drag-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', ' + cellSize + 'px)';
    grid.style.gridTemplateRows = 'repeat(' + rows + ', ' + cellSize + 'px)';
    grid.style.gap = cellGap + 'px';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (coordSet.has(r + ',' + c)) {
          const cell = document.createElement('div');
          cell.className = 'drag-cell';
          cell.style.backgroundColor = piece.color;
          cell.style.gridColumn = '' + (c + 1);
          cell.style.gridRow = '' + (r + 1);
          grid.appendChild(cell);
        }
      }
    }

    overlay.appendChild(grid);
    overlayHalfW.current = w / 2;
    overlayHalfH.current = h / 2;
    return overlay;
  }

  function moveOverlay(clientX: number, clientY: number) {
    const el = overlayElRef.current;
    if (!el) return;
    const x = clientX - overlayHalfW.current;
    const y = clientY - overlayFingerOffset.current - overlayHalfH.current;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function removeOverlay() {
    const el = overlayElRef.current;
    if (el?.parentNode) el.parentNode.removeChild(el);
    overlayElRef.current = null;
  }

  // --- Grid position (uses cached refs, no allocations) ---

  const computeGridPos = useCallback(
    (clientX: number, clientY: number) => {
      const rect = rectRef.current;
      if (!rect) return { row: null, col: null, isValid: false };

      const totalCell = totalCellRef.current;
      const relX = clientX - rect.left - boardPaddingRef.current - (pieceColsRef.current * totalCell) / 2;
      const relY = clientY - rect.top - boardPaddingRef.current - fingerOffsetRef.current - (pieceRowsRef.current * totalCell) / 2;

      const col = Math.round(relX / totalCell);
      const row = Math.round(relY / totalCell);

      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return { row: null, col: null, isValid: false };
      }

      const piece = dragRef.current?.piece;
      if (!piece) return { row: null, col: null, isValid: false };

      const isValid = canPlacePiece(board, piece, row, col);
      return { row, col, isValid };
    },
    [board]
  );

  // --- Update ghost + React state (only when grid cell changes) ---

  function updateGridState(row: number | null, col: number | null, isValid: boolean) {
    const last = lastGridRef.current;
    if (row === last.row && col === last.col) return;
    lastGridRef.current = { row, col };

    const latest = dragRef.current;
    if (!latest) return;

    const newState: DragState = { ...latest, boardRow: row, boardCol: col, isValid };
    dragRef.current = newState;

    // Low-priority update — React yields to pointer events between render chunks
    startTransition(() => {
      setDragState(newState);

      const ghost: GhostCells = new Map();
      if (row !== null && col !== null) {
        for (const coord of latest.piece.coords) {
          const r = row + coord.row;
          const c = col + coord.col;
          if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
            ghost.set(`${r},${c}`, isValid);
          }
        }
      }
      setGhostCells(ghost);
    });
  }

  // --- Pointer handlers ---

  const onPointerDown = useCallback(
    (piece: PieceShape, pieceIndex: number, clientX: number, clientY: number) => {
      if (isAnimating) return;

      // Clean up any leftover overlay
      removeOverlay();

      // Cache board geometry once
      const boardEl = boardRef.current;
      if (boardEl) {
        rectRef.current = boardEl.getBoundingClientRect();
        const computed = getComputedStyle(boardEl);
        boardPaddingRef.current = parseFloat(computed.paddingLeft) || 0;
      }
      const cellGap = getCSSPx('--cell-gap');
      const cellSize = getCSSPx('--cell-size');
      totalCellRef.current = cellSize + cellGap;
      const fingerOffset = getCSSPx('--finger-offset');
      fingerOffsetRef.current = fingerOffset;
      overlayFingerOffset.current = fingerOffset;

      // Cache piece bounds
      const { rows: pRows, cols: pCols } = getPieceBounds(piece.coords);
      pieceRowsRef.current = pRows;
      pieceColsRef.current = pCols;

      // Create imperative overlay + position it instantly
      const overlayEl = createOverlayEl(piece, cellSize, cellGap);
      document.body.appendChild(overlayEl);
      overlayElRef.current = overlayEl;
      moveOverlay(clientX, clientY);

      // Minimal React state — only for ghost/preview in Game.tsx
      const state: DragState = {
        piece,
        pieceIndex,
        boardRow: null,
        boardCol: null,
        isValid: false,
      };
      dragRef.current = state;
      setDragState(state);
      lastGridRef.current = { row: null, col: null };

      // Initial ghost computation
      const { row, col, isValid } = computeGridPos(clientX, clientY);
      updateGridState(row, col, isValid);
    },
    [isAnimating, computeGridPos]
  );

  const onPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragRef.current) return;

      // INSTANT — direct DOM, zero React overhead
      moveOverlay(clientX, clientY);

      // DEFERRED — ghost/preview only when grid cell changes
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!dragRef.current) return;
        const { row, col, isValid } = computeGridPos(clientX, clientY);
        updateGridState(row, col, isValid);
      });
    },
    [computeGridPos]
  );

  const onPointerUp = useCallback((clientX?: number, clientY?: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const current = dragRef.current;
    if (!current) return;

    // Synchronous final position to avoid stale rAF on fast flicks
    let finalRow = current.boardRow;
    let finalCol = current.boardCol;
    let finalValid = current.isValid;
    if (clientX !== undefined && clientY !== undefined) {
      const { row, col, isValid } = computeGridPos(clientX, clientY);
      finalRow = row;
      finalCol = col;
      finalValid = isValid;
    }

    if (finalRow !== null && finalCol !== null && finalValid) {
      onDrop(current.pieceIndex, finalRow, finalCol);
    }

    removeOverlay();
    dragRef.current = null;
    rectRef.current = null;
    lastGridRef.current = { row: null, col: null };
    setDragState(null);
    setGhostCells(new Map());
  }, [onDrop, computeGridPos]);

  const cancelDrag = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    removeOverlay();
    dragRef.current = null;
    rectRef.current = null;
    lastGridRef.current = { row: null, col: null };
    setDragState(null);
    setGhostCells(new Map());
  }, []);

  return {
    dragState,
    ghostCells,
    boardRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    cancelDrag,
  };
}
