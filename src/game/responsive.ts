/** Persistent hidden element for resolving CSS expressions to pixels */
let _measureEl: HTMLDivElement | null = null;

/** Read a resolved CSS custom property value in pixels from :root */
export function getCSSPx(name: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = parseFloat(raw);
  if (!isNaN(parsed)) return parsed;

  // CSS expression (calc, min, max, clamp) — resolve via hidden element
  if (!_measureEl) {
    _measureEl = document.createElement('div');
    _measureEl.style.position = 'absolute';
    _measureEl.style.visibility = 'hidden';
    _measureEl.style.pointerEvents = 'none';
    document.documentElement.appendChild(_measureEl);
  }
  _measureEl.style.width = `var(${name})`;
  return parseFloat(getComputedStyle(_measureEl).width) || 0;
}
