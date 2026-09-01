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
  imageBase64?: string;
};

export interface NiimbotPrinterAdapter {
  scanPrinters(): Promise<NiimbotPrinter[]>;
  connectPrinter(id: string): Promise<void>;
  disconnectPrinter(): Promise<void>;
  getConnectionStatus(): Promise<NiimbotConnectionStatus>;
  printBarcodeLabel(options: PrintBarcodeLabelOptions): Promise<void>;
  isIntegrationAvailable(): Promise<boolean>;
}

export const NIIMBOT_ERROR_CODES = {
  SDK_REQUIRED: 'NIIMBOT_SDK_REQUIRED',
  SETUP: 'NIIMBOT_SETUP',
  BLUETOOTH_OFF: 'BLUETOOTH_OFF',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  PRINTER_NOT_FOUND: 'PRINTER_NOT_FOUND',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  PRINT_FAILED: 'PRINT_FAILED',
  PRINT_BUSY: 'PRINT_BUSY',
} as const;

export type NiimbotErrorCode = (typeof NIIMBOT_ERROR_CODES)[keyof typeof NIIMBOT_ERROR_CODES];

export class NiimbotPrinterError extends Error {
  code: NiimbotErrorCode;

  constructor(code: NiimbotErrorCode, message: string) {
    super(message);
    this.name = 'NiimbotPrinterError';
    this.code = code;
  }
}

export function mapNativeError(error: unknown): NiimbotPrinterError {
  if (error instanceof NiimbotPrinterError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code ?? '';

  if (code === NIIMBOT_ERROR_CODES.SDK_REQUIRED || message.includes('NIIMBOT_SDK_REQUIRED')) {
    return new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.SDK_REQUIRED,
      'NIIMBOT yazıcı modülü bu sürümde yok. TestFlight\'tan en son build\'i (1.0.1+) yükleyin.',
    );
  }
  if (code === NIIMBOT_ERROR_CODES.SETUP || code === 'NIIMBOT_SETUP') {
    return new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.SETUP,
      message || 'NIIMBOT yazıcı kaynakları yüklenemedi. Uygulamayı güncelleyip tekrar deneyin.',
    );
  }
  if (/bluetooth.*off|powered off|unavailable/i.test(message)) {
    return new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.BLUETOOTH_OFF,
      "Bluetooth kapalı. Yazıcıya bağlanmak için Bluetooth'u açın.",
    );
  }
  if (/permission|denied|authorized/i.test(message)) {
    return new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.PERMISSION_DENIED,
      "Bluetooth izni gerekli. Ayarlar'dan Çalışkan RMA için Bluetooth erişimini açın.",
    );
  }
  if (/not found|bulunamad/i.test(message)) {
    return new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.PRINTER_NOT_FOUND,
      'NIIMBOT D110-M bulunamadı. Yazıcının açık ve yakında olduğundan emin olun.',
    );
  }
  if (code === NIIMBOT_ERROR_CODES.PRINT_BUSY || message.includes('PRINT_BUSY')) {
    return new NiimbotPrinterError(NIIMBOT_ERROR_CODES.PRINT_BUSY, 'Yazdırma devam ediyor.');
  }
  if (code === NIIMBOT_ERROR_CODES.CONNECTION_FAILED || code === 'CONNECTION_FAILED') {
    return new NiimbotPrinterError(NIIMBOT_ERROR_CODES.CONNECTION_FAILED, message || 'Yazıcı bağlantısı kurulamadı.');
  }

  return new NiimbotPrinterError(NIIMBOT_ERROR_CODES.PRINT_FAILED, message || 'Barkod yazdırılamadı. Yazıcı bağlantısını kontrol edin.');
}

export function rssiLabel(rssi?: number): string {
  if (rssi == null) return '—';
  if (rssi >= -55) return 'Güçlü';
  if (rssi >= -70) return 'Orta';
  return 'Zayıf';
}
