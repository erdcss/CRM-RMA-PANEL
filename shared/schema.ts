import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial, unique } from "drizzle-orm/pg-core";
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
  createdById: integer("created_by_id").notNull().references(() => users.id).default(1),
  ownerUserId: text("owner_user_id"), // Supabase auth user id — per-user data isolation
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
  stockCode: text("stock_code"),
  brand: text("brand").default("Bilinmeyen"),
  model: text("model"),
  category: text("category").default("servis"), // "iade", "degisim", "servis"
  status: text("status").notNull().default("beklemede"), // "beklemede", "serviste", "teslim_edildi", etc.
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
}));

export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  product: one(products, {
    fields: [statusHistory.productId],
    references: [products.id],
  }),
}));
