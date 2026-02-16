import { useMemo } from 'react';
import { PIECE_COLORS } from '../game/constants';
import './Confetti.css';

const COLORS = Object.values(PIECE_COLORS);
const DEFAULT_COUNT = 12;

type Particle = {
  id: number;
  x: number;
  color: string;
  delay: number;
  drift: number;
  size: number;
};

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80, // % from left
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.3,
    drift: -30 + Math.random() * 60, // horizontal drift in px
    size: 4 + Math.random() * 4,
  }));
}

type ConfettiProps = {
  trigger: number; // increment to trigger new burst
  particleCount?: number;
};

export function Confetti({ trigger, particleCount = DEFAULT_COUNT }: ConfettiProps) {
  const particles = useMemo(() => {
    if (trigger <= 0) return [];
    return createParticles(particleCount);
  }, [trigger, particleCount]);

  if (particles.length === 0) return null;

  return (
    <div className="confetti" key={trigger} aria-hidden>
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
