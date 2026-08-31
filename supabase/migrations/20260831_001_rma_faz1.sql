-- RMA FAZ 1: operation type, catalog links, product fields, status history, sales refs

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'servis';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS catalog_customer_id INTEGER REFERENCES catalog_customers(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sales_id TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sale_date TIMESTAMP;

ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_product_id INTEGER REFERENCES catalog_products(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS defect_reason TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_location TEXT DEFAULT 'rma_deposu';

ALTER TABLE status_history ADD COLUMN IF NOT EXISTS previous_status TEXT;
ALTER TABLE status_history ADD COLUMN IF NOT EXISTS changed_by_user_id TEXT;

CREATE TABLE IF NOT EXISTS supplier_items (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_account_code TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  supplier_status TEXT DEFAULT 'bekliyor',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_items_product_owner_unique UNIQUE (product_id, owner_user_id)
);

ALTER TABLE supplier_items ADD COLUMN IF NOT EXISTS supplier_status TEXT DEFAULT 'bekliyor';

CREATE INDEX IF NOT EXISTS tickets_operation_type_idx ON tickets(operation_type);
CREATE INDEX IF NOT EXISTS products_warehouse_location_idx ON products(warehouse_location);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
