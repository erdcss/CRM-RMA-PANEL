-- RMA FAZ 3: supplier results, package delivery/return, ticket closure, customer delivery, scrap

ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS delivered_to_supplier_at TIMESTAMP;
ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS delivered_by_user_id TEXT;
ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS delivery_note TEXT;
ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP;
ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS returned_by_user_id TEXT;
ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS return_note TEXT;
ALTER TABLE rma_packages ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rma_status TEXT DEFAULT 'open';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rma_closed_at TIMESTAMP;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rma_closed_by_user_id TEXT;

CREATE TABLE IF NOT EXISTS rma_supplier_results (
  id SERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES rma_packages(id) ON DELETE SET NULL,
  supplier_account_code TEXT NOT NULL,
  result_type TEXT NOT NULL,
  result_description TEXT,
  supplier_document_number TEXT,
  supplier_serial_number TEXT,
  old_serial_number TEXT,
  new_serial_number TEXT,
  new_barcode TEXT,
  result_date TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS rma_supplier_results_active_product_unique
  ON rma_supplier_results (product_id)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS rma_supplier_result_history (
  id SERIAL PRIMARY KEY,
  supplier_result_id INTEGER NOT NULL REFERENCES rma_supplier_results(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_result_type TEXT,
  new_result_type TEXT NOT NULL,
  snapshot JSONB,
  changed_by_user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rma_customer_deliveries (
  id SERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  delivered_to_customer_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivered_by_user_id TEXT,
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT,
  delivery_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rma_scrap_records (
  id SERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  scrap_reason TEXT NOT NULL,
  description TEXT,
  attachment_url TEXT,
  scrapped_by_user_id TEXT,
  scrapped_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rma_supplier_results_owner_idx ON rma_supplier_results(owner_user_id);
CREATE INDEX IF NOT EXISTS rma_supplier_results_package_idx ON rma_supplier_results(package_id);
