let muted = false;

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

/**
 * Audio pool — pre-load each sound and keep multiple instances
 * so rapid-fire playback doesn't cut off previous plays.
 */
const POOL_SIZE = 4;

function createPool(src: string): HTMLAudioElement[] {
  const pool: HTMLAudioElement[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const a = new Audio(src);
    a.preload = 'auto';
    pool.push(a);
  }
  return pool;
}

let placePool: HTMLAudioElement[] | null = null;
let clearPool: HTMLAudioElement[] | null = null;
let comboPool: HTMLAudioElement[] | null = null;
let gameoverPool: HTMLAudioElement[] | null = null;

let placeIdx = 0;
let clearIdx = 0;
let comboIdx = 0;
let gameoverIdx = 0;

function ensurePools() {
  if (!placePool) {
    placePool = createPool('/sounds/place.ogg');
    clearPool = createPool('/sounds/clear.ogg');
    comboPool = createPool('/sounds/combo.ogg');
    gameoverPool = createPool('/sounds/gameover.ogg');
  }
}

function playFromPool(pool: HTMLAudioElement[], idx: number, volume: number, rate: number = 1): number {
  const el = pool[idx % POOL_SIZE];
  el.volume = Math.min(1, Math.max(0, volume));
  el.playbackRate = Math.min(2, Math.max(0.5, rate));
  el.currentTime = 0;
  el.play().catch(() => { /* blocked by autoplay policy */ });
  return (idx + 1) % POOL_SIZE;
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

/** Soft pop on piece placement */
export function playPlace() {
  vibrate(8);
  if (muted) return;
  ensurePools();
  placeIdx = playFromPool(placePool!, placeIdx, 0.55);
}

/** Chime on line clear — volume and pitch rise with combo */
export function playClear(combo: number = 0, linesCleared: number = 1) {
  vibrate(linesCleared >= 2 ? [15, 30, 15] : 15);
  if (muted) return;
  ensurePools();

  // Pitch rises with streak (1.0 → 1.3 over 5 combos)
  const rate = 1 + Math.min(combo, 5) * 0.06;

  if (linesCleared >= 2) {
    const vol = Math.min(1, 0.55 + combo * 0.06);
    comboIdx = playFromPool(comboPool!, comboIdx, vol, rate);
  } else {
    const vol = Math.min(1, 0.45 + combo * 0.06);
    clearIdx = playFromPool(clearPool!, clearIdx, vol, rate);
  }
}

/** Triumphant layered sound on all-clear */
export function playAllClear() {
  vibrate([20, 40, 20, 40, 20]);
  if (muted) return;
  ensurePools();
  // Layer clear + combo pitched up for a triumphant effect
  clearIdx = playFromPool(clearPool!, clearIdx, 0.7, 1.25);
  comboIdx = playFromPool(comboPool!, comboIdx, 0.8, 1.15);
}

/** Descending tone on game over */
export function playGameOver() {
  vibrate([40, 60, 80]);
  if (muted) return;
  ensurePools();
  gameoverIdx = playFromPool(gameoverPool!, gameoverIdx, 0.7, 0.85);
}
