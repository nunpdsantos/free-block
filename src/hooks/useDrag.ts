import { useRef, useCallback, useState, useEffect, startTransition } from 'react';
import type { PieceShape, DragState, GhostCells, Board } from '../game/types';
import { canPlacePiece } from '../game/logic';
import { GRID_SIZE, FINGER_OFFSET } from '../game/constants';
import { getCSSPx } from '../game/responsive';
import { getPieceBounds } from '../game/pieces';
import '../components/DragOverlay.css';

const SNAP_RADIUS_DRAG = 1;
const SNAP_RADIUS_DROP = 2;
const LIVE_DRAG_PREVIEW_ENABLED = true;

export function useDrag(
  board: Board,
  onDrop: (pieceIndex: number, row: number, col: number) => void,
  isAnimating: boolean
) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [ghostCells, setGhostCells] = useState<GhostCells>(new Map());
  const boardRef = useRef<HTMLDivElement>(null);

  // Stable refs for props — avoids cascading useCallback recreation on every board change
  const boardStateRef = useRef(board);
  const onDropRef = useRef(onDrop);
  const isAnimatingRef = useRef(isAnimating);
  boardStateRef.current = board;
  onDropRef.current = onDrop;
  isAnimatingRef.current = isAnimating;

  // Internal refs — never trigger React re-renders
  const dragRef = useRef<DragState | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const boardPaddingRef = useRef(0);
  const totalCellRef = useRef(0);
  const cellGapRef = useRef(0);
  const pieceRowsRef = useRef(0);
  const pieceColsRef = useRef(0);
  const lastGridRef = useRef<{ row: number | null; col: number | null }>({ row: null, col: null });
  const rafIdRef = useRef(0);
  const pendingCoordsRef = useRef<{ clientX: number; clientY: number } | null>(null);

  // Imperative overlay — no React involvement
  const overlayElRef = useRef<HTMLDivElement | null>(null);
  const overlayWRef = useRef(0);
  const overlayHRef = useRef(0);
  const grabFracXRef = useRef(0.5);
  const grabFracYRef = useRef(0.5);
  const pointerOffsetYRef = useRef(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
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
    overlayWRef.current = w;
    overlayHRef.current = h;
    return overlay;
  }

  function moveOverlay(clientX: number, clientY: number) {
    const el = overlayElRef.current;
    if (!el) return;
    const anchorX = overlayWRef.current * grabFracXRef.current;
    const anchorY = overlayHRef.current * grabFracYRef.current;
    const adjustedY = clientY - pointerOffsetYRef.current;
    const x = clientX - anchorX;
    const y = adjustedY - anchorY;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function removeOverlay() {
    const el = overlayElRef.current;
    if (el?.parentNode) el.parentNode.removeChild(el);
    overlayElRef.current = null;
  }

  const findNearestValidPlacement = useCallback((
    piece: PieceShape,
    rawRow: number,
    rawCol: number,
    maxRadius: number
  ): { row: number; col: number } | null => {
    const currentBoard = boardStateRef.current;
    for (let radius = 0; radius <= maxRadius; radius++) {
      let bestInRing: { row: number; col: number; dist2: number } | null = null;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          const row = rawRow + dr;
          const col = rawCol + dc;
          if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) continue;
          if (!canPlacePiece(currentBoard, piece, row, col)) continue;

          const dist2 = dr * dr + dc * dc;
          if (!bestInRing || dist2 < bestInRing.dist2) {
            bestInRing = { row, col, dist2 };
          }
        }
      }
      if (bestInRing) return { row: bestInRing.row, col: bestInRing.col };
    }
    return null;
  }, []);

  // --- Grid position (uses cached refs, no allocations) ---

  const computeGridPos = useCallback(
    (clientX: number, clientY: number, snapRadius: number = SNAP_RADIUS_DRAG) => {
      const rect = rectRef.current;
      if (!rect) return { row: null, col: null, isValid: false };

      const totalCell = totalCellRef.current;
      const pieceW = pieceColsRef.current * totalCell - cellGapRef.current;
      const pieceH = pieceRowsRef.current * totalCell - cellGapRef.current;
      const anchorX = pieceW * grabFracXRef.current;
      const anchorY = pieceH * grabFracYRef.current;
      const adjustedY = clientY - pointerOffsetYRef.current;
      const relX = clientX - rect.left - boardPaddingRef.current - anchorX;
      const relY = adjustedY - rect.top - boardPaddingRef.current - anchorY;

      const col = Math.round(relX / totalCell);
      const row = Math.round(relY / totalCell);

      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return { row: null, col: null, isValid: false };
      }

      const piece = dragRef.current?.piece;
      if (!piece) return { row: null, col: null, isValid: false };

      const snapped = findNearestValidPlacement(piece, row, col, snapRadius);
      if (snapped) {
        return { row: snapped.row, col: snapped.col, isValid: true };
      }

      return { row, col, isValid: false };
    },
    [findNearestValidPlacement]
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

    if (!LIVE_DRAG_PREVIEW_ENABLED) return;

    // Non-urgent transition — React can interrupt Board re-render for pointer events
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
    (
      piece: PieceShape,
      pieceIndex: number,
      clientX: number,
      clientY: number,
      grabFracX: number = 0.5,
      grabFracY: number = 0.5,
      pointerType: string = 'mouse'
    ) => {
      if (isAnimatingRef.current) return;

      // Clean up any leftover overlay (including animated drop overlays)
      removeOverlay();
      const stale = document.querySelector('.drag-overlay');
      if (stale) stale.remove();

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
      cellGapRef.current = cellGap;
      grabFracXRef.current = Math.min(1, Math.max(0, grabFracX));
      grabFracYRef.current = Math.min(1, Math.max(0, grabFracY));
      pointerOffsetYRef.current = pointerType === 'touch' ? FINGER_OFFSET : 0;

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
      if (LIVE_DRAG_PREVIEW_ENABLED) {
        const { row, col, isValid } = computeGridPos(clientX, clientY, SNAP_RADIUS_DRAG);
        updateGridState(row, col, isValid);
      }
    },
    [computeGridPos]
  );

  const onPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragRef.current) return;

      // INSTANT — direct DOM, zero React overhead (120-240 Hz)
      moveOverlay(clientX, clientY);

      if (LIVE_DRAG_PREVIEW_ENABLED) {
        // Store raw coords — computeGridPos runs lazily in the rAF callback.
        // This keeps per-event work to just moveOverlay (pure DOM).
        // Grid computation + React state updates happen at most once per frame (60 Hz).
        pendingCoordsRef.current = { clientX, clientY };
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = 0;
            const coords = pendingCoordsRef.current;
            if (coords) {
              const { row, col, isValid } = computeGridPos(coords.clientX, coords.clientY, SNAP_RADIUS_DRAG);
              updateGridState(row, col, isValid);
              pendingCoordsRef.current = null;
            }
          });
        }
      }
    },
    [computeGridPos]
  );

  const onPointerUp = useCallback((clientX?: number, clientY?: number) => {
    const current = dragRef.current;
    if (!current) return;

    // Cancel pending rAF — we compute final position synchronously below
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
      pendingCoordsRef.current = null;
    }

    // Synchronous final position to avoid stale rAF on fast flicks
    let finalRow = current.boardRow;
    let finalCol = current.boardCol;
    let finalValid = current.isValid;
    if (clientX !== undefined && clientY !== undefined) {
      const { row, col, isValid } = computeGridPos(clientX, clientY, SNAP_RADIUS_DROP);
      finalRow = row;
      finalCol = col;
      finalValid = isValid;
    }

    if (finalRow !== null && finalCol !== null && finalValid) {
      onDropRef.current(current.pieceIndex, finalRow, finalCol);

      // Snap overlay to exact grid position before removal
      const overlayEl = overlayElRef.current;
      const rect = rectRef.current;
      if (overlayEl && rect) {
        const targetX = rect.left + boardPaddingRef.current + finalCol * totalCellRef.current;
        const targetY = rect.top + boardPaddingRef.current + finalRow * totalCellRef.current;
        overlayEl.style.transition = 'transform 50ms ease-out';
        overlayEl.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
        overlayElRef.current = null;
        setTimeout(() => {
          if (overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
        }, 55);
      } else {
        removeOverlay();
      }
    } else {
      removeOverlay();
    }

    dragRef.current = null;
    rectRef.current = null;
    lastGridRef.current = { row: null, col: null };
    grabFracXRef.current = 0.5;
    grabFracYRef.current = 0.5;
    pointerOffsetYRef.current = 0;
    setDragState(null);
    setGhostCells(new Map());
  }, [computeGridPos]);

  const cancelDrag = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
      pendingCoordsRef.current = null;
    }
    removeOverlay();
    dragRef.current = null;
    rectRef.current = null;
    lastGridRef.current = { row: null, col: null };
    grabFracXRef.current = 0.5;
    grabFracYRef.current = 0.5;
    pointerOffsetYRef.current = 0;
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
