import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

import { B2BRegistrationForm } from "@/components/b2b-registration-form";
import { BRAND } from "@/lib/brand";
import { useBranding } from "@/hooks/use-branding";

export default function B2BRegister() {
  const { data: branding } = useBranding();

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-8">
      <div className="mx-auto max-w-xl">
        <Link
          href="/uye-girisi"
          className="mb-5 inline-flex items-center text-sm text-slate-500 hover:text-slate-950"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Giriş ekranına dön
        </Link>

        <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="flex items-center gap-4 border-b p-6 sm:p-8">
            <img
              src={branding?.b2b_logo || BRAND.logoLarge}
              alt="Çalışkan B2B"
              className="h-14 w-auto max-w-[180px] object-contain"
            />
            <div className="min-w-0">
              <div className="text-xl font-black">Firma hesabı oluştur</div>
              <div className="text-sm text-slate-500">Yeni B2B müşteri başvurusu</div>
            </div>
          </div>

          <div className="pt-6">
            <B2BRegistrationForm />
          </div>
        </div>
      </div>
    </div>
  );
}
