import { createPortal } from 'react-dom';
import type { DragState } from '../game/types';
import { getPieceBounds } from '../game/pieces';
import { getCSSPx } from '../game/responsive';
import './DragOverlay.css';

type DragOverlayProps = {
  dragState: DragState | null;
};

export function DragOverlay({ dragState }: DragOverlayProps) {
  if (!dragState) return null;

  const { piece, pointerX, pointerY } = dragState;
  const { rows, cols } = getPieceBounds(piece.coords);
  const coordSet = new Set(piece.coords.map(c => `${c.row},${c.col}`));

  const dragCell = getCSSPx('--cell-size');
  const dragGap = getCSSPx('--cell-gap');
  const fingerOffset = getCSSPx('--finger-offset');
  const width = cols * (dragCell + dragGap) - dragGap;
  const height = rows * (dragCell + dragGap) - dragGap;

  const x = pointerX - width / 2;
  const y = pointerY - fingerOffset - height / 2;

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
          gridTemplateColumns: `repeat(${cols}, ${dragCell}px)`,
          gridTemplateRows: `repeat(${rows}, ${dragCell}px)`,
          gap: `${dragGap}px`,
        }}
      >
        {cells}
      </div>
    </div>,
    document.body
  );
}
