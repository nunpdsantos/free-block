import { memo, useMemo, type Ref } from 'react';
import type { Board as BoardType, GhostCells } from '../game/types';
import { GRID_SIZE } from '../game/constants';
import { getCSSPx } from '../game/responsive';
import { Cell } from './Cell';
import './Board.css';

type BoardProps = {
  board: BoardType;
  ghostCells: GhostCells;
  ghostCompletingCells?: Set<string>;
  previewClearCells?: Set<string>;
  clearingCells: Map<string, number>;
  preClearCells?: Set<string>;
  ghostColor?: string | null;
  clearedLines?: { rows: number[]; cols: number[] } | null;
  isShattered?: boolean;
  dangerLevel?: number;
  settleCells?: Set<string>;
  isDragging?: boolean;
  boardRef?: Ref<HTMLDivElement>;
};

/** Compute deterministic shatter offsets from cell position */
function getShatterStyle(row: number, col: number): React.CSSProperties {
  const centerC = (GRID_SIZE - 1) / 2;
  const dx = (col - centerC) * 15;
  const dy = 30 + row * 8;
  const rot = (col - centerC) * 8;
  const delay = (GRID_SIZE - 1 - row) * 50; // bottom rows first
  return {
    '--shatter-x': `${dx}px`,
    '--shatter-y': `${dy}px`,
    '--shatter-rot': `${rot}deg`,
    animationDelay: `${delay}ms`,
  } as React.CSSProperties;
}

export const Board = memo(function Board({
  board,
  ghostCells,
  ghostCompletingCells,
  previewClearCells,
  clearingCells,
  preClearCells,
  ghostColor,
  clearedLines,
  isShattered,
  dangerLevel = 0,
  settleCells,
  isDragging = false,
  boardRef,
}: BoardProps) {
  const cells = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const key = `${r},${c}`;
      const ghost = ghostCells.get(key);
      const clearDelay = clearingCells.get(key);
      cells.push(
        <Cell
          key={key}
          color={board[r][c]}
          isGhost={ghost !== undefined}
          ghostValid={ghost === true}
          ghostColor={ghostColor ?? undefined}
          ghostCompletesLine={ghostCompletingCells?.has(key)}
          isPreviewClearing={previewClearCells?.has(key)}
          isClearing={clearDelay !== undefined}
          clearDelay={clearDelay ?? 0}
          isPreClearing={preClearCells?.has(key)}
          isShattered={isShattered}
          shatterStyle={isShattered ? getShatterStyle(r, c) : undefined}
          isSettling={settleCells?.has(key)}
        />
      );
    }
  }

  // Shockwave sweep lines for cleared rows/cols
  const shockwaves = useMemo(() => {
    if (!clearedLines) return null;
    const elements: React.ReactElement[] = [];
    const cellTotal = getCSSPx('--cell-size') + getCSSPx('--cell-gap');
    const pad = getCSSPx('--board-padding');

    const halfCell = getCSSPx('--cell-size') / 2;
    for (const rowIdx of clearedLines.rows) {
      const top = pad + rowIdx * cellTotal + halfCell;
      elements.push(
        <div
          key={`sw-r-${rowIdx}`}
          className="shockwave shockwave--row"
          style={{ top }}
        />
      );
    }
    for (const colIdx of clearedLines.cols) {
      const left = pad + colIdx * cellTotal + halfCell;
      elements.push(
        <div
          key={`sw-c-${colIdx}`}
          className="shockwave shockwave--col"
          style={{ left }}
        />
      );
    }
    return elements;
  }, [clearedLines]);

  let boardClass = 'board';
  if (isDragging) boardClass += ' board--dragging';
  if (dangerLevel >= 2) boardClass += ' board--danger';
  else if (dangerLevel >= 1) boardClass += ' board--warning';

  return (
    <div className={boardClass} ref={boardRef}>
      {cells}
      {shockwaves}
    </div>
  );
});
