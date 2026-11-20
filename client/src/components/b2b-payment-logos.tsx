import { Link } from "wouter";

const IYZICO_OFFICIAL_LOGO = "https://www.iyzico.com/assets/img/marka-kimligi/iyzico-pay-horizontal-white-tr.png";

export function B2BPaymentLogos({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "flex flex-col items-center gap-3" : "mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-5"} aria-label="Ödeme yöntemleri ve kart markaları">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="https://www.iyzico.com/hakkimizda/iyzico-marka-kilavuzu" target="_blank" rel="noopener noreferrer" aria-label="iyzico ile Öde marka bilgisi" className="flex h-12 w-[164px] items-center justify-center rounded-xl border border-[#dedede] bg-white px-3 shadow-sm">
          <img src={IYZICO_OFFICIAL_LOGO} width={136} height={40} alt="iyzico ile Öde" loading="lazy" className="max-h-9 w-auto max-w-full object-contain" />
        </a>
        <span className="flex h-12 w-[104px] items-center justify-center rounded-xl border border-[#dedede] bg-white p-3 shadow-sm" aria-label="Visa">
          <svg role="img" aria-label="Visa logosu" viewBox="0 0 24 24" className="h-7 w-20 fill-[#1434cb]" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z" />
          </svg>
        </span>
        <span className="flex h-12 w-[104px] items-center justify-center rounded-xl border border-[#dedede] bg-white p-3 shadow-sm" aria-label="Mastercard">
          <svg role="img" aria-label="Mastercard logosu" viewBox="0 0 92 48" className="h-9 w-[72px]" xmlns="http://www.w3.org/2000/svg">
            <circle cx="34" cy="24" r="19" fill="#EB001B" />
            <circle cx="58" cy="24" r="19" fill="#F79E1B" />
            <path d="M46 9.4A19 19 0 0 1 46 38.6a19 19 0 0 1 0-29.2" fill="#FF5F00" />
          </svg>
        </span>
      </div>
      {!compact ? <p className="text-center text-xs text-zinc-500">Ödeme sağlayıcısının sunduğu kartlı ödeme yöntemleri, hesap ve sipariş uygunluğuna göre kullanılabilir. <Link href="/kullanim-kosullari" className="underline underline-offset-2">Koşullar</Link></p> : null}
    </section>
  );
}
