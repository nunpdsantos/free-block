import { synthPlace, synthClear, synthAllClear, synthGameOver, synthRevive, synthAchievement, setMasterVolume } from './synth';

let volume = 80; // 0-100
let sfxEnabled = true;
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

// Load persisted SFX toggle
try {
  const stored = localStorage.getItem('gridlock-sfx');
  if (stored !== null) sfxEnabled = JSON.parse(stored) as boolean;
} catch { /* ignore */ }

// Apply initial volume to synth master
try { setMasterVolume(volume / 100); } catch { /* AudioContext may not exist yet */ }

/** Haptic pulse — suppressed when volume is 0 or SFX disabled */
function vibrate(pattern: number | number[]) {
  if (volume === 0 || !sfxEnabled) return;
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

export function getSfxEnabled(): boolean {
  return sfxEnabled;
}

export function setSfxEnabled(on: boolean) {
  sfxEnabled = on;
  try {
    localStorage.setItem('gridlock-sfx', JSON.stringify(on));
  } catch { /* ignore */ }
}

/** Soft woody thock on piece placement — suppressed briefly after clears */
export function playPlace(dangerLevel: number = 0) {
  if (!sfxEnabled) return;
  vibrate(8);
  if (volume === 0) return;
  if (performance.now() - lastClearTime < PLACE_SILENCE_GAP) return;
  synthPlace(dangerLevel);
}

/** Crystalline chime on line clear — ascending pentatonic with combo */
export function playClear(combo: number = 0, linesCleared: number = 1) {
  if (!sfxEnabled) return;
  lastClearTime = performance.now();
  vibrate(linesCleared >= 2 ? [15, 30, 15] : 15);
  if (volume === 0) return;
  synthClear(combo, linesCleared);
}

/** Triumphant major chord on all-clear */
export function playAllClear() {
  if (!sfxEnabled) return;
  vibrate([20, 40, 20, 40, 20]);
  if (volume === 0) return;
  synthAllClear();
}

/** Gentle descending tone on game over */
export function playGameOver() {
  if (!sfxEnabled) return;
  vibrate([40, 60, 80]);
  if (volume === 0) return;
  synthGameOver();
}

/** Hopeful ascending tone on revive */
export function playRevive() {
  if (!sfxEnabled) return;
  vibrate([10, 20, 10]);
  if (volume === 0) return;
  synthRevive(0);
}

/** Celebratory fanfare on achievement unlock */
export function playAchievement() {
  if (!sfxEnabled) return;
  vibrate([15, 30, 15, 30, 15]);
  if (volume === 0) return;
  synthAchievement();
}
