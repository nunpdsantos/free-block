import { useEffect, useRef } from 'react';
import {
  startAmbient,
  stopAmbient,
  pauseAmbient,
  resumeAmbient,
  setAmbientTension,
  setAmbientStreak,
} from '../audio/ambient';

/**
 * React bridge for the ambient music engine.
 * Connects game state signals to the procedural audio system.
 */
export function useAmbientMusic(
  active: boolean,
  tension: number,
  streak: number,
  volume: number,
): void {
  const startedRef = useRef(false);
  const activeRef = useRef(false);

  // Forward tension/streak every render (cheap module-level sets)
  setAmbientTension(tension);
  setAmbientStreak(streak);

  // Mute = treat as inactive
  const effectiveActive = active && volume > 0;

  useEffect(() => {
    if (effectiveActive && !activeRef.current) {
      // Activate
      if (!startedRef.current) {
        startAmbient();
        startedRef.current = true;
      } else {
        resumeAmbient();
      }
      activeRef.current = true;
    } else if (!effectiveActive && activeRef.current) {
      // Deactivate
      pauseAmbient();
      activeRef.current = false;
    }
  }, [effectiveActive]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      stopAmbient();
      startedRef.current = false;
      activeRef.current = false;
    };
  }, []);
}
