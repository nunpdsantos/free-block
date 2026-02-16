import { synthPlace, synthClear, synthAllClear, synthGameOver } from './synth';

let muted = false;
let lastClearTime = 0;
const PLACE_SILENCE_GAP = 250; // ms of silence after a clear before placement sounds resume

try {
  const stored = localStorage.getItem('gridlock-muted');
  if (stored === 'true') muted = true;
} catch { /* ignore */ }

/** Haptic pulse — always fires (independent of sound mute) */
function vibrate(pattern: number | number[]) {
  try {
    navigator?.vibrate?.(pattern);
  } catch { /* unsupported */ }
}

// --- Public API ---

export function isSoundMuted(): boolean {
  return muted;
}

export function setSoundMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('gridlock-muted', String(m));
  } catch { /* ignore */ }
}

/** Soft woody thock on piece placement — suppressed briefly after clears */
export function playPlace(dangerLevel: number = 0) {
  vibrate(8);
  if (muted) return;
  if (performance.now() - lastClearTime < PLACE_SILENCE_GAP) return;
  synthPlace(dangerLevel);
}

/** Crystalline chime on line clear — ascending pentatonic with combo */
export function playClear(combo: number = 0, linesCleared: number = 1) {
  lastClearTime = performance.now();
  vibrate(linesCleared >= 2 ? [15, 30, 15] : 15);
  if (muted) return;
  synthClear(combo, linesCleared);
}

/** Triumphant major chord on all-clear */
export function playAllClear() {
  vibrate([20, 40, 20, 40, 20]);
  if (muted) return;
  synthAllClear();
}

/** Gentle descending tone on game over */
export function playGameOver() {
  vibrate([40, 60, 80]);
  if (muted) return;
  synthGameOver();
}
