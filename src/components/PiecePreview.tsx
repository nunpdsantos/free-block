import { memo, useCallback, useState, useEffect, useRef } from 'react';
import type { PieceShape } from '../game/types';
import { getPieceBounds } from '../game/pieces';
import './PiecePreview.css';

type PiecePreviewProps = {
  piece: PieceShape | null;
  pieceIndex: number;
  onPointerDown: (
    piece: PieceShape,
    pieceIndex: number,
    clientX: number,
    clientY: number
  ) => void;
  isDragging: boolean;
};

const PREVIEW_CELL = 28;
const PREVIEW_GAP = 2;

export const PiecePreview = memo(function PiecePreview({
  piece,
  pieceIndex,
  onPointerDown,
  isDragging,
}: PiecePreviewProps) {
  const [exiting, setExiting] = useState(false);
  const prevPieceRef = useRef(piece);

  useEffect(() => {
    if (prevPieceRef.current && !piece) {
      setExiting(true);
      const timer = setTimeout(() => setExiting(false), 200);
      prevPieceRef.current = piece;
      return () => clearTimeout(timer);
    }
    prevPieceRef.current = piece;
  }, [piece]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!piece) return;
      e.preventDefault();
      onPointerDown(piece, pieceIndex, e.clientX, e.clientY);
    },
    [piece, pieceIndex, onPointerDown]
  );

  if (exiting) {
    return <div className="piece-preview piece-preview--exiting" />;
  }

  if (!piece) {
    return <div className="piece-preview piece-preview--empty" />;
  }

  const { rows, cols } = getPieceBounds(piece.coords);
  const coordSet = new Set(piece.coords.map(c => `${c.row},${c.col}`));

  const width = cols * (PREVIEW_CELL + PREVIEW_GAP) - PREVIEW_GAP;
  const height = rows * (PREVIEW_CELL + PREVIEW_GAP) - PREVIEW_GAP;

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
          gridTemplateColumns: `repeat(${cols}, ${PREVIEW_CELL}px)`,
          gridTemplateRows: `repeat(${rows}, ${PREVIEW_CELL}px)`,
          gap: `${PREVIEW_GAP}px`,
          width,
          height,
        }}
      >
        {cells}
      </div>
    </div>
  );
});
