import { z } from "zod";

export const invoiceFormKinds = ["sale", "purchase"] as const;
export type InvoiceFormKind = typeof invoiceFormKinds[number];

export const invoiceFormSchema = z.object({
  documentTitle: z.string().trim().min(3).max(90),
  companyName: z.string().trim().max(140),
  companyAddress: z.string().trim().max(350),
  companyPhone: z.string().trim().max(45),
  companyEmail: z.string().trim().max(120),
  companyTaxOffice: z.string().trim().max(100),
  companyTaxNumber: z.string().trim().max(32),
  headerNote: z.string().trim().max(350),
  footerNote: z.string().trim().max(600),
  warehouseContact: z.string().trim().max(120),
  deliveredPackages: z.string().trim().max(140),
  productHeader: z.string().trim().min(1).max(40),
  quantityHeader: z.string().trim().min(1).max(25),
  unitHeader: z.string().trim().min(1).max(25),
  priceHeader: z.string().trim().min(1).max(25),
  taxHeader: z.string().trim().min(1).max(25),
  amountHeader: z.string().trim().min(1).max(25),
  color: z.enum(["navy", "blue", "emerald", "charcoal"]),
  layout: z.enum(["modern", "classic"]),
  paperSize: z.enum(["a4", "a5"]),
  showProductCode: z.boolean(),
  showUnitPrice: z.boolean(),
  showTaxRate: z.boolean(),
  showPartyTaxNumber: z.boolean(),
  showPartyPhone: z.boolean(),
  showCompanyDetails: z.boolean(),
}).strict();

export type DukkanInvoiceForm = z.infer<typeof invoiceFormSchema>;

export function defaultInvoiceForm(kind: InvoiceFormKind): DukkanInvoiceForm {
  return {
    documentTitle: kind === "sale" ? "SATIŞ BELGESİ" : "ALIŞ BELGESİ",
    companyName: kind === "sale" ? "ÇALIŞKAN GROUP ELEKTRONİK EV ALETLERİ" : "",
    companyAddress: kind === "sale" ? "19. ada 23 numara İstoç toptan ticaret merkezi Bağcılar/İstanbul 34218 TR" : "",
    companyPhone: kind === "sale" ? "05340432878" : "",
    companyEmail: kind === "sale" ? "calisganelektronik@gmail.com" : "",
    companyTaxOffice: "",
    companyTaxNumber: "",
    headerNote: "",
    footerNote: "",
    warehouseContact: "",
    deliveredPackages: "",
    productHeader: kind === "sale" ? "ÜRÜN AÇIKLAMASI" : "ÜRÜN / HİZMET",
    quantityHeader: "MİKTAR",
    unitHeader: "BİRİM",
    priceHeader: "BİRİM FİYAT",
    taxHeader: "KDV",
    amountHeader: kind === "sale" ? "SATIR TOPLAMI" : "TUTAR",
    color: "navy",
    layout: kind === "sale" ? "classic" : "modern",
    paperSize: "a4",
    showProductCode: kind === "sale",
    showUnitPrice: true,
    showTaxRate: true,
    showPartyTaxNumber: true,
    showPartyPhone: kind === "sale",
    showCompanyDetails: true,
  };
}

/** Read old/incomplete settings defensively; only allowlisted visual fields
 * enter rendering. Posted invoice lines/totals can never be configured here. */
export function resolveInvoiceForm(kind: InvoiceFormKind, saved: unknown): DukkanInvoiceForm {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return defaultInvoiceForm(kind);
  const parsed = invoiceFormSchema.safeParse({...defaultInvoiceForm(kind), ...saved});
  return parsed.success ? parsed.data : defaultInvoiceForm(kind);
}

export const invoiceColors: Record<DukkanInvoiceForm["color"], {main:string;accent:string}> = {
  navy: {main:"#101c34",accent:"#0284c7"},
  blue: {main:"#123b69",accent:"#38bdf8"},
  emerald: {main:"#064e3b",accent:"#10b981"},
  charcoal: {main:"#20262e",accent:"#64748b"},
};
