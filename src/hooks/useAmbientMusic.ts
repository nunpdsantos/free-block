import { useEffect, useRef, useState } from 'react';
import {
  startAmbient,
  stopAmbient,
  pauseAmbient,
  resumeAmbient,
  setAmbientTension,
  setAmbientStreak,
  setAmbientPace,
} from '../audio/ambient';

const IDLE_TIMEOUT = 12_000; // 12s without a drop → fade out

/**
 * React bridge for the ambient music engine.
 *
 * Music only plays while the player is actively placing pieces.
 * Fades in on first drop, fades out after 12s idle, and pauses/resumes
 * with game state (pause menu, game over, mute).
 * Tracks placement pace and forwards it to the LFO pulse.
 */
export function useAmbientMusic(
  active: boolean,
  tension: number,
  streak: number,
  volume: number,
  lastDropTime: number,
  musicEnabled: boolean,
): void {
  const startedRef = useRef(false);
  const playingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dropTimesRef = useRef<number[]>([]);
  const [idle, setIdle] = useState(true); // starts idle until first drop

  // Forward tension/streak every render (cheap module-level sets)
  setAmbientTension(tension);
  setAmbientStreak(streak);

  const shouldPlay = active && volume > 0 && !idle && musicEnabled;

  // Lifecycle: start/pause/resume driven by shouldPlay
  useEffect(() => {
    if (shouldPlay && !playingRef.current) {
      if (!startedRef.current) {
        startAmbient();
        startedRef.current = true;
      } else {
        resumeAmbient();
      }
      playingRef.current = true;
    } else if (!shouldPlay && playingRef.current) {
      pauseAmbient();
      playingRef.current = false;
    }
  }, [shouldPlay]);

  // Drop tracking: compute pace + manage idle timeout
  useEffect(() => {
    if (lastDropTime === 0) return;

    // Rolling window of last 5 drop timestamps → average interval
    const times = dropTimesRef.current;
    times.push(lastDropTime);
    if (times.length > 5) times.shift();

    if (times.length >= 2) {
      let total = 0;
      for (let i = 1; i < times.length; i++) total += times[i] - times[i - 1];
      setAmbientPace(total / (times.length - 1));
    }

    // Wake from idle
    setIdle(false);

    // Reset idle timer — fires after 12s of no drops
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_TIMEOUT);
  }, [lastDropTime]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(idleTimerRef.current);
      stopAmbient();
      startedRef.current = false;
      playingRef.current = false;
    };
  }, []);
}
