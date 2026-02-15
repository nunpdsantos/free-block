import type { PieceShape } from '../game/types';
import { PiecePreview } from './PiecePreview';
import './PieceTray.css';

type PieceTrayProps = {
  pieces: (PieceShape | null)[];
  onPointerDown: (
    piece: PieceShape,
    pieceIndex: number,
    clientX: number,
    clientY: number
  ) => void;
  draggingIndex: number | null;
};

export function PieceTray({
  pieces,
  onPointerDown,
  draggingIndex,
}: PieceTrayProps) {
  return (
    <div className="piece-tray">
      {pieces.map((piece, i) => (
        <PiecePreview
          key={i}
          piece={piece}
          pieceIndex={i}
          onPointerDown={onPointerDown}
          isDragging={draggingIndex === i}
        />
      ))}
    </div>
  );
}
