import { synthPlace, synthClear, synthAllClear, synthGameOver, setMasterVolume } from './synth';

let volume = 80; // 0-100
let lastClearTime = 0;
const PLACE_SILENCE_GAP = 250; // ms of silence after a clear before placement sounds resume

// Load persisted volume (migrate from old muted key)
try {
  const storedVol = localStorage.getItem('gridlock-volume');
  if (storedVol !== null) {
    volume = Math.max(0, Math.min(100, JSON.parse(storedVol) as number));
  } else {
    // Migrate from old muted boolean
    const storedMuted = localStorage.getItem('gridlock-muted');
    if (storedMuted === 'true') {
      volume = 0;
    }
    localStorage.removeItem('gridlock-muted');
    localStorage.setItem('gridlock-volume', JSON.stringify(volume));
  }
} catch { /* ignore */ }

// Apply initial volume to synth master
try { setMasterVolume(volume / 100); } catch { /* AudioContext may not exist yet */ }

/** Haptic pulse — always fires (independent of sound volume) */
function vibrate(pattern: number | number[]) {
  try {
    navigator?.vibrate?.(pattern);
  } catch { /* unsupported */ }
}

// --- Public API ---

export function getVolume(): number {
  return volume;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(100, v));
  setMasterVolume(volume / 100);
  try {
    localStorage.setItem('gridlock-volume', JSON.stringify(volume));
  } catch { /* ignore */ }
}

/** Soft woody thock on piece placement — suppressed briefly after clears */
export function playPlace(dangerLevel: number = 0) {
  vibrate(8);
  if (volume === 0) return;
  if (performance.now() - lastClearTime < PLACE_SILENCE_GAP) return;
  synthPlace(dangerLevel);
}

/** Crystalline chime on line clear — ascending pentatonic with combo */
export function playClear(combo: number = 0, linesCleared: number = 1) {
  lastClearTime = performance.now();
  vibrate(linesCleared >= 2 ? [15, 30, 15] : 15);
  if (volume === 0) return;
  synthClear(combo, linesCleared);
}

/** Triumphant major chord on all-clear */
export function playAllClear() {
  vibrate([20, 40, 20, 40, 20]);
  if (volume === 0) return;
  synthAllClear();
}

/** Gentle descending tone on game over */
export function playGameOver() {
  vibrate([40, 60, 80]);
  if (volume === 0) return;
  synthGameOver();
}
