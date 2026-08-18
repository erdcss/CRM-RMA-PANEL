import { Link } from "wouter";

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">Çalışkan RMA</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Destek</h1>
          <p className="mt-3 text-muted-foreground">
            Uygulama kullanımı, hesap sorunları, hata bildirimleri ve geliştirme önerileri için bizimle iletişime geçebilirsiniz.
          </p>
        </div>

        <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">İletişim</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Destek sorumlusu: Erdem Çalışgan
            </p>
            <p className="mt-1 leading-7 text-muted-foreground">
              E-posta:{" "}
              <a className="font-medium text-primary hover:underline" href="mailto:erdemcls94@gmail.com">
                erdemcls94@gmail.com
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Destek konuları</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-muted-foreground">
              <li>Giriş ve hesap erişimi sorunları</li>
              <li>RMA, iade, değişim ve servis kayıtları</li>
              <li>Müşteri ve ürün kayıtları</li>
              <li>Hata bildirimi ve teknik destek</li>
              <li>Özellik ve geliştirme önerileri</li>
              <li>Hesap silme ve gizlilik talepleri</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Gizlilik</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Kişisel veriler ve gizlilik hakkında ayrıntılı bilgi için{" "}
              <Link href="/privacy" className="font-medium text-primary hover:underline">
                Gizlilik Politikası ve KVKK Aydınlatma Metni
              </Link>
              'ni inceleyebilirsiniz.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
