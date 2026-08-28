import {
  users,
  customers,
  tickets,
  products,
  statusHistory,
  warehouses,
  suppliers,
  invoices,
  stockMovements,
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Ticket,
  type InsertTicket,
  type Product,
  type InsertProduct,
  type InsertStatusHistory,
  type Warehouse,
  type InsertWarehouse,
  type Supplier,
  type InsertSupplier,
  type Invoice,
  type InsertInvoice,
  type InsertStockMovement,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, count } from "drizzle-orm";

const productRelations = {
  warehouse: true,
  supplier: true,
  invoice: true,
  statusHistory: {
    orderBy: (sh: any, { desc }: any) => [desc(sh.createdAt)],
  },
  stockMovements: {
    orderBy: (sm: any, { desc }: any) => [desc(sm.createdAt)],
  },
} as const;

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  ensureSystemUser(): Promise<void>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<{ ok: boolean; error?: string }>;
  findOrCreateCustomer(customerData: { name: string; phone: string; email?: string; address?: string }): Promise<Customer>;

  getWarehouses(): Promise<Warehouse[]>;
  getWarehouseByCode(code: string): Promise<Warehouse | undefined>;
  createWarehouse(warehouse: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: number, warehouse: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: number): Promise<{ ok: boolean; error?: string }>;

  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: number): Promise<{ ok: boolean; error?: string }>;

  getInvoices(): Promise<any[]>;
  getInvoice(id: number): Promise<any | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<{ ok: boolean; error?: string }>;
  findOrCreateInvoice(data: { invoiceNumber: string; customerId?: number }): Promise<Invoice | undefined>;

  getTickets(): Promise<any[]>;
  getTicket(id: number): Promise<any | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  deleteTicket(id: number): Promise<void>;
  
  getProducts(): Promise<any[]>;
  getProduct(id: number): Promise<any | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, data: Partial<InsertProduct>, options?: { movementNotes?: string; userId?: number }): Promise<Product | undefined>;
  updateProductStatus(id: number, status: string): Promise<void>;
  receiveProductIntoRma(productId: number, userId?: number): Promise<void>;

  createStatusHistory(history: InsertStatusHistory): Promise<void>;
  createStockMovement(movement: InsertStockMovement): Promise<void>;
  getDashboardStats(): Promise<any>;
  getStatistics(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async ensureSystemUser(): Promise<void> {
    const existingUser = await this.getUser(1);
    if (!existingUser) {
      await db.insert(users).values({
        username: "system",
        password: "system",
      });
    }

    const adminUser = await this.getUserByUsername("admin");
    if (!adminUser) {
      await db.insert(users).values({
        username: "admin",
        password: "admin123",
      });
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getCustomers(): Promise<Customer[]> {
    const customersWithCounts = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        createdAt: customers.createdAt,
        ticketCount: count(tickets.id),
      })
      .from(customers)
      .leftJoin(tickets, eq(customers.id, tickets.customerId))
      .groupBy(customers.id)
      .orderBy(desc(customers.createdAt));

    return customersWithCounts;
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db
      .insert(customers)
      .values(insertCustomer)
      .returning();
    return customer;
  }

  async findOrCreateCustomer(customerData: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  }): Promise<Customer> {
    const phone = (customerData.phone || "").trim();
    const hasRealPhone = phone.length > 0 && phone !== "-";

    if (hasRealPhone) {
      const [existingCustomer] = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, phone))
        .limit(1);

      if (existingCustomer) {
        const updates: Partial<InsertCustomer> = {};
        if (customerData.name && customerData.name !== "Bilinmeyen" && customerData.name !== existingCustomer.name) {
          updates.name = customerData.name;
        }
        if (customerData.email && customerData.email !== existingCustomer.email) {
          updates.email = customerData.email;
        }
        if (customerData.address && customerData.address !== existingCustomer.address) {
          updates.address = customerData.address;
        }

        if (Object.keys(updates).length > 0) {
          const [updatedCustomer] = await db
            .update(customers)
            .set(updates)
            .where(eq(customers.id, existingCustomer.id))
            .returning();
          return updatedCustomer;
        }

        return existingCustomer;
      }
    }

    return await this.createCustomer({
      name: customerData.name || "Bilinmeyen",
      phone: hasRealPhone ? phone : "-",
      email: customerData.email,
      address: customerData.address,
    });
  }

  async updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db
      .update(customers)
      .set(customerData)
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  async deleteCustomer(id: number): Promise<{ ok: boolean; error?: string }> {
    const relatedTickets = await db.select({ id: tickets.id }).from(tickets).where(eq(tickets.customerId, id)).limit(1);
    if (relatedTickets.length > 0) {
      return { ok: false, error: "Bu müşteriye bağlı fişler var. Önce fişleri silin." };
    }
    await db.delete(customers).where(eq(customers.id, id));
    return { ok: true };
  }

  async getWarehouses(): Promise<Warehouse[]> {
    return db.select().from(warehouses).orderBy(warehouses.id);
  }

  async getWarehouseByCode(code: string): Promise<Warehouse | undefined> {
    const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.code, code)).limit(1);
    return warehouse;
  }

  async createWarehouse(insertWarehouse: InsertWarehouse): Promise<Warehouse> {
    const [warehouse] = await db.insert(warehouses).values(insertWarehouse).returning();
    return warehouse;
  }

  async updateWarehouse(id: number, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const [updated] = await db.update(warehouses).set(data).where(eq(warehouses.id, id)).returning();
    return updated;
  }

  async deleteWarehouse(id: number): Promise<{ ok: boolean; error?: string }> {
    const related = await db.select({ id: products.id }).from(products).where(eq(products.warehouseId, id)).limit(1);
    if (related.length > 0) {
      return { ok: false, error: "Bu depoya bağlı ürünler var." };
    }
    await db.delete(warehouses).where(eq(warehouses.id, id));
    return { ok: true };
  }

  async getSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(desc(suppliers.createdAt));
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(insertSupplier: InsertSupplier): Promise<Supplier> {
    const [supplier] = await db.insert(suppliers).values(insertSupplier).returning();
    return supplier;
  }

  async updateSupplier(id: number, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updated] = await db.update(suppliers).set(data).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  async deleteSupplier(id: number): Promise<{ ok: boolean; error?: string }> {
    const related = await db.select({ id: products.id }).from(products).where(eq(products.supplierId, id)).limit(1);
    if (related.length > 0) {
      return { ok: false, error: "Bu tedarikçiye bağlı ürünler var." };
    }
    await db.delete(suppliers).where(eq(suppliers.id, id));
    return { ok: true };
  }

  async getInvoices(): Promise<any[]> {
    return db.query.invoices.findMany({
      with: { customer: true },
      orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    });
  }

  async getInvoice(id: number): Promise<any | undefined> {
    return db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: { customer: true, products: true },
    });
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return updated;
  }

  async deleteInvoice(id: number): Promise<{ ok: boolean; error?: string }> {
    const related = await db.select({ id: products.id }).from(products).where(eq(products.invoiceId, id)).limit(1);
    if (related.length > 0) {
      return { ok: false, error: "Bu faturaya bağlı ürünler var." };
    }
    await db.delete(invoices).where(eq(invoices.id, id));
    return { ok: true };
  }

  async findOrCreateInvoice(data: { invoiceNumber: string; customerId?: number }): Promise<Invoice | undefined> {
    const invoiceNumber = data.invoiceNumber.trim();
    if (!invoiceNumber) return undefined;

    const [existing] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber))
      .limit(1);

    if (existing) {
      if (data.customerId && !existing.customerId) {
        const [updated] = await db
          .update(invoices)
          .set({ customerId: data.customerId })
          .where(eq(invoices.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }

    return this.createInvoice({
      invoiceNumber,
      customerId: data.customerId,
      invoiceDate: new Date(),
    });
  }

  async getTickets(): Promise<any[]> {
    const allTickets = await db.query.tickets.findMany({
      with: {
        customer: true,
        products: {
          with: productRelations,
        },
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return allTickets;
  }

  async getTicket(id: number): Promise<any | undefined> {
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
      with: {
        customer: true,
        products: {
          with: productRelations,
        },
      },
    });

    return ticket;
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const [ticket] = await db
      .insert(tickets)
      .values(insertTicket)
      .returning();
    return ticket;
  }

  async deleteTicket(id: number): Promise<void> {
    await db.delete(tickets).where(eq(tickets.id, id));
  }

  async getProducts(): Promise<any[]> {
    const allProducts = await db.query.products.findMany({
      with: {
        ticket: {
          with: {
            customer: true,
          },
        },
        ...productRelations,
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    return allProducts;
  }

  async getProduct(id: number): Promise<any | undefined> {
    return db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        ticket: {
          with: { customer: true },
        },
        ...productRelations,
      },
    });
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values(insertProduct)
      .returning();
    return product;
  }

  async receiveProductIntoRma(productId: number, userId?: number): Promise<void> {
    const rmaWarehouse = await this.getWarehouseByCode("rma");
    await db
      .update(products)
      .set({
        warehouseId: rmaWarehouse?.id,
        location: "rma_depo",
      })
      .where(eq(products.id, productId));

    await this.createStockMovement({
      productId,
      fromWarehouseId: undefined,
      toWarehouseId: rmaWarehouse?.id,
      movementType: "teslim_alma",
      notes: "Ürün teslim alındı ve RMA deposuna alındı",
      createdById: userId,
    });
  }

  async updateProduct(
    id: number,
    data: Partial<InsertProduct>,
    options?: { movementNotes?: string; userId?: number },
  ): Promise<Product | undefined> {
    const current = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!current[0]) return undefined;

    const previous = current[0];
    const [updated] = await db.update(products).set(data).where(eq(products.id, id)).returning();

    if (data.warehouseId && data.warehouseId !== previous.warehouseId) {
      const warehouse = (await db.select().from(warehouses).where(eq(warehouses.id, data.warehouseId)))[0];
      const locationByCode: Record<string, string> = {
        rma: "rma_depo",
        satilabilir: "satilabilir",
        hurda: "hurda",
      };
      const nextLocation = data.location || (warehouse ? locationByCode[warehouse.code] : previous.location);
      if (nextLocation && nextLocation !== updated.location) {
        const [relocated] = await db
          .update(products)
          .set({ location: nextLocation })
          .where(eq(products.id, id))
          .returning();
        await this.createStockMovement({
          productId: id,
          fromWarehouseId: previous.warehouseId ?? undefined,
          toWarehouseId: data.warehouseId,
          movementType: nextLocation,
          notes: options?.movementNotes || "Depo değişikliği",
          createdById: options?.userId,
        });
        return relocated;
      }
      await this.createStockMovement({
        productId: id,
        fromWarehouseId: previous.warehouseId ?? undefined,
        toWarehouseId: data.warehouseId,
        movementType: data.location || previous.location || "rma_depo",
        notes: options?.movementNotes || "Depo değişikliği",
        createdById: options?.userId,
      });
    }

    if (data.location && data.location !== previous.location && !data.warehouseId) {
      await this.createStockMovement({
        productId: id,
        fromWarehouseId: previous.warehouseId ?? undefined,
        toWarehouseId: previous.warehouseId ?? undefined,
        movementType: data.location,
        notes: options?.movementNotes || "Konum güncellendi",
        createdById: options?.userId,
      });
    }

    return updated;
  }

  async updateProductStatus(id: number, newStatus: string): Promise<void> {
    await db
      .update(products)
      .set({ status: newStatus })
      .where(eq(products.id, id));

    await this.createStatusHistory({
      productId: id,
      status: newStatus,
    });
  }

  async createStatusHistory(insertHistory: InsertStatusHistory): Promise<void> {
    await db.insert(statusHistory).values(insertHistory);
  }

  async createStockMovement(insertMovement: InsertStockMovement): Promise<void> {
    await db.insert(stockMovements).values(insertMovement);
  }

  async getDashboardStats(): Promise<any> {
    const totalTicketsResult = await db.select({ count: count() }).from(tickets);
    const totalTickets = totalTicketsResult[0]?.count || 0;

    const activeReturnsResult = await db
      .select({ count: count() })
      .from(products)
      .where(sql`${products.category} = 'iade' AND ${products.status} != 'teslim_edildi'`);
    const activeReturns = activeReturnsResult[0]?.count || 0;

    const activeExchangesResult = await db
      .select({ count: count() })
      .from(products)
      .where(sql`${products.category} = 'degisim' AND ${products.status} != 'teslim_edildi'`);
    const activeExchanges = activeExchangesResult[0]?.count || 0;

    const inServiceResult = await db
      .select({ count: count() })
      .from(products)
      .where(eq(products.status, 'serviste'));
    const inService = inServiceResult[0]?.count || 0;

    const recentTickets = await db.query.products.findMany({
      with: {
        ticket: {
          with: {
            customer: true,
          },
        },
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit: 10,
    });

    const brandStats = await db
      .select({
        brand: products.brand,
        count: count(),
      })
      .from(products)
      .groupBy(products.brand)
      .orderBy(desc(count()))
      .limit(10);

    return {
      totalTickets,
      activeReturns,
      activeExchanges,
      inService,
      recentTickets,
      topBrands: brandStats,
    };
  }

  async getStatistics(): Promise<any> {
    const totalTicketsResult = await db.select({ count: count() }).from(tickets);
    const totalTickets = totalTicketsResult[0]?.count || 0;

    const totalCustomersResult = await db.select({ count: count() }).from(customers);
    const totalCustomers = totalCustomersResult[0]?.count || 0;

    const brandStats = await db
      .select({
        brand: products.brand,
        count: count(),
      })
      .from(products)
      .groupBy(products.brand)
      .orderBy(desc(count()));

    const categoryStats = await db
      .select({
        category: products.category,
        count: count(),
      })
      .from(products)
      .groupBy(products.category);

    const monthlyStats = await db
      .select({
        month: sql<string>`TO_CHAR(${tickets.createdAt}, 'Mon')`,
        count: count(),
      })
      .from(tickets)
      .groupBy(sql`TO_CHAR(${tickets.createdAt}, 'Mon'), TO_CHAR(${tickets.createdAt}, 'MM')`)
      .orderBy(sql`TO_CHAR(${tickets.createdAt}, 'MM')`)
      .limit(6);

    const topCustomers = await db
      .select({
        name: customers.name,
        ticketCount: count(tickets.id),
      })
      .from(customers)
      .leftJoin(tickets, eq(customers.id, tickets.customerId))
      .groupBy(customers.id, customers.name)
      .having(sql`count(${tickets.id}) > 0`)
      .orderBy(desc(count(tickets.id)))
      .limit(10);

    return {
      totalTickets,
      totalCustomers,
      avgProcessingTime: 3,
      brandStats,
      categoryStats,
      monthlyStats,
      topCustomers,
    };
  }
}

export const storage = new DatabaseStorage();
