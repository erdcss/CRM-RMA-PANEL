-- Per-product 9-digit shipment barcode for NIIMBOT D110-M labels (Code 128).
-- Stored as TEXT to preserve leading zeros (e.g. 004827319).

ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_number_unique
  ON products (barcode_number)
  WHERE barcode_number IS NOT NULL;
