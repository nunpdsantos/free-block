import { useRef, useCallback, useState } from 'react';
import type { PieceShape, DragState, GhostCells, Board } from '../game/types';
import { canPlacePiece } from '../game/logic';
import { GRID_SIZE, CELL_SIZE, CELL_GAP, FINGER_OFFSET } from '../game/constants';

const TOTAL_CELL = CELL_SIZE + CELL_GAP;

export function useDrag(
  board: Board,
  onDrop: (pieceIndex: number, row: number, col: number) => void,
  isAnimating: boolean
) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [ghostCells, setGhostCells] = useState<GhostCells>(new Map());
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const computeGridPos = useCallback(
    (clientX: number, clientY: number, piece: PieceShape) => {
      const boardEl = boardRef.current;
      if (!boardEl) return { row: null, col: null, isValid: false };

      const rect = boardEl.getBoundingClientRect();
      // Center the piece on the pointer
      const pieceRows = Math.max(...piece.coords.map(c => c.row)) + 1;
      const pieceCols = Math.max(...piece.coords.map(c => c.col)) + 1;

      const BOARD_PADDING = 8;
      const relX = clientX - rect.left - BOARD_PADDING - (pieceCols * TOTAL_CELL) / 2;
      const relY = clientY - rect.top - BOARD_PADDING - FINGER_OFFSET - (pieceRows * TOTAL_CELL) / 2;

      const col = Math.round(relX / TOTAL_CELL);
      const row = Math.round(relY / TOTAL_CELL);

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
      const state: DragState = {
        piece,
        pieceIndex,
        pointerX: clientX,
        pointerY: clientY,
        boardRow: null,
        boardCol: null,
        isValid: false,
      };
      dragRef.current = state;
      setDragState(state);

      const { row, col, isValid } = computeGridPos(clientX, clientY, piece);
      updateGhost(row, col, piece, isValid);
    },
    [isAnimating, computeGridPos, updateGhost]
  );

  const onPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const current = dragRef.current;
      if (!current) return;

      const { row, col, isValid } = computeGridPos(clientX, clientY, current.piece);
      const newState: DragState = {
        ...current,
        pointerX: clientX,
        pointerY: clientY,
        boardRow: row,
        boardCol: col,
        isValid,
      };
      dragRef.current = newState;
      setDragState(newState);
      updateGhost(row, col, current.piece, isValid);
    },
    [computeGridPos, updateGhost]
  );

  const onPointerUp = useCallback(() => {
    const current = dragRef.current;
    if (!current) return;

    if (current.boardRow !== null && current.boardCol !== null && current.isValid) {
      onDrop(current.pieceIndex, current.boardRow, current.boardCol);
    }

    dragRef.current = null;
    setDragState(null);
    setGhostCells(new Map());
  }, [onDrop]);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
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
