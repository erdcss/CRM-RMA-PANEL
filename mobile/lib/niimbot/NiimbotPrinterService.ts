import { Platform } from 'react-native';

import { renderBarcodeLabelBitmap } from '@/lib/barcodeLabelRenderer';
import { loadBarcodeLabelSettings, validateBarcodeForPrint } from '@/lib/barcodeLabelSettings';

import { loadSavedPrinter, saveSavedPrinter } from './printerStorage';
import {
  mapNativeError,
  NIIMBOT_ERROR_CODES,
  NiimbotPrinterError,
  type NiimbotConnectionStatus,
  type NiimbotPrinter,
} from './types';

let printInFlight = false;

async function loadNativeAdapter() {
  if (Platform.OS !== 'ios') return null;
  try {
    return await import('niimbot-printer');
  } catch {
    return null;
  }
}

export const NiimbotPrinterService = {
  isSupportedPlatform(): boolean {
    return Platform.OS === 'ios';
  },

  async isIntegrationAvailable(): Promise<boolean> {
    const native = await loadNativeAdapter();
    if (!native) return false;
    try {
      return await native.isIntegrationAvailable();
    } catch {
      return false;
    }
  },

  async getSavedPrinter(): Promise<NiimbotPrinter | null> {
    return loadSavedPrinter();
  },

  async getConnectionStatus(): Promise<NiimbotConnectionStatus> {
    const native = await loadNativeAdapter();
    if (!native) return { connected: false };
    try {
      return await native.getConnectionStatus();
    } catch {
      return { connected: false };
    }
  },

  async scanPrinters(): Promise<NiimbotPrinter[]> {
    const native = await loadNativeAdapter();
    if (!native) {
      throw new NiimbotPrinterError(
        NIIMBOT_ERROR_CODES.SDK_REQUIRED,
        'NIIMBOT entegrasyonu bu ortamda kullanılamıyor. Expo Go desteklenmez; development build gerekir.',
      );
    }
    try {
      return await native.scanPrinters();
    } catch (error) {
      throw mapNativeError(error);
    }
  },

  async connectPrinter(printer: NiimbotPrinter): Promise<void> {
    const native = await loadNativeAdapter();
    if (!native) throw mapNativeError(new Error('NIIMBOT_SDK_REQUIRED'));
    try {
      await native.connectPrinter(printer.id);
      await saveSavedPrinter(printer);
    } catch (error) {
      throw mapNativeError(error);
    }
  },

  async disconnectPrinter(): Promise<void> {
    const native = await loadNativeAdapter();
    if (!native) return;
    try {
      await native.disconnectPrinter();
    } catch (error) {
      throw mapNativeError(error);
    }
  },

  async ensureConnected(): Promise<NiimbotPrinter> {
    const status = await this.getConnectionStatus();
    if (status.connected && status.printer) return status.printer;

    const saved = await loadSavedPrinter();
    if (!saved) {
      throw new NiimbotPrinterError(
        NIIMBOT_ERROR_CODES.PRINTER_NOT_FOUND,
        'Bağlı NIIMBOT yazıcı yok. Barkod Ayarlarından yazıcı seçin.',
      );
    }

    try {
      await this.connectPrinter(saved);
      return saved;
    } catch (error) {
      if (error instanceof NiimbotPrinterError) throw error;
      throw new NiimbotPrinterError(
        NIIMBOT_ERROR_CODES.PRINTER_NOT_FOUND,
        'NIIMBOT D110-M bulunamadı. Yazıcının açık ve yakında olduğundan emin olun.',
      );
    }
  },

  /**
   * Direct NIIMBOT print — never opens iOS AirPrint / expo-print dialog.
   */
  async printBarcode(
    value: string,
    options?: { settings?: Awaited<ReturnType<typeof loadBarcodeLabelSettings>>; copies?: number },
  ): Promise<{ fitWarning?: string }> {
    if (!this.isSupportedPlatform()) {
      throw new NiimbotPrinterError(
        NIIMBOT_ERROR_CODES.PRINT_FAILED,
        'NIIMBOT doğrudan yazdırma yalnızca iOS için hazırlandı.',
      );
    }
    if (printInFlight) {
      throw new NiimbotPrinterError(NIIMBOT_ERROR_CODES.PRINT_BUSY, 'Yazdırma devam ediyor.');
    }

    const settings = options?.settings ?? (await loadBarcodeLabelSettings());
    const copies = Math.min(100, Math.max(1, options?.copies ?? settings.quantity ?? 1));
    const { cleaned, validation, fit } = validateBarcodeForPrint(value, settings);

    if (!validation.valid) {
      throw new NiimbotPrinterError(NIIMBOT_ERROR_CODES.PRINT_FAILED, validation.error ?? 'Geçersiz barkod');
    }

    printInFlight = true;
    try {
      await this.ensureConnected();
      const renderPlan = await renderBarcodeLabelBitmap(cleaned, settings);
      const native = await loadNativeAdapter();
      if (!native) throw mapNativeError(new Error('NIIMBOT_SDK_REQUIRED'));

      await native.printBarcodeLabel({
        value: cleaned,
        widthMm: settings.labelWidthMm,
        heightMm: settings.labelHeightMm,
        copies,
        imageBase64: renderPlan.imageBase64 ?? undefined,
      });

      return fit.fits ? {} : { fitWarning: fit.warning };
    } catch (error) {
      throw mapNativeError(error);
    } finally {
      printInFlight = false;
    }
  },
};

export type { NiimbotPrinter, NiimbotConnectionStatus };
