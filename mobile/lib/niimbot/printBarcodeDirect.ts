import { Platform } from 'react-native';

import { NiimbotPrinterService } from '@/lib/niimbot/NiimbotPrinterService';
import { NIIMBOT_ERROR_CODES, NiimbotPrinterError } from '@/lib/niimbot/types';

/**
 * iOS: direct NIIMBOT Bluetooth print (no AirPrint).
 * Other platforms: not implemented in this phase.
 */
export async function printBarcodeDirect(
  value: string,
  options?: { copies?: number },
): Promise<{ fitWarning?: string; usedNiimbot: boolean }> {
  if (Platform.OS !== 'ios') {
    throw new NiimbotPrinterError(
      NIIMBOT_ERROR_CODES.PRINT_FAILED,
      'NIIMBOT doğrudan yazdırma yalnızca iOS için hazırlandı.',
    );
  }

  const result = await NiimbotPrinterService.printBarcode(value, { copies: options?.copies });
  return { ...result, usedNiimbot: true };
}

export function shouldUseNiimbotDirectPrint(): boolean {
  return Platform.OS === 'ios';
}
