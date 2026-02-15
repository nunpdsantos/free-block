import { memo } from 'react';
import type { Board as BoardType, GhostCells } from '../game/types';
import { GRID_SIZE } from '../game/constants';
import { Cell } from './Cell';
import './Board.css';

type BoardProps = {
  board: BoardType;
  ghostCells: GhostCells;
  clearingCells: Map<string, number>;
};

export const Board = memo(function Board({
  board,
  ghostCells,
  clearingCells,
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
          isClearing={clearDelay !== undefined}
          clearDelay={clearDelay ?? 0}
        />
      );
    }
  }

  return <div className="board">{cells}</div>;
});
