import { useRef, useCallback, useState } from 'react';
import type { PieceShape, DragState, GhostCells, Board } from '../game/types';
import { canPlacePiece } from '../game/logic';
import { GRID_SIZE } from '../game/constants';
import { getCSSPx } from '../game/responsive';

export function useDrag(
  board: Board,
  onDrop: (pieceIndex: number, row: number, col: number) => void,
  isAnimating: boolean
) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [ghostCells, setGhostCells] = useState<GhostCells>(new Map());
  const boardRef = useRef<HTMLDivElement>(null);
  const boardPaddingRef = useRef(0);
  const totalCellRef = useRef(0);
  const fingerOffsetRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number>(0);
  const lastGridRef = useRef<{ row: number | null; col: number | null }>({ row: null, col: null });

  const computeGridPos = useCallback(
    (clientX: number, clientY: number, piece: PieceShape) => {
      // Use cached rect — only call getBoundingClientRect once per drag
      const rect = rectRef.current;
      if (!rect) return { row: null, col: null, isValid: false };

      const pieceRows = Math.max(...piece.coords.map(c => c.row)) + 1;
      const pieceCols = Math.max(...piece.coords.map(c => c.col)) + 1;

      const BOARD_PADDING = boardPaddingRef.current;
      const totalCell = totalCellRef.current;
      const relX = clientX - rect.left - BOARD_PADDING - (pieceCols * totalCell) / 2;
      const relY = clientY - rect.top - BOARD_PADDING - fingerOffsetRef.current - (pieceRows * totalCell) / 2;

      const col = Math.round(relX / totalCell);
      const row = Math.round(relY / totalCell);

      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return { row: null, col: null, isValid: false };
      }

      const isValid = canPlacePiece(board, piece, row, col);
      return { row, col, isValid };
    },
    [board]
  );

  const updateGhost = useCallback(
    (row: number | null, col: number | null, piece: PieceShape, isValid: boolean) => {
      // Skip if grid position hasn't changed — avoids re-render
      const last = lastGridRef.current;
      if (last.row === row && last.col === col) return;
      lastGridRef.current = { row, col };

      const ghost: GhostCells = new Map();
      if (row !== null && col !== null) {
        for (const coord of piece.coords) {
          const r = row + coord.row;
          const c = col + coord.col;
          if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
            ghost.set(`${r},${c}`, isValid);
          }
        }
      }
      setGhostCells(ghost);
    },
    []
  );

  const onPointerDown = useCallback(
    (piece: PieceShape, pieceIndex: number, clientX: number, clientY: number) => {
      if (isAnimating) return;

      // Cache board rect + responsive sizes once at drag start
      const boardEl = boardRef.current;
      if (boardEl) {
        rectRef.current = boardEl.getBoundingClientRect();
        const computed = getComputedStyle(boardEl);
        boardPaddingRef.current = parseFloat(computed.paddingLeft) || 0;
      }
      totalCellRef.current = getCSSPx('--cell-size') + getCSSPx('--cell-gap');
      fingerOffsetRef.current = getCSSPx('--finger-offset');

      const state: DragState = {
        piece,
        pieceIndex,
        pointerX: clientX,
        pointerY: clientY,
        boardRow: null,
        boardCol: null,
        isValid: false,
        cellSize: totalCellRef.current - getCSSPx('--cell-gap'),
        cellGap: getCSSPx('--cell-gap'),
        fingerOffset: fingerOffsetRef.current,
      };
      dragRef.current = state;
      setDragState(state);
      lastGridRef.current = { row: null, col: null };

      const { row, col, isValid } = computeGridPos(clientX, clientY, piece);
      updateGhost(row, col, piece, isValid);
    },
    [isAnimating, computeGridPos, updateGhost]
  );

  const onPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const current = dragRef.current;
      if (!current) return;

      // Cancel any pending rAF to avoid stacking frames
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const latest = dragRef.current;
        if (!latest) return;

        const { row, col, isValid } = computeGridPos(clientX, clientY, latest.piece);
        const newState: DragState = {
          ...latest,
          pointerX: clientX,
          pointerY: clientY,
          boardRow: row,
          boardCol: col,
          isValid,
        };
        dragRef.current = newState;
        setDragState(newState);
        updateGhost(row, col, latest.piece, isValid);
      });
    },
    [computeGridPos, updateGhost]
  );

  const onPointerUp = useCallback((clientX?: number, clientY?: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const current = dragRef.current;
    if (!current) return;

    // Recompute grid position synchronously from final pointer coords
    // to avoid stale rAF data on fast flicks
    let finalRow = current.boardRow;
    let finalCol = current.boardCol;
    let finalValid = current.isValid;
    if (clientX !== undefined && clientY !== undefined) {
      const { row, col, isValid } = computeGridPos(clientX, clientY, current.piece);
      finalRow = row;
      finalCol = col;
      finalValid = isValid;
    }

    if (finalRow !== null && finalCol !== null && finalValid) {
      onDrop(current.pieceIndex, finalRow, finalCol);
    }

    dragRef.current = null;
    rectRef.current = null;
    boardPaddingRef.current = 0;
    totalCellRef.current = 0;
    fingerOffsetRef.current = 0;
    lastGridRef.current = { row: null, col: null };
    setDragState(null);
    setGhostCells(new Map());
  }, [onDrop, computeGridPos]);

  const cancelDrag = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    dragRef.current = null;
    rectRef.current = null;
    boardPaddingRef.current = 0;
    totalCellRef.current = 0;
    fingerOffsetRef.current = 0;
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
