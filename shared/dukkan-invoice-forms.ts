import { z } from "zod";

export const invoiceFormKinds = ["sale", "purchase"] as const;
export type InvoiceFormKind = typeof invoiceFormKinds[number];

export const invoiceFormSchema = z.object({
  documentTitle: z.string().trim().min(3).max(90),
  companyName: z.string().trim().max(140),
  companyAddress: z.string().trim().max(350),
  companyPhone: z.string().trim().max(45),
  companyTaxOffice: z.string().trim().max(100),
  companyTaxNumber: z.string().trim().max(32),
  headerNote: z.string().trim().max(350),
  footerNote: z.string().trim().max(600),
  productHeader: z.string().trim().min(1).max(40),
  quantityHeader: z.string().trim().min(1).max(25),
  priceHeader: z.string().trim().min(1).max(25),
  taxHeader: z.string().trim().min(1).max(25),
  amountHeader: z.string().trim().min(1).max(25),
  color: z.enum(["navy", "blue", "emerald", "charcoal"]),
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
    companyName: "",
    companyAddress: "",
    companyPhone: "",
    companyTaxOffice: "",
    companyTaxNumber: "",
    headerNote: "",
    footerNote: "",
    productHeader: "ÜRÜN / HİZMET",
    quantityHeader: "MİKTAR",
    priceHeader: "BİRİM FİYAT",
    taxHeader: "KDV",
    amountHeader: "TUTAR",
    color: "navy",
    paperSize: "a4",
    showProductCode: false,
    showUnitPrice: true,
    showTaxRate: true,
    showPartyTaxNumber: true,
    showPartyPhone: false,
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
