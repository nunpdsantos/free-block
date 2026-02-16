import { useMemo } from 'react';
import './AmbientParticles.css';

type AmbientParticle = {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  drift: number;
};

function getParticleCount(): number {
  if (typeof window === 'undefined') return 18;
  const area = window.innerWidth * window.innerHeight;
  // ~18 on phones, ~30 on tablets, ~45 on desktop
  return Math.max(18, Math.min(50, Math.round(area / 20000)));
}

function generateParticles(): AmbientParticle[] {
  const count = getParticleCount();
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: 3 + Math.random() * 4,
    duration: 10 + Math.random() * 14,
    delay: Math.random() * 12,
    opacity: 0.1 + Math.random() * 0.14,
    drift: -20 + Math.random() * 40,
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
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
