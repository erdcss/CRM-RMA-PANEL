/**
 * Scroll-direction state for the Çalışkan B2B mobile web tab bar.
 * Accumulated movement avoids flickering on iOS rubber-banding and small
 * scroll jitters; movement back up restores the full navigation immediately.
 */
export type B2BBottomNavScroll = {
  position: number;
  travel: number;
  compact: boolean;
};

export function initialB2BBottomNavScroll(position = 0): B2BBottomNavScroll {
  return { position: Math.max(0,position), travel:0, compact:false };
}

export function updateB2BBottomNavScroll(
  state: B2BBottomNavScroll,
  nextPosition: number,
): B2BBottomNavScroll {
  if (!Number.isFinite(nextPosition)) return state;
  const position = Math.max(0,nextPosition);
  if (position <= 72) return initialB2BBottomNavScroll(position);

  const delta=position-state.position;
  if (Math.abs(delta)<1.5) return { ...state,position };
  // Reset accumulated travel whenever scroll direction changes.
  const travel = Math.sign(delta) === Math.sign(state.travel)
    ? Math.max(-96,Math.min(96,state.travel+delta))
    : delta;

  return {
    position,
    travel,
    compact:travel>=28?true:travel<=-12?false:state.compact,
  };
}
