import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema } from "@shared/schema";
import {
  createOrMoveSupplierItem,
  deleteSupplierItem,
  getOwnedProduct,
  listSupplierItems,
  updateOwnedProduct,
  updateSupplierItem,
} from "./suppliers";
import { z } from "zod";

let dbReady = false;

async function initDatabase(): Promise<void> {
  const maxRetries = 20;
  const delayMs = 5000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await storage.ensureSystemUser();
      dbReady = true;
      console.log("Database connected successfully");
      return;
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("disabled") || msg.includes("endpoint") || msg.includes("connect")) {
        console.log(`Database waking up... retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
  console.error("Database failed to connect after retries - app running without DB");
}

function getOwnerUserId(req: Request): string | undefined {
  const header = req.header("X-Owner-User-Id");
  if (header?.trim()) return header.trim();
  const query = req.query.ownerUserId;
  if (typeof query === "string" && query.trim()) return query.trim();
  return undefined;
}

function requireOwnerUserId(req: Request): string | undefined {
  return getOwnerUserId(req);
}

export async function registerRoutes(app: Express): Promise<Server> {
  initDatabase().catch(err => console.error("DB init error:", err));

  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers(getOwnerUserId(req));
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id, getOwnerUserId(req));
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.get("/api/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTickets(getOwnerUserId(req));
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.get("/api/tickets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ticket = await storage.getTicket(id, getOwnerUserId(req));
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  const createTicketWithProductsSchema = z.object({
    receiptNumber: z.string().optional(),
    customerName: z.string().optional(),
    accountCode: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    address: z.string().optional(),
    products: z.array(
      z.object({
        name: z.string().optional(),
        serialNumber: z.string().optional(),
        stockCode: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        category: z.enum(["iade", "degisim", "servis"]).optional(),
        description: z.string().optional(),
        quantity: z.number().int().positive().optional(),
      })
    ).min(1).optional(),
  });

  app.post("/api/tickets", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) {
        return res.status(401).json({ error: "Owner user id required" });
      }

      const validatedData = createTicketWithProductsSchema.parse(req.body);

      const customer = await storage.findOrCreateCustomer({
        name: validatedData.customerName || "Bilinmeyen",
        phone: validatedData.phone || "-",
        accountCode: validatedData.accountCode || undefined,
        email: validatedData.email || undefined,
        address: validatedData.address || undefined,
      });

      const ticket = await storage.createTicket({
        customerId: customer.id,
        receiptNumber: validatedData.receiptNumber || undefined,
        ownerUserId,
      });

      const products = validatedData.products || [];
      for (const productData of products) {
        const product = await storage.createProduct({
          ticketId: ticket.id,
          name: productData.name || "Bilinmeyen",
          serialNumber: productData.serialNumber || undefined,
          stockCode: productData.stockCode || undefined,
          brand: productData.brand || "Bilinmeyen",
          model: productData.model || undefined,
          category: productData.category || "servis",
          description: productData.description || undefined,
          status: "beklemede",
          quantity: productData.quantity || 1,
        });

        await storage.createStatusHistory({
          productId: product.id,
          status: "beklemede",
          notes: "Kayıt oluşturuldu",
        });
      }

      const fullTicket = await storage.getTicket(ticket.id, ownerUserId);
      res.status(201).json(fullTicket);
    } catch (error) {
      console.error("Error creating ticket:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  app.delete("/api/tickets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ticket = await storage.getTicket(id, getOwnerUserId(req));
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      await storage.deleteTicket(id);
      res.status(200).json({ message: "Ticket deleted successfully" });
    } catch (error) {
      console.error("Error deleting ticket:", error);
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  const updateProductSchema = z.object({
    name: z.string().min(1).optional(),
    stockCode: z.string().nullable().optional(),
    brand: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    serialNumber: z.string().nullable().optional(),
    category: z.enum(["iade", "degisim", "servis"]).optional(),
    description: z.string().nullable().optional(),
    quantity: z.number().int().positive().optional(),
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });

      const id = parseInt(req.params.id);
      const payload = updateProductSchema.parse(req.body);
      const updated = await updateOwnedProduct(id, ownerUserId, payload);
      if (!updated) return res.status(404).json({ error: "Product not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  const updateProductStatusSchema = z.object({
    status: z.string().min(1),
  });

  app.patch("/api/products/:id/status", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });

      const id = parseInt(req.params.id);
      const { status } = updateProductStatusSchema.parse(req.body);

      const product = await getOwnedProduct(id, ownerUserId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // This updates the shared RMA product row and writes status_history.
      // Supplier screens and customer/RMA screens read this same row, so the status is never duplicated.
      await storage.updateProductStatus(id, status);

      const updatedProduct = await storage.getProduct(id);
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product status:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update product status" });
    }
  });

  const supplierCreateSchema = z.object({
    productId: z.number().int().positive(),
    supplierAccountCode: z.string().trim().min(1),
    supplierName: z.string().trim().min(1),
    notes: z.string().optional(),
  });

  const supplierUpdateSchema = z.object({
    supplierAccountCode: z.string().trim().min(1).optional(),
    supplierName: z.string().trim().min(1).optional(),
    notes: z.string().nullable().optional(),
  });

  app.get("/api/supplier-items", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const items = await listSupplierItems(ownerUserId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching supplier items:", error);
      res.status(500).json({ error: "Failed to fetch supplier items" });
    }
  });

  app.post("/api/supplier-items", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const payload = supplierCreateSchema.parse(req.body);
      const item = await createOrMoveSupplierItem(ownerUserId, payload);
      if (!item) return res.status(404).json({ error: "Product not found" });
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating supplier item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create supplier item" });
    }
  });

  app.patch("/api/supplier-items/:id", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const payload = supplierUpdateSchema.parse(req.body);
      const item = await updateSupplierItem(id, ownerUserId, payload);
      if (!item) return res.status(404).json({ error: "Supplier item not found" });
      res.json(item);
    } catch (error) {
      console.error("Error updating supplier item:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update supplier item" });
    }
  });

  app.delete("/api/supplier-items/:id", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const deleted = await deleteSupplierItem(id, ownerUserId);
      if (!deleted) return res.status(404).json({ error: "Supplier item not found" });
      res.json({ message: "Supplier item deleted" });
    } catch (error) {
      console.error("Error deleting supplier item:", error);
      res.status(500).json({ error: "Failed to delete supplier item" });
    }
  });

  app.get("/api/stats/dashboard", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats(getOwnerUserId(req));
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStatistics(getOwnerUserId(req));
      res.json(stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  app.get("/api/catalog-products", async (req, res) => {
    try {
      const ownerUserId = getOwnerUserId(req);
      if (!ownerUserId) {
        return res.status(401).json({ error: "Owner user id required" });
      }
      const query = typeof req.query.q === "string" ? req.query.q : undefined;
      const products = await storage.getCatalogProducts(ownerUserId, query);
      res.json(products);
    } catch (error) {
      console.error("Error fetching catalog products:", error);
      res.status(500).json({ error: "Failed to fetch catalog products" });
    }
  });

  app.get("/api/catalog-customers", async (req, res) => {
    try {
      const ownerUserId = getOwnerUserId(req);
      if (!ownerUserId) {
        return res.status(401).json({ error: "Owner user id required" });
      }
      const query = typeof req.query.q === "string" ? req.query.q : undefined;
      const customers = await storage.getCatalogCustomers(ownerUserId, query);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching catalog customers:", error);
      res.status(500).json({ error: "Failed to fetch catalog customers" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
