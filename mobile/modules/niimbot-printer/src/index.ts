import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type NiimbotPrinter = {
  id: string;
  name: string;
  model?: string;
  rssi?: number;
};

export type NiimbotConnectionStatus = {
  connected: boolean;
  printer?: NiimbotPrinter;
};

export type PrintBarcodeLabelOptions = {
  value: string;
  widthMm: number;
  heightMm: number;
  copies: number;
  /** Base64 PNG bitmap prepared by JS renderer; native layer forwards to SDK when available. */
  imageBase64?: string;
};

export const NIIMBOT_SDK_REQUIRED = 'NIIMBOT_SDK_REQUIRED';

type NativeNiimbotPrinterModule = {
  scanPrinters(): Promise<NiimbotPrinter[]>;
  connectPrinter(id: string): Promise<void>;
  disconnectPrinter(): Promise<void>;
  getConnectionStatus(): Promise<NiimbotConnectionStatus>;
  printBarcodeLabel(options: PrintBarcodeLabelOptions): Promise<void>;
  isIntegrationAvailable(): Promise<boolean>;
};

let nativeModule: NativeNiimbotPrinterModule | null = null;

function getNativeModule(): NativeNiimbotPrinterModule | null {
  if (Platform.OS !== 'ios') return null;
  if (nativeModule) return nativeModule;
  try {
    nativeModule = requireNativeModule<NativeNiimbotPrinterModule>('NiimbotPrinter');
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

export function isNiimbotNativeModuleLoaded(): boolean {
  return getNativeModule() !== null;
}

async function requireNative(): Promise<NativeNiimbotPrinterModule> {
  const mod = getNativeModule();
  if (!mod) {
    const err = new Error(
      'NIIMBOT native module not available. Use an Expo development build (not Expo Go) after linking the official NIIMBOT iOS SDK.',
    );
    (err as Error & { code?: string }).code = NIIMBOT_SDK_REQUIRED;
    throw err;
  }
  const available = await mod.isIntegrationAvailable();
  if (!available) {
    const err = new Error(
      'NIIMBOT font resources are missing from this build. Reinstall the latest TestFlight build.',
    );
    (err as Error & { code?: string }).code = 'NIIMBOT_SETUP';
    throw err;
  }
  return mod;
}

export async function scanPrinters(): Promise<NiimbotPrinter[]> {
  const mod = await requireNative();
  return mod.scanPrinters();
}

export async function connectPrinter(id: string): Promise<void> {
  const mod = await requireNative();
  await mod.connectPrinter(id);
}

export async function disconnectPrinter(): Promise<void> {
  const mod = await requireNative();
  await mod.disconnectPrinter();
}

export async function getConnectionStatus(): Promise<NiimbotConnectionStatus> {
  const mod = getNativeModule();
  if (!mod) return { connected: false };
  try {
    return await mod.getConnectionStatus();
  } catch {
    return { connected: false };
  }
}

export async function printBarcodeLabel(options: PrintBarcodeLabelOptions): Promise<void> {
  const mod = await requireNative();
  await mod.printBarcodeLabel(options);
}

export async function isIntegrationAvailable(): Promise<boolean> {
  const mod = getNativeModule();
  if (!mod) return false;
  try {
    return await mod.isIntegrationAvailable();
  } catch {
    return false;
  }
}
