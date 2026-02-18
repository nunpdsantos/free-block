/**
 * Player rhythm detector — autocorrelation over placement inter-onset intervals (IOI).
 *
 * Tracks the last N piece placements, computes IOIs between consecutive placements,
 * then tests candidate periods for rhythmic periodicity. If a player is placing pieces
 * on a consistent grid (e.g., every 500ms = 120 BPM), the detected period is returned
 * so the beat clock can snap to the player's natural tempo — creating a flow-state
 * feedback loop where music and gameplay lock together.
 *
 * Returns null when no rhythm is detected (irregular play or insufficient history).
 */

const MAX_HISTORY = 12;
const MIN_PERIOD_MS = 250;  // 240 BPM max
const MAX_PERIOD_MS = 3000; // 20 BPM min
const MATCH_TOLERANCE = 0.15; // IOI must be within 15% of the period (or a multiple)
const MATCH_THRESHOLD = 0.75; // 75% of IOIs must match for rhythm lock

const placementTimes: number[] = [];

/** Record a piece placement timestamp. Call once per physical piece drop. */
export function recordPlacement(): void {
  placementTimes.push(Date.now());
  if (placementTimes.length > MAX_HISTORY) placementTimes.shift();
}

/** Clear placement history — call on new game or revive. */
export function clearRhythmHistory(): void {
  placementTimes.length = 0;
}

/**
 * Attempt to detect a rhythmic period in recent placement history.
 * Returns the detected period in milliseconds, or null if no clear rhythm is found.
 *
 * Tests three candidate periods: mean IOI, half mean (player playing "double time"),
 * and double mean (player playing "half time").
 */
export function detectRhythmPeriod(): number | null {
  if (placementTimes.length < 6) return null;

  const iois: number[] = [];
  for (let i = 1; i < placementTimes.length; i++) {
    iois.push(placementTimes[i] - placementTimes[i - 1]);
  }

  const mean = iois.reduce((a, b) => a + b, 0) / iois.length;
  // Test mean and common tempo subdivisions (2× and 0.5×)
  const candidates = [mean, mean / 2, mean * 2]
    .filter(p => p >= MIN_PERIOD_MS && p <= MAX_PERIOD_MS);

  for (const period of candidates) {
    const tolerance = period * MATCH_TOLERANCE;
    let matches = 0;
    for (const ioi of iois) {
      const nearestMultiple = Math.max(1, Math.round(ioi / period));
      if (Math.abs(ioi - nearestMultiple * period) < tolerance) {
        matches++;
      }
    }
    const score = matches / iois.length;
    if (score >= MATCH_THRESHOLD) return period;
  }

  return null;
}
