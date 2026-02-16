/** Read a resolved CSS custom property value in pixels from :root */
export function getCSSPx(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}
