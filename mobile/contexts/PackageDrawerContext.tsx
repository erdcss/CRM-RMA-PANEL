import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type PackageDrawerContextValue = {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

const PackageDrawerContext = createContext<PackageDrawerContextValue | null>(null);

export function PackageDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((prev) => !prev), []);

  const value = useMemo(
    () => ({ open, openDrawer, closeDrawer, toggleDrawer }),
    [open, openDrawer, closeDrawer, toggleDrawer],
  );

  return <PackageDrawerContext.Provider value={value}>{children}</PackageDrawerContext.Provider>;
}

export function usePackageDrawer() {
  const ctx = useContext(PackageDrawerContext);
  if (!ctx) {
    throw new Error('usePackageDrawer must be used within PackageDrawerProvider');
  }
  return ctx;
}
