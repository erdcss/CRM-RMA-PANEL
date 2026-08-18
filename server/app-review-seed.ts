import { createClient } from "@supabase/supabase-js";

import { storage } from "./storage";

const APP_REVIEW_EMAIL = "caliskanrma.review@gmail.com";
const APP_REVIEW_RECEIPT = "APP-REVIEW-DEMO-001";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function findReviewUserId(): Promise<string | undefined> {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    console.warn("App Review seed skipped: Supabase server credentials are not configured.");
    return undefined;
  }

  const supabase = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const perPage = 100;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Unable to list Supabase users for App Review seed: ${error.message}`);
    }

    const reviewUser = data.users.find(
      (user) => user.email?.trim().toLowerCase() === APP_REVIEW_EMAIL,
    );
    if (reviewUser) return reviewUser.id;

    if (data.users.length < perPage) break;
  }

  return undefined;
}

async function seedOnce(): Promise<boolean> {
  const ownerUserId = await findReviewUserId();
  if (!ownerUserId) {
    return false;
  }

  const existingTickets = await storage.getTickets(ownerUserId);
  const alreadySeeded = existingTickets.some(
    (ticket) =>
      ticket.ownerUserId === ownerUserId &&
      ticket.receiptNumber === APP_REVIEW_RECEIPT,
  );

  if (alreadySeeded) {
    console.log("App Review demo data already exists.");
    return true;
  }

  const customer = await storage.findOrCreateCustomer({
    name: "Demo Müşteri",
    phone: "05550000001",
    accountCode: "APPREVIEW-001",
    email: "demo@caliskanrma.com",
    address: "İstanbul / Türkiye",
  });

  const ticket = await storage.createTicket({
    customerId: customer.id,
    receiptNumber: APP_REVIEW_RECEIPT,
    ownerUserId,
  });

  const product = await storage.createProduct({
    ticketId: ticket.id,
    name: "Demo Ürün 01",
    serialNumber: "TEST-RMA-0001",
    stockCode: "DEMO-001",
    brand: "Demo",
    model: "RMA-100",
    category: "servis",
    description: "Apple App Review için oluşturulmuş örnek RMA kaydı.",
    status: "beklemede",
    quantity: 1,
  });

  await storage.createStatusHistory({
    productId: product.id,
    status: "beklemede",
    notes: "Apple App Review demo kaydı oluşturuldu",
  });

  console.log(`App Review demo data created for ${APP_REVIEW_EMAIL}.`);
  return true;
}

export async function ensureAppReviewDemoData(): Promise<void> {
  const maxAttempts = 20;
  const retryDelayMs = 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (await seedOnce()) return;
      console.log(`App Review demo user not found yet; retry ${attempt}/${maxAttempts}.`);
    } catch (error) {
      console.error(`App Review demo seed attempt ${attempt}/${maxAttempts} failed:`, error);
    }

    if (attempt < maxAttempts) {
      await sleep(retryDelayMs);
    }
  }

  console.error("App Review demo data could not be created after retries.");
}
