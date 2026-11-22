/**
 * Automatically advance a mobile product grid without hijacking page scrolling.
 * A short hold at the bottom lets visitors read the last row before looping.
 */
export const AUTO_SCROLL_SPEED_PX_PER_MS = 0.038;
export const AUTO_SCROLL_END_HOLD_MS = 2100;

export function nextProductScrollTop(
  current: number,
  maxScrollTop: number,
  deltaMs: number,
  elapsedAtEndMs: number,
): number {
  if (!Number.isFinite(maxScrollTop) || maxScrollTop <= 0) return 0;
  const max = Math.max(0, maxScrollTop);
  const position = Math.max(0, Math.min(max, Number.isFinite(current) ? current : 0));
  if (position >= max - 1) {
    return elapsedAtEndMs >= AUTO_SCROLL_END_HOLD_MS ? 0 : max;
  }
  const elapsed = Math.max(0, Math.min(64, Number.isFinite(deltaMs) ? deltaMs : 0));
  return Math.min(max, position + elapsed * AUTO_SCROLL_SPEED_PX_PER_MS);
}
