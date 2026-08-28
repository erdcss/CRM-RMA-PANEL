import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial } from "drizzle-orm/pg-core";
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

export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // rma, satilabilir, hurda
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWarehouseSchema = createInsertSchema(warehouses).omit({
  id: true,
  createdAt: true,
});

export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehouses.$inferSelect;

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  invoiceDate: timestamp("invoice_date").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Tickets table - represents a customer service interaction
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number"), // Fiş numarası
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  createdById: integer("created_by_id").notNull().references(() => users.id).default(1),
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
  name: text("name").default("Bilinmeyen"),
  serialNumber: text("serial_number"),
  brand: text("brand").default("Bilinmeyen"),
  model: text("model"),
  category: text("category").default("servis"), // "iade", "degisim", "servis"
  status: text("status").notNull().default("beklemede"), // "beklemede", "serviste", "teslim_edildi", etc.
  description: text("description"),
  quantity: integer("quantity").default(1), // adet sayısı
  imageUrl: text("image_url"),
  barcode: text("barcode"),
  faultReason: text("fault_reason"),
  warehouseId: integer("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  location: text("location").default("rma_depo"), // rma_depo, satilabilir, hurda, tedarikci, musteri
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
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStatusHistorySchema = createInsertSchema(statusHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertStatusHistory = z.infer<typeof insertStatusHistorySchema>;
export type StatusHistory = typeof statusHistory.$inferSelect;

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  fromWarehouseId: integer("from_warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  toWarehouseId: integer("to_warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  movementType: text("movement_type").notNull(), // teslim_alma, rma_depo, satilabilir, hurda, tedarikci, musteri
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({
  id: true,
  createdAt: true,
});

export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  tickets: many(tickets),
  invoices: many(invoices),
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

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  products: many(products),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  ticket: one(tickets, {
    fields: [products.ticketId],
    references: [tickets.id],
  }),
  warehouse: one(warehouses, {
    fields: [products.warehouseId],
    references: [warehouses.id],
  }),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  invoice: one(invoices, {
    fields: [products.invoiceId],
    references: [invoices.id],
  }),
  statusHistory: many(statusHistory),
  stockMovements: many(stockMovements),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  fromWarehouse: one(warehouses, {
    fields: [stockMovements.fromWarehouseId],
    references: [warehouses.id],
  }),
  toWarehouse: one(warehouses, {
    fields: [stockMovements.toWarehouseId],
    references: [warehouses.id],
  }),
}));

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  product: one(products, {
    fields: [statusHistory.productId],
    references: [products.id],
  }),
}));
