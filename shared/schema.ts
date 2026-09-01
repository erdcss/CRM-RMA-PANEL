import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial, unique, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// System user for auto-created records
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Customers table
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").default("Bilinmeyen"),
  phone: text("phone").default("-"),
  accountCode: text("account_code"),
  email: text("email"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Tickets table - represents a customer service interaction
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number"), // Fiş numarası
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  catalogCustomerId: integer("catalog_customer_id"),
  operationType: text("operation_type").default("servis"), // degisim | iade | servis
  salesId: text("sales_id"),
  invoiceId: text("invoice_id"),
  invoiceNumber: text("invoice_number"),
  saleDate: timestamp("sale_date"),
  createdById: integer("created_by_id").notNull().references(() => users.id).default(1),
  ownerUserId: text("owner_user_id"), // Supabase auth user id — per-user data isolation
  rmaStatus: text("rma_status").default("open"),
  rmaClosedAt: timestamp("rma_closed_at"),
  rmaClosedByUserId: text("rma_closed_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// Products table - items associated with tickets
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  catalogProductId: integer("catalog_product_id"),
  name: text("name").default("Bilinmeyen"),
  serialNumber: text("serial_number"),
  stockCode: text("stock_code"),
  barcode: text("barcode"),
  barcodeNumber: text("barcode_number"),
  brand: text("brand").default("Bilinmeyen"),
  model: text("model"),
  category: text("category").default("servis"), // "iade", "degisim", "servis"
  status: text("status").notNull().default("rma_deposunda"),
  defectReason: text("defect_reason"),
  warehouseLocation: text("warehouse_location").default("rma_deposu"),
  description: text("description"),
  quantity: integer("quantity").default(1), // adet sayısı
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Status history for tracking product lifecycle
export const statusHistory = pgTable("status_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  previousStatus: text("previous_status"),
  changedByUserId: text("changed_by_user_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStatusHistorySchema = createInsertSchema(statusHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertStatusHistory = z.infer<typeof insertStatusHistorySchema>;
export type StatusHistory = typeof statusHistory.$inferSelect;

// User-specific product catalog (stock list from Excel imports)
export const catalogProducts = pgTable(
  "catalog_products",
  {
    id: serial("id").primaryKey(),
    stockCode: text("stock_code").notNull(),
    stockName: text("stock_name").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("catalog_products_stock_owner_unique").on(table.stockCode, table.ownerUserId)],
);

export const insertCatalogProductSchema = createInsertSchema(catalogProducts).omit({
  id: true,
  createdAt: true,
});

export type InsertCatalogProduct = z.infer<typeof insertCatalogProductSchema>;
export type CatalogProduct = typeof catalogProducts.$inferSelect;

// User-specific customer/account catalog (cari list from Excel imports)
export const catalogCustomers = pgTable(
  "catalog_customers",
  {
    id: serial("id").primaryKey(),
    accountCode: text("account_code").notNull(),
    accountName: text("account_name").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("catalog_customers_code_owner_unique").on(table.accountCode, table.ownerUserId)],
);

export const insertCatalogCustomerSchema = createInsertSchema(catalogCustomers).omit({
  id: true,
  createdAt: true,
});

export type InsertCatalogCustomer = z.infer<typeof insertCatalogCustomerSchema>;
export type CatalogCustomer = typeof catalogCustomers.$inferSelect;

// A product can be routed to one supplier at a time. The product row remains the single
// source of truth for status so supplier and customer/RMA screens always stay in sync.
export const supplierItems = pgTable(
  "supplier_items",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    supplierAccountCode: text("supplier_account_code").notNull(),
    supplierName: text("supplier_name").notNull(),
    supplierStatus: text("supplier_status").default("bekliyor"),
    ownerUserId: text("owner_user_id").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("supplier_items_product_owner_unique").on(table.productId, table.ownerUserId)],
);

export const insertSupplierItemSchema = createInsertSchema(supplierItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSupplierItem = z.infer<typeof insertSupplierItemSchema>;
export type SupplierItem = typeof supplierItems.$inferSelect;

export const rmaPackages = pgTable(
  "rma_packages",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    packageNumber: text("package_number").notNull(),
    supplierAccountCode: text("supplier_account_code").notNull(),
    supplierName: text("supplier_name").notNull(),
    status: text("status").notNull().default("taslak"),
    barcodeValue: text("barcode_value"),
    qrValue: text("qr_value"),
    createdByUserId: text("created_by_user_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    verifiedAt: timestamp("verified_at"),
    shippedAt: timestamp("shipped_at"),
    deliveredToSupplierAt: timestamp("delivered_to_supplier_at"),
    deliveredByUserId: text("delivered_by_user_id"),
    deliveryNote: text("delivery_note"),
    returnedAt: timestamp("returned_at"),
    returnedByUserId: text("returned_by_user_id"),
    returnNote: text("return_note"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [unique("rma_packages_owner_number_unique").on(table.ownerUserId, table.packageNumber)],
);

export const rmaPackageItems = pgTable("rma_package_items", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => rmaPackages.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  addedByUserId: text("added_by_user_id"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  removedAt: timestamp("removed_at"),
});

export const rmaShipments = pgTable(
  "rma_shipments",
  {
    id: serial("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    packageId: integer("package_id").notNull().references(() => rmaPackages.id, { onDelete: "cascade" }),
    supplierAccountCode: text("supplier_account_code").notNull(),
    supplierName: text("supplier_name").notNull(),
    shipmentNumber: text("shipment_number").notNull(),
    carrierName: text("carrier_name"),
    trackingNumber: text("tracking_number"),
    shippedByUserId: text("shipped_by_user_id"),
    shippedAt: timestamp("shipped_at").defaultNow().notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("sevk_edildi"),
  },
  (table) => [unique("rma_shipments_owner_number_unique").on(table.ownerUserId, table.shipmentNumber)],
);

export const rmaProductMovements = pgTable("rma_product_movements", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  movementType: text("movement_type").notNull(),
  fromLocation: text("from_location"),
  toLocation: text("to_location"),
  packageId: integer("package_id").references(() => rmaPackages.id, { onDelete: "set null" }),
  shipmentId: integer("shipment_id").references(() => rmaShipments.id, { onDelete: "set null" }),
  performedByUserId: text("performed_by_user_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rmaPackageHistory = pgTable("rma_package_history", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull().references(() => rmaPackages.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  eventType: text("event_type").notNull(),
  performedByUserId: text("performed_by_user_id"),
  notes: text("notes"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rmaSupplierResults = pgTable("rma_supplier_results", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  packageId: integer("package_id").references(() => rmaPackages.id, { onDelete: "set null" }),
  supplierAccountCode: text("supplier_account_code").notNull(),
  resultType: text("result_type").notNull(),
  resultDescription: text("result_description"),
  supplierDocumentNumber: text("supplier_document_number"),
  supplierSerialNumber: text("supplier_serial_number"),
  oldSerialNumber: text("old_serial_number"),
  newSerialNumber: text("new_serial_number"),
  newBarcode: text("new_barcode"),
  resultDate: timestamp("result_date").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdByUserId: text("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rmaSupplierResultHistory = pgTable("rma_supplier_result_history", {
  id: serial("id").primaryKey(),
  supplierResultId: integer("supplier_result_id").notNull().references(() => rmaSupplierResults.id, { onDelete: "cascade" }),
  ownerUserId: text("owner_user_id").notNull(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  previousResultType: text("previous_result_type"),
  newResultType: text("new_result_type").notNull(),
  snapshot: text("snapshot"),
  changedByUserId: text("changed_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rmaCustomerDeliveries = pgTable("rma_customer_deliveries", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  deliveredToCustomerAt: timestamp("delivered_to_customer_at").defaultNow().notNull(),
  deliveredByUserId: text("delivered_by_user_id"),
  receiverName: text("receiver_name").notNull(),
  receiverPhone: text("receiver_phone"),
  deliveryNote: text("delivery_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rmaScrapRecords = pgTable("rma_scrap_records", {
  id: serial("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  scrapReason: text("scrap_reason").notNull(),
  description: text("description"),
  attachmentUrl: text("attachment_url"),
  scrappedByUserId: text("scrapped_by_user_id"),
  scrappedAt: timestamp("scrapped_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  customer: one(customers, {
    fields: [tickets.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [tickets.createdById],
    references: [users.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  ticket: one(tickets, {
    fields: [products.ticketId],
    references: [tickets.id],
  }),
  statusHistory: many(statusHistory),
  supplierItems: many(supplierItems),
}));

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  product: one(products, {
    fields: [statusHistory.productId],
    references: [products.id],
  }),
}));

export const supplierItemsRelations = relations(supplierItems, ({ one }) => ({
  product: one(products, {
    fields: [supplierItems.productId],
    references: [products.id],
  }),
}));

export const rmaPackagesRelations = relations(rmaPackages, ({ many }) => ({
  items: many(rmaPackageItems),
  shipments: many(rmaShipments),
  history: many(rmaPackageHistory),
}));

export const rmaPackageItemsRelations = relations(rmaPackageItems, ({ one }) => ({
  package: one(rmaPackages, { fields: [rmaPackageItems.packageId], references: [rmaPackages.id] }),
  product: one(products, { fields: [rmaPackageItems.productId], references: [products.id] }),
}));

export const rmaShipmentsRelations = relations(rmaShipments, ({ one }) => ({
  package: one(rmaPackages, { fields: [rmaShipments.packageId], references: [rmaPackages.id] }),
}));

export const rmaProductMovementsRelations = relations(rmaProductMovements, ({ one }) => ({
  product: one(products, { fields: [rmaProductMovements.productId], references: [products.id] }),
}));

export const rmaPackageHistoryRelations = relations(rmaPackageHistory, ({ one }) => ({
  package: one(rmaPackages, { fields: [rmaPackageHistory.packageId], references: [rmaPackages.id] }),
}));
