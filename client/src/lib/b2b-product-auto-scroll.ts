/**
 * Two products remain side by side. Autoplay advances one complete grid row
 * at a time with a bottom-to-top ease-in-out transition.
 */
export const PRODUCT_ROW_HOLD_MS = 2900;
export const PRODUCT_ROW_SLIDE_MS = 820;
export const PRODUCT_ROW_END_HOLD_MS = 2600;

/** Find the next row without rounding by assumed (often unequal) card heights. */
export function nextProductRowOffset(
  orderedOffsets: readonly number[],
  currentScrollTop: number,
): number | null {
  if (!Number.isFinite(currentScrollTop)) return null;
  for (const offset of orderedOffsets) {
    if (Number.isFinite(offset) && offset > currentScrollTop + 2) return offset;
  }
  return null;
}

/** Interpolate a single row's upward movement; cancelable by touch/wheel. */
export function interpolateProductRowScroll(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number = PRODUCT_ROW_SLIDE_MS,
): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return from;
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
  const easing = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return from + (to - from) * easing;
}
