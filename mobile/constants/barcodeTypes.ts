/** Kamera taraması — Code128 öncelikli; NIIMBOT etiketleri için ek formatlar. */
export const SCAN_BARCODE_TYPES = [
  'code128',
  'code39',
  'code93',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'itf14',
  'codabar',
  'qr',
  'pdf417',
  'datamatrix',
] as const;
