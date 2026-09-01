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
import {
  addProductsToPackage,
  closePackage,
  createPackageFromProducts,
  getPackageDetail,
  getPackageMetrics,
  getProductMovements,
  getProductPackageInfo,
  getSupplierPrepPool,
  listPackages,
  lookupPackage,
  removeProductFromPackage,
  shipPackage,
  verifyPackageBarcode,
} from "./packages";
import {
  bulkSaveSupplierResults,
  completePackage,
  deliverToCustomer,
  enrichPackageWithResults,
  getFaz3Metrics,
  getProductTimeline,
  markDeliveredToSupplier,
  markPackageReturned,
  markProductScrap,
  moveToSellableStock,
  saveSupplierResult,
} from "./supplier-results";
import { closeTicket, getTicketClosureStatus } from "./rma-closure";
import { ensureProductShipmentBarcode, ensureProductShipmentBarcodes } from "./shipment-barcode";
import { z } from "zod";
import {
  ALL_PRODUCT_STATUS_VALUES,
  RMA_DEFAULT_PRODUCT_STATUS,
  RMA_DEFAULT_WAREHOUSE_LOCATION,
} from "@shared/rma-constants";

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
    operationType: z.enum(["iade", "degisim", "servis"]).default("servis"),
    catalogCustomerId: z.number().int().positive().optional(),
    customerName: z.string().optional(),
    accountCode: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    address: z.string().optional(),
    salesId: z.string().optional(),
    invoiceId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    saleDate: z.string().optional(),
    products: z.array(
      z.object({
        catalogProductId: z.number().int().positive().optional(),
        name: z.string().optional(),
        serialNumber: z.string().optional(),
        stockCode: z.string().optional(),
        barcode: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        category: z.enum(["iade", "degisim", "servis"]).optional(),
        defectReason: z.string().optional(),
        description: z.string().optional(),
        quantity: z.number().int().positive().optional(),
        supplierAccountCode: z.string().optional(),
        supplierName: z.string().optional(),
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
        catalogCustomerId: validatedData.catalogCustomerId,
        operationType: validatedData.operationType,
        salesId: validatedData.salesId || undefined,
        invoiceId: validatedData.invoiceId || undefined,
        invoiceNumber: validatedData.invoiceNumber || undefined,
        saleDate: validatedData.saleDate ? new Date(validatedData.saleDate) : undefined,
        ownerUserId,
      });

      const products = validatedData.products || [];
      const defaultCategory = validatedData.operationType;
      for (const productData of products) {
        const product = await storage.createProduct({
          ticketId: ticket.id,
          catalogProductId: productData.catalogProductId,
          name: productData.name || "Bilinmeyen",
          serialNumber: productData.serialNumber || undefined,
          stockCode: productData.stockCode || undefined,
          barcode: productData.barcode || undefined,
          brand: productData.brand || "Bilinmeyen",
          model: productData.model || undefined,
          category: productData.category || defaultCategory,
          defectReason: productData.defectReason || undefined,
          description: productData.description || undefined,
          status: RMA_DEFAULT_PRODUCT_STATUS,
          warehouseLocation: RMA_DEFAULT_WAREHOUSE_LOCATION,
          quantity: productData.quantity || 1,
        });

        await storage.createStatusHistory({
          productId: product.id,
          status: RMA_DEFAULT_PRODUCT_STATUS,
          notes: "Kayit olusturuldu - RMA deposuna alindi",
          changedByUserId: ownerUserId,
        });

        if (productData.supplierAccountCode && productData.supplierName) {
          await createOrMoveSupplierItem(ownerUserId, {
            productId: product.id,
            supplierAccountCode: productData.supplierAccountCode,
            supplierName: productData.supplierName,
          });
        }
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

  app.get("/api/products", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const products = await storage.getProducts(ownerUserId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id, ownerUserId);
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
    barcode: z.string().nullable().optional(),
    category: z.enum(["iade", "degisim", "servis"]).optional(),
    defectReason: z.string().nullable().optional(),
    warehouseLocation: z.enum(["rma_deposu", "satilabilir_stok", "hurda"]).optional(),
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
    status: z.enum(ALL_PRODUCT_STATUS_VALUES as unknown as [string, ...string[]]),
    notes: z.string().optional(),
  });

  app.patch("/api/products/:id/status", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });

      const id = parseInt(req.params.id);
      const { status, notes } = updateProductStatusSchema.parse(req.body);

      const product = await getOwnedProduct(id, ownerUserId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      await storage.updateProductStatus(id, status, {
        previousStatus: product.status,
        changedByUserId: ownerUserId,
        notes,
      });

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

  app.post("/api/products/:id/shipment-barcode", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });

      const id = parseInt(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid product id" });

      const result = await ensureProductShipmentBarcode(id, ownerUserId);
      res.json({ barcodeNumber: result.barcodeNumber });
    } catch (error) {
      console.error("Error ensuring shipment barcode:", error);
      const message = error instanceof Error ? error.message : "Barkod numarası oluşturulamadı.";
      if (message === "Product not found") {
        return res.status(404).json({ error: message });
      }
      res.status(500).json({ error: message || "Barkod numarası oluşturulamadı." });
    }
  });

  app.post("/api/products/shipment-barcodes/ensure", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });

      const payload = z
        .object({
          productIds: z.array(z.number().int().positive()).min(1).max(200),
        })
        .parse(req.body);

      const barcodes = await ensureProductShipmentBarcodes(payload.productIds, ownerUserId);
      res.json({ barcodes });
    } catch (error) {
      console.error("Error ensuring shipment barcodes:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      const message = error instanceof Error ? error.message : "Barkod numarası oluşturulamadı.";
      res.status(500).json({ error: message || "Barkod numarası oluşturulamadı." });
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
    supplierStatus: z.enum(["bekliyor", "hazir", "gonderildi", "tamamlandi"]).optional(),
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

  app.get("/api/stats/rma", async (req, res) => {
    try {
      const metrics = await storage.getRmaMetrics(getOwnerUserId(req));
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching RMA metrics:", error);
      res.status(500).json({ error: "Failed to fetch RMA metrics" });
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

  app.get("/api/rma/prep-pool", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const pool = await getSupplierPrepPool(ownerUserId);
      res.json(pool);
    } catch (error) {
      console.error("Error fetching prep pool:", error);
      res.status(500).json({ error: "Failed to fetch prep pool" });
    }
  });

  app.get("/api/rma/packages/metrics", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      res.json(await getPackageMetrics(ownerUserId));
    } catch (error) {
      console.error("Error fetching package metrics:", error);
      res.status(500).json({ error: "Failed to fetch package metrics" });
    }
  });

  app.get("/api/rma/packages/lookup", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const pkg = await lookupPackage(q, ownerUserId);
      if (!pkg) return res.status(404).json({ error: "Koli bulunamadi" });
      res.json(pkg);
    } catch (error) {
      console.error("Error looking up package:", error);
      res.status(500).json({ error: "Failed to lookup package" });
    }
  });

  app.get("/api/rma/packages", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const filters = {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        supplier: typeof req.query.supplier === "string" ? req.query.supplier : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
        barcode: typeof req.query.barcode === "string" ? req.query.barcode : undefined,
      };
      res.json(await listPackages(ownerUserId, filters));
    } catch (error) {
      console.error("Error listing packages:", error);
      res.status(500).json({ error: "Failed to list packages" });
    }
  });

  app.get("/api/rma/packages/:id", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const pkg = await enrichPackageWithResults(id, ownerUserId);
      if (!pkg) return res.status(404).json({ error: "Package not found" });
      res.json(pkg);
    } catch (error) {
      console.error("Error fetching package:", error);
      res.status(500).json({ error: "Failed to fetch package" });
    }
  });

  app.post("/api/rma/packages", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const schema = z.object({
        supplierAccountCode: z.string().min(1),
        supplierName: z.string().min(1),
        productIds: z.array(z.number().int().positive()).min(1),
        notes: z.string().optional(),
      });
      const payload = schema.parse(req.body);
      const pkg = await createPackageFromProducts(ownerUserId, ownerUserId, payload);
      res.status(201).json(pkg);
    } catch (error: any) {
      console.error("Error creating package:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(400).json({ error: error.message || "Failed to create package" });
    }
  });

  app.post("/api/rma/packages/:id/items", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const { productIds } = z.object({ productIds: z.array(z.number().int().positive()).min(1) }).parse(req.body);
      res.json(await addProductsToPackage(id, ownerUserId, ownerUserId, productIds));
    } catch (error: any) {
      console.error("Error adding package items:", error);
      res.status(400).json({ error: error.message || "Failed to add items" });
    }
  });

  app.delete("/api/rma/packages/:id/items/:itemId", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const packageId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      res.json(await removeProductFromPackage(packageId, itemId, ownerUserId, ownerUserId));
    } catch (error: any) {
      console.error("Error removing package item:", error);
      res.status(400).json({ error: error.message || "Failed to remove item" });
    }
  });

  app.post("/api/rma/packages/:id/close", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      res.json(await closePackage(id, ownerUserId, ownerUserId));
    } catch (error: any) {
      console.error("Error closing package:", error);
      res.status(400).json({ error: error.message || "Failed to close package" });
    }
  });

  app.post("/api/rma/packages/verify", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const { barcodeValue } = z.object({ barcodeValue: z.string().min(1) }).parse(req.body);
      res.json(await verifyPackageBarcode(barcodeValue, ownerUserId, ownerUserId));
    } catch (error: any) {
      console.error("Error verifying package:", error);
      res.status(400).json({ error: error.message || "Verification failed" });
    }
  });

  app.post("/api/rma/packages/:id/ship", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const payload = z
        .object({
          carrierName: z.string().optional(),
          trackingNumber: z.string().optional(),
          notes: z.string().optional(),
        })
        .parse(req.body);
      res.json(await shipPackage(id, ownerUserId, ownerUserId, payload));
    } catch (error: any) {
      console.error("Error shipping package:", error);
      res.status(400).json({ error: error.message || "Failed to ship package" });
    }
  });

  app.get("/api/rma/products/:id/package-info", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const productId = parseInt(req.params.id);
      const info = await getProductPackageInfo(productId, ownerUserId);
      res.json(info);
    } catch (error) {
      console.error("Error fetching product package info:", error);
      res.status(500).json({ error: "Failed to fetch product package info" });
    }
  });

  app.get("/api/rma/products/:id/movements", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const productId = parseInt(req.params.id);
      res.json(await getProductMovements(productId, ownerUserId));
    } catch (error) {
      console.error("Error fetching product movements:", error);
      res.status(500).json({ error: "Failed to fetch movements" });
    }
  });

  app.post("/api/rma/packages/:id/deliver-to-supplier", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const { deliveryNote } = z.object({ deliveryNote: z.string().optional() }).parse(req.body);
      res.json(await markDeliveredToSupplier(id, ownerUserId, ownerUserId, { deliveryNote }));
    } catch (error: any) {
      console.error("Error marking delivered to supplier:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.post("/api/rma/packages/:id/return", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const { returnNote } = z.object({ returnNote: z.string().optional() }).parse(req.body);
      res.json(await markPackageReturned(id, ownerUserId, ownerUserId, { returnNote }));
    } catch (error: any) {
      console.error("Error marking package returned:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.post("/api/rma/packages/:id/complete", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      res.json(await completePackage(id, ownerUserId, ownerUserId));
    } catch (error: any) {
      console.error("Error completing package:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.post("/api/rma/packages/:id/supplier-results/bulk", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const id = parseInt(req.params.id);
      const payload = z
        .object({
          productIds: z.array(z.number().int().positive()).min(1),
          resultType: z.string().min(1),
          resultDescription: z.string().optional(),
          items: z
            .array(
              z.object({
                productId: z.number().int().positive(),
                newSerialNumber: z.string().optional(),
                newBarcode: z.string().optional(),
              }),
            )
            .optional(),
        })
        .parse(req.body);
      res.json(await bulkSaveSupplierResults(ownerUserId, ownerUserId, id, payload));
    } catch (error: any) {
      console.error("Error bulk saving supplier results:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.post("/api/rma/products/:id/supplier-result", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const productId = parseInt(req.params.id);
      const payload = z
        .object({
          packageId: z.number().int().positive().optional(),
          resultType: z.string().min(1),
          resultDescription: z.string().optional(),
          supplierDocumentNumber: z.string().optional(),
          supplierSerialNumber: z.string().optional(),
          newSerialNumber: z.string().optional(),
          newBarcode: z.string().optional(),
          resultDate: z.string().optional(),
        })
        .parse(req.body);
      res.json(await saveSupplierResult(ownerUserId, ownerUserId, { productId, ...payload }));
    } catch (error: any) {
      console.error("Error saving supplier result:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.post("/api/rma/products/:id/sellable-stock", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const productId = parseInt(req.params.id);
      const { notes } = z.object({ notes: z.string().optional() }).parse(req.body ?? {});
      res.json(await moveToSellableStock(productId, ownerUserId, ownerUserId, notes));
    } catch (error: any) {
      console.error("Error moving to sellable stock:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.post("/api/rma/products/:id/scrap", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const productId = parseInt(req.params.id);
      const payload = z
        .object({
          scrapReason: z.string().min(1),
          description: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
        .parse(req.body);
      res.json(await markProductScrap(productId, ownerUserId, ownerUserId, payload));
    } catch (error: any) {
      console.error("Error marking scrap:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.post("/api/rma/products/:id/customer-delivery", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const productId = parseInt(req.params.id);
      const payload = z
        .object({
          receiverName: z.string().min(1),
          receiverPhone: z.string().optional(),
          deliveryNote: z.string().optional(),
        })
        .parse(req.body);
      res.json(await deliverToCustomer(productId, ownerUserId, ownerUserId, payload));
    } catch (error: any) {
      console.error("Error customer delivery:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.get("/api/rma/products/:id/timeline", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const productId = parseInt(req.params.id);
      res.json(await getProductTimeline(productId, ownerUserId));
    } catch (error) {
      console.error("Error fetching timeline:", error);
      res.status(500).json({ error: "Failed to fetch timeline" });
    }
  });

  app.get("/api/rma/metrics/faz3", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      res.json(await getFaz3Metrics(ownerUserId));
    } catch (error) {
      console.error("Error fetching faz3 metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  app.get("/api/rma/tickets/:id/closure-status", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const ticketId = parseInt(req.params.id);
      res.json(await getTicketClosureStatus(ticketId, ownerUserId));
    } catch (error: any) {
      console.error("Error fetching closure status:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  app.post("/api/rma/tickets/:id/close", async (req, res) => {
    try {
      const ownerUserId = requireOwnerUserId(req);
      if (!ownerUserId) return res.status(401).json({ error: "Owner user id required" });
      const ticketId = parseInt(req.params.id);
      res.json(await closeTicket(ticketId, ownerUserId, ownerUserId));
    } catch (error: any) {
      console.error("Error closing ticket:", error);
      res.status(400).json({ error: error.message || "Failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
