/**
 * Supplier onboarding IBAN is optional until banking details are supplied.
 * Only remove harmless spaces and normalize case. Never manufacture a missing
 * country prefix or silently alter the account number.
 */
export function normalizeOptionalSupplierIban(value: string): string {
  return value.toUpperCase().replace(/\s/g, "");
}

export const SUPPLIER_IBAN_ERROR =
  "IBAN TR ile başlamalı ve toplam 26 karakter olmalıdır (TR + 24 rakam). İsterseniz boş bırakabilirsiniz.";

export function isOptionalSupplierIbanValid(value: string): boolean {
  const normalized = normalizeOptionalSupplierIban(value);
  return normalized === "" || /^TR[0-9]{24}$/.test(normalized);
}

export function supplierOnboardingFieldError(field: string): string {
  const messages: Record<string, string> = {
    verificationStatus: "Tedarikçi doğrulama durumunu seçin.",
    companyName: "Firma adı 2–180 karakter olmalıdır.",
    firstName: "Yetkili adı 2–80 karakter olmalıdır.",
    lastName: "Yetkili soyadı 2–80 karakter olmalıdır.",
    email: "Geçerli bir giriş e-postası girin.",
    phone: "Telefon numarası 10–25 karakter olmalıdır.",
    taxNumber: "Vergi / T.C. kimlik numarası boş veya 10–11 rakam olmalıdır.",
    taxOffice: "Vergi dairesi adı en fazla 140 karakter olmalıdır.",
    companyType: "Geçerli bir şirket türü seçin.",
    iban: SUPPLIER_IBAN_ERROR,
    description: "Faaliyet açıklaması en fazla 600 karakter olmalıdır.",
  };
  return messages[field] || "Bu alanı kontrol edin.";
}
