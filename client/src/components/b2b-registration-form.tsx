import { trackMetaEvent } from "@/lib/meta-pixel";
import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  UserRound,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { normalizedB2BMobile, registrationStepReadiness } from "@/lib/b2b-registration-progress";

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

function isValidVknChecksum(value: string) {
  if (!/^\d{10}$/.test(value)) return false;

  const digits = value.split("").map(Number);
  const control = digits[9];
  const total = digits.slice(0, 9).reduce((sum, digit, index) => {
    const shifted = (digit + 9 - index) % 10;
    const weighted = shifted === 9 ? 9 : (shifted * 2 ** (9 - index)) % 9;
    return sum + weighted;
  }, 0);

  return (10 - (total % 10)) % 10 === control;
}

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

function AnimatedRegistrationField({
  show, children, reduceMotion,
}: {
  show: boolean;
  children: ReactNode;
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, height: 0, y: -12 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, height: 0, y: -8 }}
          transition={{ duration: reduceMotion ? 0 : 0.32, ease: "easeOut" }}
          className="min-w-0 overflow-hidden"
        >
          <div className="pb-4">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function B2BRegistrationForm({ onCompleted }: B2BRegistrationFormProps) {
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyCategory, setCompanyCategory] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxValid, setTaxValid] = useState(false);
  const [taxVerified, setTaxVerified] = useState(false);
  const [taxChecking, setTaxChecking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [reapplied, setReapplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [whatsAppMarketingOptIn,setWhatsAppMarketingOptIn] = useState(false);
  const [visibleStage, setVisibleStage] = useState(0);
  const reduceMotion = Boolean(useReducedMotion());
  const normalizedPhone = normalizedB2BMobile(phone);
  const stageReady = registrationStepReadiness({
    companyName, firstName, lastName, email, phone,
    companyCategory, taxNumber, taxValid, taxChecking,
  });

  // Only reveal the next field after the current one is complete.
  // Once visible, previous inputs stay editable even if the user revises one.
  useEffect(() => {
    if (visibleStage < stageReady.length && stageReady[visibleStage]) {
      setVisibleStage(stage => Math.min(stage + 1, stageReady.length));
    }
  }, [visibleStage, companyName, firstName, lastName, email, phone, companyCategory, taxNumber, taxValid, taxChecking]);

  useEffect(() => {
    const clean = taxNumber.replace(/\D/g, "").slice(0, 10);
    if (clean !== taxNumber) {
      setTaxNumber(clean);
      return;
    }

    setTaxOffice("");
    setTaxValid(false);
    setTaxVerified(false);

    if (clean.length !== 10) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setTaxChecking(true);

      const verify = async (): Promise<TaxVerification> => {
        let lastError = "Vergi bilgileri doğrulanamadı";

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const response = await fetch("/api/b2b/tax-verify", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taxNumber: clean }),
            });

            const payload = await response.json().catch(() => ({})) as TaxVerification & { error?: string };

            if (response.ok) return payload;

            // Vergi sorgu servisi bağlı değilse/geçici hata verirse,
            // geçerli 10 haneli VKN başvuruyu engellemez.
            if (payload.valid === true || [502, 503].includes(response.status)) {
              return {
                valid: isValidVknChecksum(clean),
                verified: false,
                taxNumber: clean,
                taxOffice: null,
                companyName: null,
              };
            }

            lastError = payload.error || "Vergi numarası doğrulanamadı";
            throw new Error(lastError);
          } catch (err) {
            lastError = err instanceof Error ? err.message : lastError;
            if (attempt === 2) throw new Error(lastError);
            await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
          }
        }

        throw new Error(lastError);
      };

      try {
        const result = await verify();
        if (!active) return;

        setTaxValid(Boolean(result.valid));
        setTaxVerified(Boolean(result.verified));
        setTaxOffice(result.taxOffice || "");

        if (result.companyName) {
          setCompanyName((current) => current.trim() ? current : result.companyName || "");
        }
      } catch (err) {
        if (!active) return;
        setTaxValid(isValidVknChecksum(clean));
        setTaxVerified(false);
        setTaxOffice("");
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

    if (!/^5\d{9}$/.test(normalizedPhone)) {
      setError("Geçerli 10 haneli cep telefonu numarası girin");
      return;
    }
    if (!companyCategory) {
      setError("Firma kategorisi seçin");
      return;
    }
    if (!taxValid) {
      setError("Geçerli bir vergi numarası girin");
      return;
    }

    setBusy(true);
    try {
      const response = await apiRequest("POST", "/api/b2b/register", {
        companyName: companyName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        companyCategory,
        taxNumber,
        whatsappMarketingOptIn:whatsAppMarketingOptIn,
        whatsappSignupSource:"web",
      });
      const result = await response.json() as { reapplied?: boolean };
      setReapplied(result.reapplied === true);
      if(result.reapplied!==true)trackMetaEvent("CompleteRegistration",{status:"pending_approval"});
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
        <h2 className="mt-4 text-xl font-black">{reapplied ? "Yeniden başvurunuz alındı" : "Başvurunuz alındı"}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          {reapplied ? "Reddedilen önceki başvurunuz güncellenerek tekrar incelemeye gönderildi. " : ""}Yönetici onayından sonra tek kullanımlık giriş şifreniz e-posta adresinize gönderilecektir.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="px-5 pb-7 sm:px-8 sm:pb-9" aria-label="Firma hesabı başvuru formu">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-700">Başvuru bilgileri</span>
          <span className="text-xs font-semibold tabular-nums text-slate-500" aria-live="polite">
            {Math.min(visibleStage + 1, 8)} / 8 alan
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar"
          aria-label="Başvuru ilerlemesi" aria-valuemin={0} aria-valuemax={8}
          aria-valuenow={Math.min(visibleStage + 1, 8)}>
          <motion.div className="h-full rounded-full bg-amber-400"
            initial={false} animate={{ width: `${(Math.min(visibleStage + 1, 8) / 8) * 100}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.28 }}/>
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
          Bilgileri tamamladıkça sonraki alan otomatik olarak açılır. Önceki alanları istediğiniz zaman değiştirebilirsiniz.
        </p>
      </div>

      <div className="space-y-0">
        <AnimatedRegistrationField show={visibleStage >= 0} reduceMotion={reduceMotion}>
          <div className="space-y-2">
            <Label htmlFor="register-company" className="font-semibold text-slate-800">Firma ismi</Label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input id="register-company" value={companyName}
                onChange={event => setCompanyName(event.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 focus-visible:ring-amber-400"
                placeholder="Firma unvanı" autoComplete="organization" required />
            </div>
          </div>
        </AnimatedRegistrationField>

        <AnimatedRegistrationField show={visibleStage >= 1} reduceMotion={reduceMotion}>
          <div className="space-y-2">
            <Label htmlFor="register-first-name" className="font-semibold text-slate-800">İsim</Label>
            <div className="relative">
              <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input id="register-first-name" value={firstName}
                onChange={event => setFirstName(event.target.value)} autoComplete="given-name"
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 focus-visible:ring-amber-400" required/>
            </div>
          </div>
        </AnimatedRegistrationField>

        <AnimatedRegistrationField show={visibleStage >= 2} reduceMotion={reduceMotion}>
          <div className="space-y-2">
            <Label htmlFor="register-last-name" className="font-semibold text-slate-800">Soy isim</Label>
            <div className="relative">
              <UserRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input id="register-last-name" value={lastName}
                onChange={event => setLastName(event.target.value)} autoComplete="family-name"
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 focus-visible:ring-amber-400" required/>
            </div>
          </div>
        </AnimatedRegistrationField>

        <AnimatedRegistrationField show={visibleStage >= 3} reduceMotion={reduceMotion}>
          <div className="space-y-2">
            <Label htmlFor="register-email" className="font-semibold text-slate-800">E-posta adresi</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input id="register-email" type="email" autoComplete="email"
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 focus-visible:ring-amber-400"
                value={email} onChange={event => setEmail(event.target.value)}
                placeholder="ornek@firma.com" required />
            </div>
          </div>
        </AnimatedRegistrationField>

        <AnimatedRegistrationField show={visibleStage >= 4} reduceMotion={reduceMotion}>
          <div className="space-y-2">
            <Label htmlFor="register-phone" className="font-semibold text-slate-800">Cep telefonu</Label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input id="register-phone" type="tel" autoComplete="tel" inputMode="tel" required
                value={phone} onChange={event => setPhone(event.target.value)}
                placeholder="05XX XXX XX XX" maxLength={20}
                className="h-12 rounded-xl border-slate-200 bg-white pl-10 focus-visible:ring-amber-400"/>
            </div>
            <p className="text-xs text-slate-500">Türkiye cep telefonu: 5XX XXX XX XX</p>
          </div>
        </AnimatedRegistrationField>

        <AnimatedRegistrationField show={visibleStage >= 5} reduceMotion={reduceMotion}>
          <div className="space-y-2">
            <Label htmlFor="register-category" className="font-semibold text-slate-800">Firma kategorisi</Label>
            <select id="register-category" value={companyCategory}
              onChange={event => setCompanyCategory(event.target.value)}
              className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              required>
              <option value="">Kategori seçin</option>
              {COMPANY_CATEGORIES.map(category =>
                <option key={category} value={category}>{category}</option>)}
            </select>
            <p className="text-xs text-slate-500">Faaliyet alanınıza en yakın kategoriyi seçin.</p>
          </div>
        </AnimatedRegistrationField>

        <AnimatedRegistrationField show={visibleStage >= 6} reduceMotion={reduceMotion}>
          <div className="space-y-2">
            <Label htmlFor="register-tax-number" className="font-semibold text-slate-800">Vergi numarası</Label>
            <div className="relative">
              <Input id="register-tax-number" inputMode="numeric" autoComplete="off"
                value={taxNumber} onChange={event => setTaxNumber(event.target.value.replace(/\D/g, "").slice(0, 10))}
                className="h-12 rounded-xl border-slate-200 bg-white pr-10 focus-visible:ring-amber-400"
                placeholder="10 haneli vergi numarası" minLength={10} maxLength={10} required/>
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {taxChecking ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-label="Sorgulanıyor" /> :
                  taxVerified ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Vergi numarası doğrulandı" /> : null}
              </span>
            </div>
            {taxNumber.length === 10 && !taxChecking && !taxValid ?
              <p className="text-xs text-rose-600">Vergi numarasını kontrol edin.</p> : null}
          </div>
        </AnimatedRegistrationField>

        <AnimatedRegistrationField show={visibleStage >= 7} reduceMotion={reduceMotion}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-tax-office" className="font-semibold text-slate-800">Vergi dairesi</Label>
              <Input id="register-tax-office" value={taxOffice} readOnly
                className={taxVerified
                  ? "h-12 rounded-xl border-slate-200 bg-emerald-50/50"
                  : "h-12 rounded-xl border-slate-200 bg-slate-50"}
                placeholder={taxChecking ? "Sorgulanıyor…" : "Otomatik sorgulanır"} />
              <p className="text-xs leading-relaxed text-slate-500">
                Vergi dairesi otomatik sorgulanır. Sorgu servisi yanıt vermese bile
                geçerli vergi numarasıyla başvurabilirsiniz.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                checked={whatsAppMarketingOptIn} onChange={event => setWhatsAppMarketingOptIn(event.target.checked)}/>
              <span>Çalışkan B2B tarafından WhatsApp üzerinden başvuru sonrası tanıtım, yeni ürün,
                indirim ve kampanya mesajları almayı kabul ediyorum.
                <strong className="ml-1">İsteğe bağlıdır.</strong>
                İznimi WhatsApp üzerinden DUR yazarak geri çekebilirim.
              </span>
            </label>

            {error ? (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>
            ) : null}

            <Button type="submit" className="h-12 w-full rounded-xl bg-slate-950 text-sm font-bold hover:bg-slate-800"
              disabled={
                busy || taxChecking ||
                companyName.trim().length < 2 || firstName.trim().length < 2 ||
                lastName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) ||
                !/^5\d{9}$/.test(normalizedPhone) || !companyCategory || !taxValid
              }>
              <UserPlus className="mr-2 h-4 w-4"/>
              {busy ? "Başvuru gönderiliyor…" : "Başvuruyu Gönder"}
            </Button>
            <p className="text-center text-xs leading-relaxed text-slate-500">
              Başvurunuz yönetici incelemesine alınır. Onay sonrasında giriş bilgileriniz
              e-posta adresinize gönderilir.
            </p>
          </div>
        </AnimatedRegistrationField>
      </div>
    </form>
  );
}
