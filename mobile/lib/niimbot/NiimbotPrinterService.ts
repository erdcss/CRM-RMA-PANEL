import { Platform } from 'react-native';

import { renderBarcodeLabelBitmap } from '@/lib/barcodeLabelRenderer';
import {
  loadBarcodeLabelSettings,
  validatePackageBarcodeForPrint,
  validateProductBarcodeForPrint,
} from '@/lib/barcodeLabelSettings';
import * as NiimbotNative from 'niimbot-printer';

import { loadSavedPrinter, saveSavedPrinter } from './printerStorage';
import {
  mapNativeError,
  NIIMBOT_ERROR_CODES,
  NiimbotPrinterError,
  type NiimbotConnectionStatus,
  type NiimbotPrinter,
} from './types';

const MAX_QUEUE = 3;
let queueTail: Promise<void> = Promise.resolve();
let queuedCount = 0;

function loadNativeAdapter() {
  if (Platform.OS !== 'ios') return null;
  return NiimbotNative;
}

function enqueuePrint<T>(task: () => Promise<T>): Promise<T> {
  if (queuedCount >= MAX_QUEUE) {
    return Promise.reject(
      new NiimbotPrinterError(
        NIIMBOT_ERROR_CODES.PRINT_BUSY,
        'Önceki yazdırma işlemi tamamlanıyor.',
      ),
    );
  }

  queuedCount += 1;
  const run = queueTail.then(task);
  queueTail = run.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
    queuedCount = Math.max(0, queuedCount - 1);
  });
  return run;
}

async function printBarcodeInternal(
  value: string,
  mode: 'product' | 'package',
  options?: { settings?: Awaited<ReturnType<typeof loadBarcodeLabelSettings>>; copies?: number },
): Promise<{ fitWarning?: string }> {
  if (!NiimbotPrinterService.isSupportedPlatform()) {
    throw new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.PRINT_FAILED,
      'NIIMBOT doğrudan yazdırma yalnızca iOS için hazırlandı.',
    );
  }

  const settings = options?.settings ?? (await loadBarcodeLabelSettings());
  const copies = Math.min(100, Math.max(1, options?.copies ?? settings.quantity ?? 1));
  const validated =
    mode === 'product'
      ? validateProductBarcodeForPrint(value, settings)
      : validatePackageBarcodeForPrint(value, settings);

  if (!validated.validation.valid) {
    throw new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.PRINT_FAILED,
      validated.validation.error ?? 'Geçersiz barkod',
    );
  }

  if (!validated.fit.fits) {
    throw new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.PRINT_FAILED,
      validated.fit.warning ?? 'Barkod etikete sığmıyor.',
    );
  }

  const advisoryWarning =
    validated.fit.fits && validated.fit.warning ? validated.fit.warning : undefined;

  return enqueuePrint(async () => {
    await NiimbotPrinterService.ensureConnected();
    const renderPlan = await renderBarcodeLabelBitmap(validated.cleaned, settings);
    const native = loadNativeAdapter();
    if (!native) throw mapNativeError(new Error('NIIMBOT_SDK_REQUIRED'));

    await native.printBarcodeLabel({
      value: validated.cleaned,
      widthMm: settings.labelWidthMm,
      heightMm: settings.labelHeightMm,
      copies,
      mode,
      imageBase64: renderPlan.imageBase64 ?? undefined,
    });

    return advisoryWarning ? { fitWarning: advisoryWarning } : {};
  });
}

export const NiimbotPrinterService = {
  isSupportedPlatform(): boolean {
    return Platform.OS === 'ios';
  },

  async isIntegrationAvailable(): Promise<boolean> {
    const native = loadNativeAdapter();
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
    const native = loadNativeAdapter();
    if (!native) return { connected: false };
    try {
      return await native.getConnectionStatus();
    } catch {
      return { connected: false };
    }
  },

  async scanPrinters(): Promise<NiimbotPrinter[]> {
    const native = loadNativeAdapter();
    if (!native) {
      throw new NiimbotPrinterError(
        NIIMBOT_ERROR_CODES.SDK_REQUIRED,
        'NIIMBOT yazıcı modülü bu sürümde yok. TestFlight\'tan en son build\'i (1.0.1+) yükleyin.',
      );
    }
    try {
      return await native.scanPrinters();
    } catch (error) {
      throw mapNativeError(error);
    }
  },

  async connectPrinter(printer: NiimbotPrinter): Promise<void> {
    const native = loadNativeAdapter();
    if (!native) throw mapNativeError(new Error('NIIMBOT_SDK_REQUIRED'));
    try {
      await native.connectPrinter(printer.id);
      await saveSavedPrinter(printer);
    } catch (error) {
      throw mapNativeError(error);
    }
  },

  async disconnectPrinter(): Promise<void> {
    const native = loadNativeAdapter();
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
        'NIIMBOT yazıcı bağlı değil. Barkod Ayarlarından yazıcı seçin.',
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

  async printProductBarcode(
    value: string,
    options?: { settings?: Awaited<ReturnType<typeof loadBarcodeLabelSettings>>; copies?: number },
  ): Promise<{ fitWarning?: string }> {
    try {
      return await printBarcodeInternal(value, 'product', options);
    } catch (error) {
      throw mapNativeError(error);
    }
  },

  async printPackageBarcode(
    value: string,
    options?: { settings?: Awaited<ReturnType<typeof loadBarcodeLabelSettings>>; copies?: number },
  ): Promise<{ fitWarning?: string }> {
    try {
      return await printBarcodeInternal(value, 'package', options);
    } catch (error) {
      throw mapNativeError(error);
    }
  },

  /** @deprecated Use printProductBarcode or printPackageBarcode. */
  async printBarcode(
    value: string,
    options?: { settings?: Awaited<ReturnType<typeof loadBarcodeLabelSettings>>; copies?: number },
  ): Promise<{ fitWarning?: string }> {
    return this.printProductBarcode(value, options);
  },
};

export type { NiimbotPrinter, NiimbotConnectionStatus };
