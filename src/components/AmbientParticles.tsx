import { useMemo, useState, useEffect, useRef } from 'react';
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

type BurstParticle = {
  id: number;
  x: number;
  size: number;
  duration: number;
  opacity: number;
  drift: number;
};

type AmbientParticlesProps = {
  tension?: number;    // 0-1
  streak?: number;     // 0+
  clearBurst?: number; // increment triggers burst
};

function getParticleCount(): number {
  if (typeof window === 'undefined') return 18;
  const area = window.innerWidth * window.innerHeight;
  // ~18 on phones, ~30 on tablets, ~45 on desktop
  return Math.max(18, Math.min(25, Math.round(area / 20000)));
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

let burstIdCounter = 1000;

function generateBurstParticles(): BurstParticle[] {
  const count = 8 + Math.floor(Math.random() * 5); // 8-12
  return Array.from({ length: count }, () => ({
    id: burstIdCounter++,
    x: 30 + Math.random() * 40, // center-biased
    size: 4 + Math.random() * 4,
    duration: 2 + Math.random() * 2,
    opacity: 0.3 + Math.random() * 0.3,
    drift: -30 + Math.random() * 60,
  }));
}

export function AmbientParticles({ tension = 0, streak = 0, clearBurst = 0 }: AmbientParticlesProps) {
  const particles = useMemo(() => generateParticles(), []);
  const [burstParticles, setBurstParticles] = useState<BurstParticle[]>([]);
  const prevBurst = useRef(clearBurst);

  // Spawn burst particles on clearBurst increment
  useEffect(() => {
    if (clearBurst === prevBurst.current) return;
    prevBurst.current = clearBurst;

    const burst = generateBurstParticles();
    setBurstParticles(prev => [...prev, ...burst]);

    // Auto-remove after longest possible duration + buffer
    const timer = setTimeout(() => {
      const ids = new Set(burst.map(b => b.id));
      setBurstParticles(prev => prev.filter(p => !ids.has(p.id)));
    }, 4500);

    return () => clearTimeout(timer);
  }, [clearBurst]);

  // Suppress unused var warning — streak reserved for future per-particle effects
  void streak;

  return (
    <div
      className="ambient-particles"
      aria-hidden
      style={{
        '--particle-speed': 1 + tension * 0.8,
        '--particle-opacity': 1 + tension * 1.5,
        '--particle-hue': tension * 40,
      } as React.CSSProperties}
    >
      {particles.map(p => (
        <div
          key={p.id}
          className="ambient-particle"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            '--base-duration': `${p.duration}s`,
            '--base-opacity': p.opacity,
            animationDelay: `${p.delay}s`,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
      {burstParticles.map(p => (
        <div
          key={p.id}
          className="ambient-particle ambient-particle--burst"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            '--base-duration': `${p.duration}s`,
            '--base-opacity': p.opacity,
            '--drift': `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
