import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
export type AppPalette = {
  background: string; surface: string; surfaceSecondary: string;
  text: string; textSecondary: string; muted: string; border: string;
  accent: string; accentText: string; inverse: string;
};
const paletteLight: AppPalette = {
  background: '#F5F6F8', surface: '#FFFFFF', surfaceSecondary: '#EDF0F4',
  text: '#111318', textSecondary: '#424A56', muted: '#64748B',
  border: '#DEE2E8', accent: '#FFCD00', accentText: '#0F1012', inverse: '#16181B',
};
const paletteDark: AppPalette = {
  background: '#0D0F11', surface: '#191C20', surfaceSecondary: '#25292E',
  text: '#F7F8FA', textSecondary: '#D3D8DF', muted: '#B0BAC7',
  border: '#3A414B', accent: '#FFCD00', accentText: '#0F1012', inverse: '#FFFFFF',
};
const storageKey = 'caliskan_b2b_appearance_v1';
const Context = createContext<{
  preference: ThemePreference; mode: 'light' | 'dark';
  palette: AppPalette; setPreference: (mode: ThemePreference) => void;
} | null>(null);
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [preference, setCurrent] = useState<ThemePreference>('system');
  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') setCurrent(value);
    }).catch(() => undefined);
  }, []);
  const setPreference = (value: ThemePreference) => {
    setCurrent(value);
    void AsyncStorage.setItem(storageKey, value).catch(() => undefined);
  };
  const mode = preference === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(() => ({
    preference, setPreference, mode,
    palette: mode === 'dark' ? paletteDark : paletteLight,
  }), [preference, mode]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppearance() {
  const value = useContext(Context);
  if (!value) throw new Error('AppearanceProvider is required');
  return value;
}
