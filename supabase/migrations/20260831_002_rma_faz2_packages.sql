-- RMA FAZ 2: packages, package items, shipments, movements, package history

CREATE TABLE IF NOT EXISTS rma_packages (
  id SERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  package_number TEXT NOT NULL,
  supplier_account_code TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'taslak',
  barcode_value TEXT,
  qr_value TEXT,
  created_by_user_id TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP,
  verified_at TIMESTAMP,
  shipped_at TIMESTAMP,
  UNIQUE (owner_user_id, package_number)
);

CREATE TABLE IF NOT EXISTS rma_package_items (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES rma_packages(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  added_by_user_id TEXT,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS rma_package_items_active_product_unique
  ON rma_package_items (product_id)
  WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS rma_shipments (
  id SERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  package_id INTEGER NOT NULL REFERENCES rma_packages(id) ON DELETE CASCADE,
  supplier_account_code TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  shipment_number TEXT NOT NULL,
  carrier_name TEXT,
  tracking_number TEXT,
  shipped_by_user_id TEXT,
  shipped_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'sevk_edildi',
  UNIQUE (owner_user_id, shipment_number)
);

CREATE TABLE IF NOT EXISTS rma_product_movements (
  id SERIAL PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  from_location TEXT,
  to_location TEXT,
  package_id INTEGER REFERENCES rma_packages(id) ON DELETE SET NULL,
  shipment_id INTEGER REFERENCES rma_shipments(id) ON DELETE SET NULL,
  performed_by_user_id TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rma_package_history (
  id SERIAL PRIMARY KEY,
  package_id INTEGER NOT NULL REFERENCES rma_packages(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  performed_by_user_id TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rma_packages_owner_status_idx ON rma_packages(owner_user_id, status);
CREATE INDEX IF NOT EXISTS rma_packages_barcode_idx ON rma_packages(barcode_value);
CREATE INDEX IF NOT EXISTS rma_package_items_package_idx ON rma_package_items(package_id);
CREATE INDEX IF NOT EXISTS rma_product_movements_product_idx ON rma_product_movements(product_id);
CREATE INDEX IF NOT EXISTS rma_shipments_package_idx ON rma_shipments(package_id);
