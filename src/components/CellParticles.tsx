import { useEffect, useState } from 'react';
import type { Board } from '../game/types';
import './CellParticles.css';

const CELL_TOTAL = 50; // 48px cell + 2px gap
const BOARD_PAD = 6;
const PARTICLES_PER_CELL = 4;
const MAX_PARTICLES = 100;

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
  const particles: Particle[] = [];
  let id = 0;

  for (const [key, delay] of clearingCells) {
    if (particles.length >= MAX_PARTICLES) break;
    const [row, col] = key.split(',').map(Number);
    const color = board[row]?.[col] ?? '#C840E9';
    const cx = BOARD_PAD + col * CELL_TOTAL + 24;
    const cy = BOARD_PAD + row * CELL_TOTAL + 24;

    for (let i = 0; i < PARTICLES_PER_CELL; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 55;
      particles.push({
        id: id++,
        x: cx,
        y: cy,
        color,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        size: 4 + Math.random() * 4,
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
