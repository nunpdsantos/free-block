import { useEffect, useState } from 'react';
import { PIECE_COLORS } from '../game/constants';
import './Confetti.css';

const COLORS = Object.values(PIECE_COLORS);
const PARTICLE_COUNT = 12;

type Particle = {
  id: number;
  x: number;
  color: string;
  delay: number;
  drift: number;
  size: number;
};

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
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
};

export function Confetti({ trigger }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (trigger > 0) {
      setParticles(createParticles());
      setKey(k => k + 1);
    }
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="confetti" key={key} aria-hidden>
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
