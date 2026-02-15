import { createPortal } from 'react-dom';
import type { DragState } from '../game/types';
import { getPieceBounds } from '../game/pieces';
import { FINGER_OFFSET } from '../game/constants';
import './DragOverlay.css';

type DragOverlayProps = {
  dragState: DragState | null;
};

const DRAG_CELL = 48;
const DRAG_GAP = 2;

export function DragOverlay({ dragState }: DragOverlayProps) {
  if (!dragState) return null;

  const { piece, pointerX, pointerY } = dragState;
  const { rows, cols } = getPieceBounds(piece.coords);
  const coordSet = new Set(piece.coords.map(c => `${c.row},${c.col}`));

  const width = cols * (DRAG_CELL + DRAG_GAP) - DRAG_GAP;
  const height = rows * (DRAG_CELL + DRAG_GAP) - DRAG_GAP;

  const x = pointerX - width / 2;
  const y = pointerY - FINGER_OFFSET - height / 2;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (coordSet.has(`${r},${c}`)) {
        cells.push(
          <div
            key={`${r},${c}`}
            className="drag-cell"
            style={{
              backgroundColor: piece.color,
              gridColumn: c + 1,
              gridRow: r + 1,
            }}
          />
        );
      }
    }
  }

  return createPortal(
    <div
      className="drag-overlay"
      style={{
        transform: `translate3d(${x}px, ${y}px, 0)`,
        width,
        height,
      }}
    >
      <div
        className="drag-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${DRAG_CELL}px)`,
          gridTemplateRows: `repeat(${rows}, ${DRAG_CELL}px)`,
          gap: `${DRAG_GAP}px`,
        }}
      >
        {cells}
      </div>
    </div>,
    document.body
  );
}
