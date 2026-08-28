import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertWarehouseSchema, insertSupplierSchema, insertInvoiceSchema } from "@shared/schema";
import { saveImageDataUrl, persistProductImageUrl } from "./image-storage";
import { z } from "zod";

let dbReady = false;

function sessionUserId(req: Request): number | undefined {
  return (req.session as { userId?: number }).userId;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req.session as { userId?: number }).userId) {
    return next();
  }
  return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
}

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

export async function registerRoutes(app: Express): Promise<Server> {
  initDatabase().catch(err => console.error("DB init error:", err));

  app.get("/api/auth/me", async (req, res) => {
    const userId = (req.session as { userId?: number }).userId;
    if (!userId) {
      return res.status(401).json({ error: "Giriş yapmanız gerekiyor" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      req.session.destroy(() => undefined);
      return res.status(401).json({ error: "Oturum geçersiz" });
    }
    res.json({ id: user.id, username: user.username });
  });

  app.post("/api/auth/login", async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const user = await storage.getUserByUsername(username);

    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı" });
    }

    (req.session as { userId?: number }).userId = user.id;
    res.json({ id: user.id, username: user.username });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        return res.status(500).json({ error: "Oturum kapatılamadı" });
      }
      res.clearCookie("connect.sid");
      res.status(204).send();
    });
  });

  app.post("/api/uploads", requireAuth, async (req, res) => {
    try {
      const dataUrl = req.body?.dataUrl;
      if (typeof dataUrl !== "string") {
        return res.status(400).json({ error: "Görsel verisi bulunamadı" });
      }

      const url = await saveImageDataUrl(dataUrl);
      res.status(201).json({ url });
    } catch (error) {
      console.error("Error uploading image:", error);
      const message = error instanceof Error ? error.message : "Görsel yüklenemedi";
      res.status(error instanceof Error && message.includes("Geçersiz") ? 400 : 500).json({ error: message });
    }
  });

  app.use("/api", requireAuth);

  app.get("/api/customers", async (_req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
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

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, validatedData);
      if (!customer) {
        return res.status(404).json({ error: "Müşteri bulunamadı" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Müşteri güncellenemedi" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteCustomer(id);
      if (!result.ok) {
        return res.status(409).json({ error: result.error });
      }
      res.status(200).json({ message: "Müşteri silindi" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ error: "Müşteri silinemedi" });
    }
  });

  app.get("/api/warehouses", async (_req, res) => {
    try {
      res.json(await storage.getWarehouses());
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      res.status(500).json({ error: "Depolar alınamadı" });
    }
  });

  app.post("/api/warehouses", async (req, res) => {
    try {
      const data = insertWarehouseSchema.parse(req.body);
      res.status(201).json(await storage.createWarehouse(data));
    } catch (error) {
      console.error("Error creating warehouse:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Depo oluşturulamadı" });
    }
  });

  app.patch("/api/warehouses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertWarehouseSchema.partial().parse(req.body);
      const warehouse = await storage.updateWarehouse(id, data);
      if (!warehouse) return res.status(404).json({ error: "Depo bulunamadı" });
      res.json(warehouse);
    } catch (error) {
      console.error("Error updating warehouse:", error);
      res.status(500).json({ error: "Depo güncellenemedi" });
    }
  });

  app.delete("/api/warehouses/:id", async (req, res) => {
    try {
      const result = await storage.deleteWarehouse(parseInt(req.params.id));
      if (!result.ok) return res.status(409).json({ error: result.error });
      res.json({ message: "Depo silindi" });
    } catch (error) {
      console.error("Error deleting warehouse:", error);
      res.status(500).json({ error: "Depo silinemedi" });
    }
  });

  app.get("/api/suppliers", async (_req, res) => {
    try {
      res.json(await storage.getSuppliers());
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ error: "Tedarikçiler alınamadı" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const data = insertSupplierSchema.parse(req.body);
      res.status(201).json(await storage.createSupplier(data));
    } catch (error) {
      console.error("Error creating supplier:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Tedarikçi oluşturulamadı" });
    }
  });

  app.patch("/api/suppliers/:id", async (req, res) => {
    try {
      const supplier = await storage.updateSupplier(parseInt(req.params.id), insertSupplierSchema.partial().parse(req.body));
      if (!supplier) return res.status(404).json({ error: "Tedarikçi bulunamadı" });
      res.json(supplier);
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ error: "Tedarikçi güncellenemedi" });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      const result = await storage.deleteSupplier(parseInt(req.params.id));
      if (!result.ok) return res.status(409).json({ error: result.error });
      res.json({ message: "Tedarikçi silindi" });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ error: "Tedarikçi silinemedi" });
    }
  });

  app.get("/api/invoices", async (_req, res) => {
    try {
      res.json(await storage.getInvoices());
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ error: "Faturalar alınamadı" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const data = insertInvoiceSchema.parse({
        ...req.body,
        invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : new Date(),
        customerId: req.body.customerId || undefined,
      });
      res.status(201).json(await storage.createInvoice(data));
    } catch (error) {
      console.error("Error creating invoice:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Fatura oluşturulamadı" });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const payload: Record<string, unknown> = { ...req.body };
      if (payload.invoiceDate) payload.invoiceDate = new Date(payload.invoiceDate as string);
      const invoice = await storage.updateInvoice(parseInt(req.params.id), insertInvoiceSchema.partial().parse(payload));
      if (!invoice) return res.status(404).json({ error: "Fatura bulunamadı" });
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ error: "Fatura güncellenemedi" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const result = await storage.deleteInvoice(parseInt(req.params.id));
      if (!result.ok) return res.status(409).json({ error: result.error });
      res.json({ message: "Fatura silindi" });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ error: "Fatura silinemedi" });
    }
  });

  app.get("/api/tickets", async (_req, res) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.get("/api/tickets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ticket = await storage.getTicket(id);
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
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    address: z.string().optional(),
    products: z.array(
      z.object({
        name: z.string().optional(),
        serialNumber: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        category: z.enum(["iade", "degisim", "servis"]).optional(),
        description: z.string().optional(),
        quantity: z.number().int().optional(),
        imageUrl: z.string().optional(),
        barcode: z.string().optional(),
        faultReason: z.string().optional(),
        supplierId: z.number().int().optional(),
        invoiceId: z.number().int().optional(),
        invoiceNumber: z.string().optional(),
      })
    ).optional(),
  });

  app.post("/api/tickets", async (req, res) => {
    try {
      if (!dbReady) {
        try {
          await storage.ensureSystemUser();
          dbReady = true;
        } catch {
          return res.status(503).json({ error: "Veritabanı henüz hazır değil. Lütfen birkaç saniye sonra tekrar deneyin." });
        }
      }

      const validatedData = createTicketWithProductsSchema.parse(req.body);

      const customer = await storage.findOrCreateCustomer({
        name: validatedData.customerName || "Bilinmeyen",
        phone: validatedData.phone || "-",
        email: validatedData.email || undefined,
        address: validatedData.address || undefined,
      });

      const ticket = await storage.createTicket({
        customerId: customer.id,
        receiptNumber: validatedData.receiptNumber || undefined,
      });

      const products = validatedData.products || [];
      const userId = sessionUserId(req);
      for (const productData of products) {
        let imageUrl: string | undefined;
        try {
          imageUrl = await persistProductImageUrl(productData.imageUrl);
        } catch (imageError) {
          console.error("Error persisting product image:", imageError);
          return res.status(400).json({
            error: imageError instanceof Error ? imageError.message : "Ürün görseli kaydedilemedi",
          });
        }

        let invoiceId = productData.invoiceId;
        if (!invoiceId && productData.invoiceNumber) {
          const invoice = await storage.findOrCreateInvoice({
            invoiceNumber: productData.invoiceNumber,
            customerId: customer.id,
          });
          invoiceId = invoice?.id;
        }

        const product = await storage.createProduct({
          ticketId: ticket.id,
          name: productData.name || "Bilinmeyen",
          serialNumber: productData.serialNumber || undefined,
          brand: productData.brand || "Bilinmeyen",
          model: productData.model || undefined,
          category: productData.category || "servis",
          description: productData.description || undefined,
          status: "beklemede",
          quantity: productData.quantity || 1,
          imageUrl,
          barcode: productData.barcode || undefined,
          faultReason: productData.faultReason || undefined,
          supplierId: productData.supplierId || undefined,
          invoiceId: invoiceId || undefined,
          location: "rma_depo",
        });

        await storage.createStatusHistory({
          productId: product.id,
          status: "beklemede",
          notes: "Kayıt oluşturuldu — ürün teslim alındı",
        });

        await storage.receiveProductIntoRma(product.id, userId);
      }

      const fullTicket = await storage.getTicket(ticket.id);
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
      const ticket = await storage.getTicket(id);
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

  const updateProductStatusSchema = z.object({
    status: z.string().min(1),
  });

  app.patch("/api/products/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = updateProductStatusSchema.parse(req.body);

      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

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

  const updateProductLinksSchema = z.object({
    barcode: z.string().optional(),
    faultReason: z.string().optional(),
    warehouseId: z.number().int().nullable().optional(),
    supplierId: z.number().int().nullable().optional(),
    invoiceId: z.number().int().nullable().optional(),
    invoiceNumber: z.string().optional(),
    location: z.string().optional(),
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateProductLinksSchema.parse(req.body);
      const existing = await storage.getProduct(id);
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }

      let invoiceId = data.invoiceId;
      if (data.invoiceNumber) {
        const invoice = await storage.findOrCreateInvoice({
          invoiceNumber: data.invoiceNumber,
          customerId: existing.ticket?.customerId,
        });
        invoiceId = invoice?.id ?? invoiceId;
      }

      const updated = await storage.updateProduct(id, {
        barcode: data.barcode,
        faultReason: data.faultReason,
        warehouseId: data.warehouseId === null ? undefined : data.warehouseId,
        supplierId: data.supplierId === null ? undefined : data.supplierId,
        invoiceId: invoiceId === null ? undefined : invoiceId,
        location: data.location,
      }, { userId: sessionUserId(req) });

      res.json(await storage.getProduct(updated?.id || id));
    } catch (error) {
      console.error("Error updating product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Ürün güncellenemedi" });
    }
  });

  app.get("/api/stats/dashboard", async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStatistics();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
