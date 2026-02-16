/** Mulberry32 — fast 32-bit seeded PRNG. Returns a function that produces [0, 1) floats. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert an ISO date string (e.g. "2026-02-16") to a deterministic seed. */
export function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Get today's date as ISO string (YYYY-MM-DD). */
export function getTodayDateStr(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

/** Days since Unix epoch — used for "Daily #N" display. */
export function getDayNumber(dateStr: string): number {
  const ms = new Date(dateStr + 'T00:00:00Z').getTime();
  return Math.floor(ms / 86400000);
}
