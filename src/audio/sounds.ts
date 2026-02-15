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

function playFromPool(pool: HTMLAudioElement[], idx: number, volume: number): number {
  const el = pool[idx % POOL_SIZE];
  el.volume = Math.min(1, Math.max(0, volume));
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
  placeIdx = playFromPool(placePool!, placeIdx, 0.5);
}

/** Chime on line clear — volume rises with combo */
export function playClear(combo: number = 0, linesCleared: number = 1) {
  vibrate(linesCleared >= 2 ? [15, 30, 15] : 15);
  if (muted) return;
  ensurePools();

  if (linesCleared >= 2) {
    // Multi-clear gets the richer three-tone sound
    const vol = Math.min(1, 0.5 + combo * 0.05);
    comboIdx = playFromPool(comboPool!, comboIdx, vol);
  } else {
    const vol = Math.min(1, 0.4 + combo * 0.05);
    clearIdx = playFromPool(clearPool!, clearIdx, vol);
  }
}

/** Descending tone on game over */
export function playGameOver() {
  vibrate([40, 60, 80]);
  if (muted) return;
  ensurePools();
  gameoverIdx = playFromPool(gameoverPool!, gameoverIdx, 0.6);
}
