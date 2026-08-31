import {
  users,
  customers,
  tickets,
  products,
  statusHistory,
  type User,
  type InsertUser,
  type Customer,
  catalogProducts,
  type InsertCatalogProduct,
  type CatalogProduct,
  catalogCustomers,
  type InsertCatalogCustomer,
  type CatalogCustomer,
  type InsertCustomer,
  type Ticket,
  type InsertTicket,
  type Product,
  type InsertProduct,
  type InsertStatusHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, count, and, or, ilike, isNull, inArray, notInArray } from "drizzle-orm";
import {
  RMA_CLOSED_STATUSES,
  RMA_SUPPLIER_WAITING_STATUSES,
  RMA_DEFAULT_PRODUCT_STATUS,
  RMA_DEFAULT_WAREHOUSE_LOCATION,
} from "@shared/rma-constants";

function normalizeTicketIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[{}]/g, "").trim();
    if (!cleaned) return [];
    return cleaned
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  return [];
}

function ownerTicketFilter(ownerUserId?: string) {
  if (!ownerUserId) return undefined;
  return or(eq(tickets.ownerUserId, ownerUserId), isNull(tickets.ownerUserId));
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  ensureSystemUser(): Promise<void>;

  getCustomers(ownerUserId?: string): Promise<Customer[]>;
  getCustomer(id: number, ownerUserId?: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  findOrCreateCustomer(customerData: {
    name: string;
    phone: string;
    accountCode?: string;
    email?: string;
    address?: string;
  }): Promise<Customer>;

  getTickets(ownerUserId?: string): Promise<any[]>;
  getTicket(id: number, ownerUserId?: string): Promise<any | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  deleteTicket(id: number): Promise<void>;
  
  getProducts(ownerUserId?: string): Promise<any[]>;
  getProduct(id: number, ownerUserId?: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductStatus(
    id: number,
    status: string,
    options?: { previousStatus?: string; changedByUserId?: string; notes?: string },
  ): Promise<void>;

  createStatusHistory(history: InsertStatusHistory): Promise<void>;
  getDashboardStats(ownerUserId?: string): Promise<any>;
  getStatistics(ownerUserId?: string): Promise<any>;
  getRmaMetrics(ownerUserId?: string): Promise<any>;

  getCatalogProducts(ownerUserId: string, query?: string): Promise<CatalogProduct[]>;
  bulkUpsertCatalogProducts(items: InsertCatalogProduct[]): Promise<number>;
  getCatalogCustomers(ownerUserId: string, query?: string): Promise<CatalogCustomer[]>;
  bulkUpsertCatalogCustomers(items: InsertCatalogCustomer[]): Promise<number>;
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

  async getCustomers(ownerUserId?: string): Promise<Customer[]> {
    const customersWithCounts = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        accountCode: customers.accountCode,
        email: customers.email,
        address: customers.address,
        createdAt: customers.createdAt,
        ticketCount: count(tickets.id),
      })
      .from(customers)
      .leftJoin(
        tickets,
        ownerUserId
          ? and(eq(customers.id, tickets.customerId), ownerTicketFilter(ownerUserId)!)
          : eq(customers.id, tickets.customerId),
      )
      .groupBy(customers.id)
      .orderBy(desc(customers.createdAt));

    if (ownerUserId) {
      return customersWithCounts.filter((c) => (c.ticketCount ?? 0) > 0);
    }

    return customersWithCounts;
  }

  async getCustomer(id: number, ownerUserId?: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    if (!customer) return undefined;

    if (ownerUserId) {
      const [owned] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(and(eq(tickets.customerId, id), ownerTicketFilter(ownerUserId)!))
        .limit(1);
      if (!owned) return undefined;
    }

    return customer;
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
    accountCode?: string;
    email?: string;
    address?: string;
  }): Promise<Customer> {
    const accountCode = customerData.accountCode?.trim();
    if (accountCode) {
      const [existingByCode] = await db
        .select()
        .from(customers)
        .where(eq(customers.accountCode, accountCode))
        .limit(1);

      if (existingByCode) {
        const needsUpdate =
          existingByCode.name !== customerData.name ||
          existingByCode.email !== customerData.email ||
          existingByCode.address !== customerData.address ||
          (customerData.phone && customerData.phone !== "-" && existingByCode.phone !== customerData.phone);

        if (needsUpdate) {
          const [updatedCustomer] = await db
            .update(customers)
            .set({
              name: customerData.name,
              email: customerData.email,
              address: customerData.address,
              ...(customerData.phone && customerData.phone !== "-" ? { phone: customerData.phone } : {}),
            })
            .where(eq(customers.id, existingByCode.id))
            .returning();
          return updatedCustomer;
        }

        return existingByCode;
      }
    }

    const phone = customerData.phone?.trim() || "-";
    if (phone !== "-") {
      const [existingCustomer] = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, phone))
        .limit(1);

      if (existingCustomer) {
        const needsUpdate =
          existingCustomer.name !== customerData.name ||
          existingCustomer.email !== customerData.email ||
          existingCustomer.address !== customerData.address ||
          (accountCode && existingCustomer.accountCode !== accountCode);

        if (needsUpdate) {
          const [updatedCustomer] = await db
            .update(customers)
            .set({
              name: customerData.name,
              email: customerData.email,
              address: customerData.address,
              ...(accountCode ? { accountCode } : {}),
            })
            .where(eq(customers.id, existingCustomer.id))
            .returning();
          return updatedCustomer;
        }

        return existingCustomer;
      }
    }

    return await this.createCustomer({
      name: customerData.name,
      phone,
      accountCode: accountCode || undefined,
      email: customerData.email,
      address: customerData.address,
    });
  }

  async getTickets(ownerUserId?: string): Promise<any[]> {
    const allTickets = await db.query.tickets.findMany({
      where: ownerTicketFilter(ownerUserId),
      with: {
        customer: true,
        products: {
          with: {
            statusHistory: {
              orderBy: (sh, { desc }) => [desc(sh.createdAt)],
            },
            supplierItems: true,
          },
        },
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return allTickets;
  }

  async getTicket(id: number, ownerUserId?: string): Promise<any | undefined> {
    const ticket = await db.query.tickets.findFirst({
      where: ownerUserId
        ? and(eq(tickets.id, id), ownerTicketFilter(ownerUserId)!)
        : eq(tickets.id, id),
      with: {
        customer: true,
        products: {
          with: {
            statusHistory: {
              orderBy: (sh, { desc }) => [desc(sh.createdAt)],
            },
            supplierItems: true,
          },
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

  async getProducts(ownerUserId?: string): Promise<any[]> {
    const allProducts = await db.query.products.findMany({
      with: {
        ticket: {
          with: {
            customer: true,
          },
        },
        statusHistory: {
          orderBy: (sh, { desc }) => [desc(sh.createdAt)],
        },
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    if (!ownerUserId) return allProducts;

    return allProducts.filter(
      (p) => !p.ticket?.ownerUserId || p.ticket.ownerUserId === ownerUserId,
    );
  }

  async getProduct(id: number, ownerUserId?: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) return undefined;

    if (ownerUserId) {
      const [ticket] = await db
        .select({ ownerUserId: tickets.ownerUserId })
        .from(tickets)
        .where(eq(tickets.id, product.ticketId))
        .limit(1);
      if (ticket?.ownerUserId && ticket.ownerUserId !== ownerUserId) {
        return undefined;
      }
    }

    return product;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values(insertProduct)
      .returning();
    return product;
  }

  async updateProductStatus(
    id: number,
    newStatus: string,
    options?: { previousStatus?: string; changedByUserId?: string; notes?: string },
  ): Promise<void> {
    const existing = await this.getProduct(id);
    const previousStatus = options?.previousStatus ?? existing?.status;

    await db
      .update(products)
      .set({ status: newStatus })
      .where(eq(products.id, id));

    await this.createStatusHistory({
      productId: id,
      status: newStatus,
      previousStatus: previousStatus || undefined,
      changedByUserId: options?.changedByUserId,
      notes: options?.notes,
    });
  }

  async createStatusHistory(insertHistory: InsertStatusHistory): Promise<void> {
    await db.insert(statusHistory).values(insertHistory);
  }

  async getDashboardStats(ownerUserId?: string): Promise<any> {
    const ticketFilter = ownerTicketFilter(ownerUserId);

    const totalTicketsResult = await db
      .select({ count: count() })
      .from(tickets)
      .where(ticketFilter);
    const totalTickets = totalTicketsResult[0]?.count || 0;

    const productOwnerFilter = ownerUserId
      ? sql`${products.ticketId} in (select id from tickets where owner_user_id = ${ownerUserId} or owner_user_id is null)`
      : undefined;

    const activeReturnsResult = await db
      .select({ count: count() })
      .from(products)
      .where(
        productOwnerFilter
          ? and(
              sql`${products.category} = 'iade' AND ${products.status} != 'teslim_edildi'`,
              productOwnerFilter,
            )
          : sql`${products.category} = 'iade' AND ${products.status} != 'teslim_edildi'`,
      );
    const activeReturns = activeReturnsResult[0]?.count || 0;

    const activeExchangesResult = await db
      .select({ count: count() })
      .from(products)
      .where(
        productOwnerFilter
          ? and(
              sql`${products.category} = 'degisim' AND ${products.status} != 'teslim_edildi'`,
              productOwnerFilter,
            )
          : sql`${products.category} = 'degisim' AND ${products.status} != 'teslim_edildi'`,
      );
    const activeExchanges = activeExchangesResult[0]?.count || 0;

    const inServiceResult = await db
      .select({ count: count() })
      .from(products)
      .where(
        productOwnerFilter
          ? and(eq(products.status, 'serviste'), productOwnerFilter)
          : eq(products.status, 'serviste'),
      );
    const inService = inServiceResult[0]?.count || 0;

    const allProducts = await db.query.products.findMany({
      with: {
        ticket: {
          with: {
            customer: true,
          },
        },
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit: 50,
    });

    const recentTickets = ownerUserId
      ? allProducts.filter((p) => !p.ticket?.ownerUserId || p.ticket.ownerUserId === ownerUserId).slice(0, 10)
      : allProducts.slice(0, 10);

    const brandStatsQuery = ownerUserId
      ? db
          .select({ brand: products.brand, count: count() })
          .from(products)
          .innerJoin(tickets, eq(products.ticketId, tickets.id))
          .where(ownerTicketFilter(ownerUserId)!)
          .groupBy(products.brand)
          .orderBy(desc(count()))
          .limit(10)
      : db
          .select({ brand: products.brand, count: count() })
          .from(products)
          .groupBy(products.brand)
          .orderBy(desc(count()))
          .limit(10);

    const brandStats = await brandStatsQuery;

    return {
      totalTickets,
      activeReturns,
      activeExchanges,
      inService,
      recentTickets,
      topBrands: brandStats,
    };
  }

  private productOwnerSql(ownerUserId?: string) {
    return ownerUserId
      ? sql`${products.ticketId} in (select id from tickets where owner_user_id = ${ownerUserId} or owner_user_id is null)`
      : undefined;
  }

  async getRmaMetrics(ownerUserId?: string): Promise<any> {
    const ownerFilter = this.productOwnerSql(ownerUserId);
    const closedList = [...RMA_CLOSED_STATUSES];
    const supplierWaitingList = [...RMA_SUPPLIER_WAITING_STATUSES];

    const baseWhere = ownerFilter ? and(ownerFilter) : undefined;

    const openResult = await db
      .select({ count: count() })
      .from(products)
      .where(
        baseWhere
          ? and(baseWhere, notInArray(products.status, closedList))
          : notInArray(products.status, closedList),
      );

    const warehouseResult = await db
      .select({ count: count() })
      .from(products)
      .where(
        baseWhere
          ? and(
              baseWhere,
              eq(products.warehouseLocation, RMA_DEFAULT_WAREHOUSE_LOCATION),
              notInArray(products.status, closedList),
            )
          : and(
              eq(products.warehouseLocation, RMA_DEFAULT_WAREHOUSE_LOCATION),
              notInArray(products.status, closedList),
            ),
      );

    const supplierWaitingResult = await db
      .select({ count: count() })
      .from(products)
      .where(
        baseWhere
          ? and(baseWhere, inArray(products.status, supplierWaitingList))
          : inArray(products.status, supplierWaitingList),
      );

    const completedResult = await db
      .select({ count: count() })
      .from(products)
      .where(
        baseWhere
          ? and(baseWhere, inArray(products.status, closedList))
          : inArray(products.status, closedList),
      );

    const ticketFilter = ownerTicketFilter(ownerUserId);
    const ticketJoinFilter = ownerTicketFilter(ownerUserId) ?? sql`true`;

    const byOperation = await db
      .select({
        operationType: tickets.operationType,
        count: count(),
      })
      .from(tickets)
      .where(ticketFilter)
      .groupBy(tickets.operationType);

    const byCategory = await db
      .select({
        category: products.category,
        count: count(),
      })
      .from(products)
      .innerJoin(tickets, eq(products.ticketId, tickets.id))
      .where(ticketJoinFilter)
      .groupBy(products.category);

    const operationCounts = {
      servis: 0,
      iade: 0,
      degisim: 0,
    };

    for (const row of byOperation) {
      const key = row.operationType as keyof typeof operationCounts;
      if (key in operationCounts) operationCounts[key] = Number(row.count);
    }

    for (const row of byCategory) {
      const key = row.category as keyof typeof operationCounts;
      if (key in operationCounts && operationCounts[key] === 0) {
        operationCounts[key] = Number(row.count);
      }
    }

    return {
      openRma: openResult[0]?.count || 0,
      inRmaWarehouse: warehouseResult[0]?.count || 0,
      supplierWaiting: supplierWaitingResult[0]?.count || 0,
      completed: completedResult[0]?.count || 0,
      byOperationType: operationCounts,
    };
  }

  async getStatistics(ownerUserId?: string): Promise<any> {
    const ticketFilter = ownerTicketFilter(ownerUserId);
    const ticketJoinFilter = ownerTicketFilter(ownerUserId) ?? sql`true`;

    const totalTicketsResult = await db
      .select({ count: count() })
      .from(tickets)
      .where(ticketFilter);
    const totalTickets = totalTicketsResult[0]?.count || 0;

    const totalCustomersQuery = ownerUserId
      ? db
          .select({ count: sql<number>`count(distinct ${tickets.customerId})` })
          .from(tickets)
          .where(ownerTicketFilter(ownerUserId)!)
      : db.select({ count: count() }).from(customers);
    const totalCustomersResult = await totalCustomersQuery;
    const totalCustomers = Number(totalCustomersResult[0]?.count || 0);

    const avgProcessingResult = await db
      .select({
        avg: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.updatedAt} - ${tickets.createdAt})) / 86400), 0)`,
      })
      .from(tickets)
      .where(ticketFilter);
    const avgProcessingTime = Math.round(Number(avgProcessingResult[0]?.avg || 0));

    const brandStats = await db
      .select({
        brand: products.brand,
        count: count(),
        ticketIds: sql<number[]>`array_agg(distinct ${tickets.id})`,
      })
      .from(products)
      .innerJoin(tickets, eq(products.ticketId, tickets.id))
      .where(ticketJoinFilter)
      .groupBy(products.brand)
      .orderBy(desc(count()));

    const categoryStats = await db
      .select({
        category: products.category,
        count: count(),
        ticketIds: sql<number[]>`array_agg(distinct ${tickets.id})`,
      })
      .from(products)
      .innerJoin(tickets, eq(products.ticketId, tickets.id))
      .where(ticketJoinFilter)
      .groupBy(products.category)
      .orderBy(desc(count()));

    const monthlyStats = await db
      .select({
        monthKey: sql<string>`TO_CHAR(${tickets.createdAt}, 'YYYY-MM')`,
        month: sql<string>`TO_CHAR(${tickets.createdAt}, 'YYYY-MM')`,
        count: count(),
        ticketIds: sql<number[]>`array_agg(${tickets.id} ORDER BY ${tickets.createdAt} DESC)`,
      })
      .from(tickets)
      .where(
        ticketFilter
          ? and(ticketFilter, sql`${tickets.createdAt} >= NOW() - INTERVAL '6 months'`)
          : sql`${tickets.createdAt} >= NOW() - INTERVAL '6 months'`,
      )
      .groupBy(sql`TO_CHAR(${tickets.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${tickets.createdAt}, 'YYYY-MM')`);

    const topCustomers = await db
      .select({
        customerId: customers.id,
        name: customers.name,
        ticketCount: count(tickets.id),
        ticketIds: sql<number[]>`array_agg(${tickets.id} ORDER BY ${tickets.createdAt} DESC)`,
        latestTicketId: sql<number>`(array_agg(${tickets.id} ORDER BY ${tickets.createdAt} DESC))[1]`,
      })
      .from(customers)
      .innerJoin(tickets, eq(customers.id, tickets.customerId))
      .where(ticketJoinFilter)
      .groupBy(customers.id, customers.name)
      .orderBy(desc(count(tickets.id)))
      .limit(10);

    const currentMonthResult = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        ticketFilter
          ? and(
              ticketFilter,
              sql`TO_CHAR(${tickets.createdAt}, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`,
            )
          : sql`TO_CHAR(${tickets.createdAt}, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`,
      );
    const currentMonthTickets = currentMonthResult[0]?.count || 0;
    const rmaMetrics = await this.getRmaMetrics(ownerUserId);

    return {
      totalTickets,
      totalCustomers,
      avgProcessingTime,
      currentMonthTickets,
      rmaMetrics,
      brandStats: brandStats.map((item) => ({
        ...item,
        ticketIds: normalizeTicketIds(item.ticketIds),
      })),
      categoryStats: categoryStats.map((item) => ({
        ...item,
        ticketIds: normalizeTicketIds(item.ticketIds),
      })),
      monthlyStats: monthlyStats.map((item) => ({
        ...item,
        ticketIds: normalizeTicketIds(item.ticketIds),
      })),
      topCustomers: topCustomers.map((item) => ({
        ...item,
        ticketIds: normalizeTicketIds(item.ticketIds),
        latestTicketId: Number(item.latestTicketId) || normalizeTicketIds(item.ticketIds)[0] || null,
      })),
    };
  }

  async getCatalogProducts(ownerUserId: string, query?: string): Promise<CatalogProduct[]> {
    const q = query?.trim();
    const filters = q
      ? and(
          eq(catalogProducts.ownerUserId, ownerUserId),
          or(
            ilike(catalogProducts.stockCode, `%${q}%`),
            ilike(catalogProducts.stockName, `%${q}%`),
          ),
        )
      : eq(catalogProducts.ownerUserId, ownerUserId);

    return db
      .select()
      .from(catalogProducts)
      .where(filters)
      .orderBy(catalogProducts.stockCode);
  }

  async bulkUpsertCatalogProducts(items: InsertCatalogProduct[]): Promise<number> {
    if (items.length === 0) return 0;

    let inserted = 0;
    const chunkSize = 200;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await db
        .insert(catalogProducts)
        .values(chunk)
        .onConflictDoUpdate({
          target: [catalogProducts.stockCode, catalogProducts.ownerUserId],
          set: { stockName: sql`excluded.stock_name` },
        });
      inserted += chunk.length;
    }
    return inserted;
  }

  async getCatalogCustomers(ownerUserId: string, query?: string): Promise<CatalogCustomer[]> {
    const q = query?.trim();
    const filters = q
      ? and(
          eq(catalogCustomers.ownerUserId, ownerUserId),
          or(
            ilike(catalogCustomers.accountCode, `%${q}%`),
            ilike(catalogCustomers.accountName, `%${q}%`),
          ),
        )
      : eq(catalogCustomers.ownerUserId, ownerUserId);

    return db
      .select()
      .from(catalogCustomers)
      .where(filters)
      .orderBy(catalogCustomers.accountCode);
  }

  async bulkUpsertCatalogCustomers(items: InsertCatalogCustomer[]): Promise<number> {
    if (items.length === 0) return 0;

    let inserted = 0;
    const chunkSize = 200;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await db
        .insert(catalogCustomers)
        .values(chunk)
        .onConflictDoUpdate({
          target: [catalogCustomers.accountCode, catalogCustomers.ownerUserId],
          set: { accountName: sql`excluded.account_name` },
        });
      inserted += chunk.length;
    }
    return inserted;
  }
}

export const storage = new DatabaseStorage();
