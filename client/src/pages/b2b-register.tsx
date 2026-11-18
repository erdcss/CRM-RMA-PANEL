import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Building2, MailCheck, PackageCheck } from "lucide-react";
import { B2BRegistrationForm } from "@/components/b2b-registration-form";
import { useBranding } from "@/hooks/use-branding";

export default function B2BRegister() {
  const { data: branding } = useBranding();
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-[#f6f7f9] px-4 py-6 text-slate-950 sm:px-6 sm:py-9">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-amber-100/75 via-slate-50 to-transparent" />
      <div className="relative mx-auto max-w-5xl">
        <Link href="/uye-girisi"
          className="mb-6 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
          <ArrowLeft className="h-4 w-4" aria-hidden="true"/>
          Giriş ekranına dön
        </Link>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:gap-8">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeOut" }}
            className="h-fit min-w-0 self-start overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_45px_-27px_rgba(15,23,42,.38)] sm:rounded-[28px]"
            aria-labelledby="registration-heading">
            <div className="border-b border-slate-100 px-5 pb-5 pt-6 sm:px-8 sm:pt-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                {branding?.b2b_logo ? (
                  <img src={branding.b2b_logo} alt="Çalışkan B2B"
                    className="h-10 w-auto max-w-[155px] object-contain sm:h-11"/>
                ) : <span className="text-lg font-black tracking-tight">ÇALIŞKAN B2B</span>}
                <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1.5 text-[10px] font-extrabold tracking-wide text-amber-900 sm:text-xs">
                  B2B BAŞVURU
                </span>
              </div>
              <h1 id="registration-heading" className="text-2xl font-black tracking-tight sm:text-[28px]">
                Firma hesabı oluştur
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                İşletmenizi tanıyalım. Alanları doldurdukça başvuru formu adım adım açılır.
              </p>
            </div>
            <div className="pt-5 sm:pt-6">
              <B2BRegistrationForm />
            </div>
          </motion.section>

          <motion.aside
            initial={reduceMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.48, delay: reduceMotion ? 0 : 0.12 }}
            className="hidden rounded-[26px] border border-slate-800 bg-slate-950 p-6 text-white shadow-xl lg:block"
            aria-label="Çalışkan B2B başvuru bilgileri">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-bold tracking-wide text-amber-300">
              <Building2 className="h-4 w-4" aria-hidden="true"/>
              ÇALIŞKAN B2B
            </div>
            <h2 className="mt-6 text-2xl font-black leading-tight">
              Toptan ticaret için tek hesap.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              İşletme başvurunuzu tamamlayın, inceleme sonrasında B2B hesabınıza erişin.
            </p>
            <div className="mt-8 space-y-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/10 p-2.5 text-amber-300"><Building2 className="h-5 w-5"/></div>
                <div><b className="block text-sm">Firma bilgileri</b><p className="mt-1 text-xs leading-5 text-slate-400">Unvan, iletişim ve faaliyet alanı</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/10 p-2.5 text-amber-300"><BadgeCheck className="h-5 w-5"/></div>
                <div><b className="block text-sm">Başvuru incelemesi</b><p className="mt-1 text-xs leading-5 text-slate-400">Firma bilgilerinin yönetici tarafından değerlendirilmesi</p></div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/10 p-2.5 text-amber-300"><MailCheck className="h-5 w-5"/></div>
                <div><b className="block text-sm">E-posta bilgilendirmesi</b><p className="mt-1 text-xs leading-5 text-slate-400">Onay sonrası giriş bilgilerinin gönderilmesi</p></div>
              </div>
            </div>
            <div className="mt-8 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-slate-400">
              <PackageCheck className="h-4 w-4 shrink-0 text-amber-300"/>
              Toptan ürün, koli ve sipariş takibi
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
