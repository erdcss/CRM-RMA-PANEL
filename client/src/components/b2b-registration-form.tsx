import { FormEvent, useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

const COMPANY_CATEGORIES = [
  "Elektrik & Elektronik",
  "Ev Gereçleri",
  "Yapı & Hırdavat",
  "Otomotiv",
  "Gıda",
  "Tekstil",
  "Kozmetik & Kişisel Bakım",
  "Petshop",
  "Market & Perakende",
  "Toptan Ticaret",
  "Diğer",
];

type TaxVerification = {
  valid: boolean;
  verified: boolean;
  taxNumber: string;
  taxOffice?: string | null;
  companyName?: string | null;
  serviceConfigured?: boolean;
  message?: string;
};

type B2BRegistrationFormProps = {
  onCompleted?: () => void;
};

export function B2BRegistrationForm({ onCompleted }: B2BRegistrationFormProps) {
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyCategory, setCompanyCategory] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxValid, setTaxValid] = useState(false);
  const [taxVerified, setTaxVerified] = useState(false);
  const [taxServiceConfigured, setTaxServiceConfigured] = useState(false);
  const [taxMessage, setTaxMessage] = useState("");
  const [taxChecking, setTaxChecking] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const clean = taxNumber.replace(/\D/g, "").slice(0, 10);
    if (clean !== taxNumber) {
      setTaxNumber(clean);
      return;
    }

    setTaxOffice("");
    setTaxValid(false);
    setTaxVerified(false);
    setTaxServiceConfigured(false);
    setTaxMessage("");

    if (clean.length !== 10) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setTaxChecking(true);
      try {
        const response = await apiRequest("POST", "/api/b2b/tax-verify", {
          taxNumber: clean,
        });
        const result = (await response.json()) as TaxVerification;
        if (!active) return;

        setTaxValid(Boolean(result.valid));
        setTaxVerified(Boolean(result.verified));
        setTaxServiceConfigured(Boolean(result.serviceConfigured));
        setTaxOffice(result.taxOffice || "");
        setTaxMessage(result.verified ? (result.message || "Vergi bilgileri doğrulandı") : "");

        if (result.companyName) {
          setCompanyName((current) => current.trim() ? current : result.companyName || "");
        }
      } catch (err) {
        if (!active) return;
        setTaxValid(false);
        setTaxVerified(false);
        setTaxServiceConfigured(false);
        setTaxOffice("");
        setTaxMessage(err instanceof Error ? err.message : "Vergi numarası doğrulanamadı");
      } finally {
        if (active) setTaxChecking(false);
      }
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [taxNumber]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== passwordAgain) {
      setError("Şifreler eşleşmiyor");
      return;
    }
    if (!companyCategory) {
      setError("Firma kategorisi seçin");
      return;
    }
    if (!taxValid) {
      setError("Vergi numarasını doğrulayın");
      return;
    }
    if (!taxOffice.trim()) {
      setError("Vergi dairesini girin");
      return;
    }

    setBusy(true);
    try {
      await apiRequest("POST", "/api/b2b/register", {
        companyName: companyName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        companyCategory,
        taxNumber,
        taxOffice: taxOffice.trim(),
        password,
      });
      setDone(true);
      onCompleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt oluşturulamadı");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="px-6 py-10 text-center sm:px-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h2 className="mt-4 text-xl font-black">Başvurunuz alındı</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Firma hesabınız yönetici onayından sonra aktif olacaktır.
          {taxVerified ? " Vergi bilgileri otomatik olarak doğrulandı." : " Vergi bilgileri onay sırasında ayrıca kontrol edilecektir."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 px-6 pb-8 sm:px-8">
      <div className="space-y-2">
        <Label htmlFor="register-company">Firma ismi</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="register-company"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="h-11 pl-9"
            placeholder="Firma unvanı"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="register-first-name">İsim</Label>
          <div className="relative">
            <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="register-first-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-11 pl-9"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-last-name">Soy isim</Label>
          <Input
            id="register-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className="h-11"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-email">E-posta adresi</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            className="h-11 pl-9"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-category">Firma kategorisi</Label>
        <select
          id="register-category"
          value={companyCategory}
          onChange={(event) => setCompanyCategory(event.target.value)}
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          required
        >
          <option value="">Kategori seçin</option>
          {COMPANY_CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <p className="text-xs text-slate-500">Kategori serbest metin olarak girilmez; listeden seçilir.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="register-tax-number">Vergi numarası</Label>
          <div className="relative">
            <Input
              id="register-tax-number"
              inputMode="numeric"
              autoComplete="off"
              value={taxNumber}
              onChange={(event) => setTaxNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
              className="h-11 pr-10"
              placeholder="10 hane"
              minLength={10}
              maxLength={10}
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {taxChecking ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : taxVerified ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : null}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-tax-office">Vergi dairesi</Label>
          <Input
            id="register-tax-office"
            value={taxOffice}
            onChange={(event) => setTaxOffice(event.target.value)}
            readOnly={taxVerified}
            className={taxVerified ? "h-11 bg-emerald-50/40" : "h-11"}
            placeholder={
              taxChecking
                ? "Sorgulanıyor…"
                : taxVerified
                  ? "Vergi dairesi"
                  : "Vergi dairesini girin"
            }
            required
          />
          {taxValid && !taxVerified ? (
            <p className="text-xs text-slate-500">
              {taxServiceConfigured
                ? "Otomatik eşleşme bulunamadı. Vergi dairesini kontrol ederek girin."
                : "Vergi numarası formatı geçerli. Vergi dairesini girerek devam edin."}
            </p>
          ) : null}
        </div>
      </div>

      {taxMessage ? (
        <div
          className={
            taxVerified
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
              : "rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
          }
        >
          {taxMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="register-password">Şifre</Label>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="register-password"
              type="password"
              autoComplete="new-password"
              className="h-11 pl-9"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password-again">Şifre tekrar</Label>
          <Input
            id="register-password-again"
            type="password"
            autoComplete="new-password"
            className="h-11"
            value={passwordAgain}
            onChange={(event) => setPasswordAgain(event.target.value)}
            minLength={8}
            required
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <Button
        type="submit"
        className="h-11 w-full bg-slate-950 hover:bg-slate-800"
        disabled={busy || taxChecking || !taxValid}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        {busy ? "Kayıt oluşturuluyor…" : "Başvuruyu Gönder"}
      </Button>
    </form>
  );
}
