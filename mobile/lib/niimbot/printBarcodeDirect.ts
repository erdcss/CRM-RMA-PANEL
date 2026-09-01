import { Platform } from 'react-native';

import { NiimbotPrinterService } from '@/lib/niimbot/NiimbotPrinterService';
import { NIIMBOT_ERROR_CODES, NiimbotPrinterError } from '@/lib/niimbot/types';

type PrintOptions = { copies?: number };

/**
 * iOS: direct NIIMBOT Bluetooth print — 9-digit product shipment barcode.
 */
export async function printProductBarcodeDirect(
  value: string,
  options?: PrintOptions,
): Promise<{ fitWarning?: string; usedNiimbot: boolean }> {
  if (Platform.OS !== 'ios') {
    throw new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.PRINT_FAILED,
      'NIIMBOT doğrudan yazdırma yalnızca iOS için hazırlandı.',
    );
  }

  const result = await NiimbotPrinterService.printProductBarcode(value, { copies: options?.copies });
  return { ...result, usedNiimbot: true };
}

/**
 * iOS: direct NIIMBOT Bluetooth print — package/koli scan token (alphanumeric Code128).
 */
export async function printPackageBarcodeDirect(
  value: string,
  options?: PrintOptions,
): Promise<{ fitWarning?: string; usedNiimbot: boolean }> {
  if (Platform.OS !== 'ios') {
    throw new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.PRINT_FAILED,
      'NIIMBOT doğrudan yazdırma yalnızca iOS için hazırlandı.',
    );
  }

  const result = await NiimbotPrinterService.printPackageBarcode(value, { copies: options?.copies });
  return { ...result, usedNiimbot: true };
}

/** @deprecated Use printProductBarcodeDirect or printPackageBarcodeDirect. */
export async function printBarcodeDirect(
  value: string,
  options?: PrintOptions,
): Promise<{ fitWarning?: string; usedNiimbot: boolean }> {
  return printProductBarcodeDirect(value, options);
}

export function shouldUseNiimbotDirectPrint(): boolean {
  return Platform.OS === 'ios';
}
