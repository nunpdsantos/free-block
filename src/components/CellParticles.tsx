import { useEffect, useState } from 'react';
import type { Board } from '../game/types';
import { getCSSPx } from '../game/responsive';
import './CellParticles.css';

const PARTICLES_PER_CELL = 6;
const MAX_PARTICLES = 120;

type Particle = {
  id: number;
  x: number;
  y: number;
  color: string;
  tx: number;
  ty: number;
  size: number;
  delay: number;
};

function createParticles(
  clearingCells: Map<string, number>,
  board: Board
): Particle[] {
  const cellSize = getCSSPx('--cell-size');
  const cellGap = getCSSPx('--cell-gap');
  const cellTotal = cellSize + cellGap;
  const boardPad = getCSSPx('--board-padding');
  const halfCell = cellSize / 2;
  const particles: Particle[] = [];
  let id = 0;

  for (const [key, delay] of clearingCells) {
    if (particles.length >= MAX_PARTICLES) break;
    const [row, col] = key.split(',').map(Number);
    const color = board[row]?.[col] ?? '#C840E9';
    const cx = boardPad + col * cellTotal + halfCell;
    const cy = boardPad + row * cellTotal + halfCell;

    for (let i = 0; i < PARTICLES_PER_CELL; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 15 + Math.random() * 35;
      particles.push({
        id: id++,
        x: cx,
        y: cy,
        color,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        size: 2 + Math.random() * 3,
        delay,
      });
    }
  }

  return particles;
}

type CellParticlesProps = {
  clearingCells: Map<string, number>;
  board: Board;
  trigger: number;
};

export function CellParticles({ clearingCells, board, trigger }: CellParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger > 0 && clearingCells.size > 0) {
      setParticles(createParticles(clearingCells, board));
      setKey(k => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="cell-particles" key={key} aria-hidden>
      {particles.map(p => (
        <div
          key={p.id}
          className="cell-particle"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            '--tx': `${p.tx}px`,
            '--ty': `${p.ty}px`,
            animationDelay: `${p.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
