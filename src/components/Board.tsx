import { memo, useMemo } from 'react';
import type { Board as BoardType, GhostCells } from '../game/types';
import { GRID_SIZE } from '../game/constants';
import { Cell } from './Cell';
import './Board.css';

type BoardProps = {
  board: BoardType;
  ghostCells: GhostCells;
  clearingCells: Map<string, number>;
  ghostColor?: string | null;
  clearedLines?: { rows: number[]; cols: number[] } | null;
  isShattered?: boolean;
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
  clearingCells,
  ghostColor,
  clearedLines,
  isShattered,
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
          isClearing={clearDelay !== undefined}
          clearDelay={clearDelay ?? 0}
          isShattered={isShattered}
          shatterStyle={isShattered ? getShatterStyle(r, c) : undefined}
        />
      );
    }
  }

  // Shockwave sweep lines for cleared rows/cols
  const shockwaves = useMemo(() => {
    if (!clearedLines) return null;
    const elements: React.ReactElement[] = [];
    const cellTotal = 50; // 48px + 2px gap
    const pad = 6;

    for (const rowIdx of clearedLines.rows) {
      const top = pad + rowIdx * cellTotal + 24; // center of row
      elements.push(
        <div
          key={`sw-r-${rowIdx}`}
          className="shockwave shockwave--row"
          style={{ top }}
        />
      );
    }
    for (const colIdx of clearedLines.cols) {
      const left = pad + colIdx * cellTotal + 24; // center of col
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

  return (
    <div className="board">
      {cells}
      {shockwaves}
    </div>
  );
});
