import { memo, useCallback } from 'react';
import type { PieceShape } from '../game/types';
import { getPieceBounds } from '../game/pieces';
import { getCSSPx } from '../game/responsive';
import './PiecePreview.css';

type PiecePreviewProps = {
  piece: PieceShape | null;
  pieceIndex: number;
  onPointerDown: (
    piece: PieceShape,
    pieceIndex: number,
    clientX: number,
    clientY: number,
    grabFracX: number,
    grabFracY: number,
    pointerType: string
  ) => void;
  isDragging: boolean;
};

export const PiecePreview = memo(function PiecePreview({
  piece,
  pieceIndex,
  onPointerDown,
  isDragging,
}: PiecePreviewProps) {
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!piece) return;
      e.preventDefault();
      const gridEl = e.currentTarget.querySelector('.preview-grid');
      const rect = (gridEl as HTMLDivElement | null)?.getBoundingClientRect()
        ?? e.currentTarget.getBoundingClientRect();
      const grabFracX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
      const grabFracY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
      onPointerDown(piece, pieceIndex, e.clientX, e.clientY, grabFracX, grabFracY, e.pointerType);
    },
    [piece, pieceIndex, onPointerDown]
  );

  if (!piece) {
    return <div className="piece-preview piece-preview--empty" />;
  }

  const { rows, cols } = getPieceBounds(piece.coords);
  const coordSet = new Set(piece.coords.map(c => `${c.row},${c.col}`));

  const previewCell = getCSSPx('--preview-cell');
  const previewGap = getCSSPx('--cell-gap');
  const width = cols * (previewCell + previewGap) - previewGap;
  const height = rows * (previewCell + previewGap) - previewGap;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const filled = coordSet.has(`${r},${c}`);
      cells.push(
        <div
          key={`${r},${c}`}
          className={`preview-cell ${filled ? 'preview-cell--filled' : 'preview-cell--empty'}`}
          style={
            filled
              ? {
                  backgroundColor: piece.color,
                  gridColumn: c + 1,
                  gridRow: r + 1,
                }
              : {
                  gridColumn: c + 1,
                  gridRow: r + 1,
                }
          }
        />
      );
    }
  }

  return (
    <div
      className={`piece-preview ${isDragging ? 'piece-preview--dragging' : ''}`}
      onPointerDown={handlePointerDown}
      style={{
        touchAction: 'none',
        animationDelay: `${pieceIndex * 100}ms`,
      }}
    >
      <div
        className="preview-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${previewCell}px)`,
          gridTemplateRows: `repeat(${rows}, ${previewCell}px)`,
          gap: `${previewGap}px`,
          width,
          height,
        }}
      >
        {cells}
      </div>
    </div>
  );
});
