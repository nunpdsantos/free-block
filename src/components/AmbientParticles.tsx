import { useMemo } from 'react';
import './AmbientParticles.css';

const PARTICLE_COUNT = 15;

type AmbientParticle = {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

function generateParticles(): AmbientParticle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: 2 + Math.random() * 3,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 10,
    opacity: 0.06 + Math.random() * 0.1,
  }));
}

export function AmbientParticles() {
  const particles = useMemo(generateParticles, []);

  return (
    <div className="ambient-particles" aria-hidden>
      {particles.map(p => (
        <div
          key={p.id}
          className="ambient-particle"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity,
          }}
        />
      ))}
    </div>
  );
}
