import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/**
 * Navigation is expanded by default. Collapse only after the user has scrolled
 * down intentionally; small scroll jitter and horizontal carousels are ignored.
 * Reverse scroll or tapping the floating parcel expands it again.
 */
export function shouldCollapseBar(
  previous: boolean, y: number, directionDistance: number,
): boolean {
  if (y < 48) return false;
  if (directionDistance > 42 && y > 100) return true;
  if (directionDistance < -26) return false;
  return previous;
}
type BottomBarScrollState = {
  collapsed: boolean;
  reportScroll: (offsetY: number) => void;
  expandBar: () => void;
};
const Context = createContext<BottomBarScrollState | null>(null);
export function BottomBarScrollProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const lastOffset = useRef(0);
  const accumulated = useRef(0);
  const ignoreNextOffset = useRef(false);
  const reportScroll = useCallback((offsetY: number) => {
    const y = Math.max(0, Number(offsetY) || 0);
    if (ignoreNextOffset.current) {
      ignoreNextOffset.current = false;
      lastOffset.current = y;
      return;
    }
    const delta = Math.max(-70, Math.min(70, y - lastOffset.current));
    lastOffset.current = y;
    if (!delta || y < 48) {
      if (y < 48) {
        accumulated.current = 0;
        setCollapsed(false);
      }
      return;
    }
    // Restart the distance counter whenever the scroll direction changes.
    if ((delta > 0 && accumulated.current < 0) ||
        (delta < 0 && accumulated.current > 0)) accumulated.current = 0;
    accumulated.current = Math.max(-120, Math.min(120, accumulated.current + delta));
    setCollapsed(current => shouldCollapseBar(current, y, accumulated.current));
  }, []);
  const expandBar = useCallback(() => {
    accumulated.current = 0;
    lastOffset.current = 0;
    ignoreNextOffset.current = true;
    setCollapsed(false);
  }, []);
  return (
    <Context.Provider value={{collapsed, reportScroll, expandBar}}>
      {children}
    </Context.Provider>
  );
}
export function useBottomBarScroll() {
  const value = useContext(Context);
  if (!value) throw new Error('BottomBarScrollProvider must wrap the tabs');
  return value;
}
