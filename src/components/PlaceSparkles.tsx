import { useEffect, useState } from 'react';
import './PlaceSparkles.css';

const CELL_TOTAL = 50; // 48px cell + 2px gap
const BOARD_PAD = 6;
const SPARKLES_PER_CELL = 2;

type Sparkle = {
  id: number;
  x: number;
  y: number;
  color: string;
  tx: number;
  ty: number;
  size: number;
};

export type PlacedCell = {
  row: number;
  col: number;
  color: string;
};

function createSparkles(cells: PlacedCell[]): Sparkle[] {
  const sparkles: Sparkle[] = [];
  let id = 0;
  for (const cell of cells) {
    const cx = BOARD_PAD + cell.col * CELL_TOTAL + 24;
    const cy = BOARD_PAD + cell.row * CELL_TOTAL + 24;
    for (let i = 0; i < SPARKLES_PER_CELL; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 22;
      sparkles.push({
        id: id++,
        x: cx,
        y: cy,
        color: cell.color,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        size: 2 + Math.random() * 2.5,
      });
    }
  }
  return sparkles;
}

type PlaceSparklesProps = {
  cells: PlacedCell[];
  trigger: number;
};

export function PlaceSparkles({ cells, trigger }: PlaceSparklesProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger > 0 && cells.length > 0) {
      setSparkles(createSparkles(cells));
      setKey(k => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (sparkles.length === 0) return null;

  return (
    <div className="place-sparkles" key={key} aria-hidden>
      {sparkles.map(s => (
        <div
          key={s.id}
          className="place-sparkle"
          style={{
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            '--tx': `${s.tx}px`,
            '--ty': `${s.ty}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
