import type { PieceShape } from '../game/types';
import { PiecePreview } from './PiecePreview';
import './PieceTray.css';

type PieceTrayProps = {
  pieces: (PieceShape | null)[];
  onPointerDown: (
    piece: PieceShape,
    pieceIndex: number,
    clientX: number,
    clientY: number,
    grabFracX: number,
    grabFracY: number,
    pointerType: string
  ) => void;
  draggingIndex: number | null;
  generation: number;
};

export function PieceTray({
  pieces,
  onPointerDown,
  draggingIndex,
  generation,
}: PieceTrayProps) {
  const trayClass = `piece-tray${draggingIndex !== null ? ' piece-tray--dragging' : ''}`;

  return (
    <div className={trayClass}>
      {pieces.map((piece, i) => (
        <PiecePreview
          key={`${i}-${generation}`}
          piece={piece}
          pieceIndex={i}
          onPointerDown={onPointerDown}
          isDragging={draggingIndex === i}
        />
      ))}
    </div>
  );
}
