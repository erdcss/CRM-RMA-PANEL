import {
  users,
  customers,
  tickets,
  products,
  statusHistory,
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Ticket,
  type InsertTicket,
  type Product,
  type InsertProduct,
  type InsertStatusHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, count } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  ensureSystemUser(): Promise<void>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  findOrCreateCustomer(customerData: { name: string; phone: string; email?: string; address?: string }): Promise<Customer>;

  getTickets(): Promise<any[]>;
  getTicket(id: number): Promise<any | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  
  getProducts(): Promise<any[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductStatus(id: number, status: string): Promise<void>;

  createStatusHistory(history: InsertStatusHistory): Promise<void>;
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
    const [existingCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, customerData.phone))
      .limit(1);

    if (existingCustomer) {
      // Update customer information if it has changed
      const needsUpdate = 
        existingCustomer.name !== customerData.name ||
        existingCustomer.email !== customerData.email ||
        existingCustomer.address !== customerData.address;

      if (needsUpdate) {
        const [updatedCustomer] = await db
          .update(customers)
          .set({
            name: customerData.name,
            email: customerData.email,
            address: customerData.address,
          })
          .where(eq(customers.id, existingCustomer.id))
          .returning();
        return updatedCustomer;
      }

      return existingCustomer;
    }

    return await this.createCustomer(customerData);
  }

  async getTickets(): Promise<any[]> {
    const allTickets = await db.query.tickets.findMany({
      with: {
        customer: true,
        products: {
          with: {
            statusHistory: {
              orderBy: (sh, { desc }) => [desc(sh.createdAt)],
            },
          },
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
          with: {
            statusHistory: {
              orderBy: (sh, { desc }) => [desc(sh.createdAt)],
            },
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

  async getProducts(): Promise<any[]> {
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

    return allProducts;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values(insertProduct)
      .returning();
    return product;
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
