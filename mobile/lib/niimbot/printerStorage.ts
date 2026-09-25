import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NiimbotPrinter } from './types';

const STORAGE_KEY = 'rma-niimbot-saved-printer-v1';

export async function loadSavedPrinter(): Promise<NiimbotPrinter | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NiimbotPrinter;
    if (!parsed?.id || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSavedPrinter(printer: NiimbotPrinter | null): Promise<void> {
  if (!printer) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(printer));
}
