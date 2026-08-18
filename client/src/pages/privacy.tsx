export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">Çalışkan RMA</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Gizlilik Politikası ve KVKK Aydınlatma Metni
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Son güncelleme: 18 Ağustos 2026</p>
        </div>

        <section className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="text-2xl font-semibold">1. Gizlilik Politikası</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Bu politika, Çalışkan RMA uygulamasının kullanıcı hesabı ve RMA yönetim hizmetleri kapsamında
              işlenen kişisel verilere ilişkin temel gizlilik uygulamalarını açıklar. Uygulamanın veri
              sorumlusu Erdem Çalışgan'dır. Gizlilik ve kişisel veri talepleri için erdemcls94@gmail.com
              adresinden iletişime geçebilirsiniz.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">İşlenebilen veri kategorileri</h3>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-muted-foreground">
              <li>Hesap verileri: e-posta adresi, kullanıcı kimliği ve kimlik doğrulama bilgileri.</li>
              <li>
                RMA ve iş kayıtları: kullanıcı tarafından girilen cari/müşteri adı ve kodu, telefon, e-posta,
                adres, ürün adı, stok kodu, marka, model, seri numarası, miktar, işlem türü, durum ve notlar.
              </li>
              <li>Tedarikçi eşleştirmeleri ve uygulama içindeki operasyon kayıtları.</li>
              <li>
                Hizmetin güvenliği, çalışması ve hata giderme amacıyla altyapı sağlayıcıları tarafından
                işlenebilen sınırlı teknik kayıtlar.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Verilerin kullanım amaçları</h3>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-muted-foreground">
              <li>Kullanıcı hesabının oluşturulması, doğrulanması ve oturum yönetimi.</li>
              <li>RMA, ürün, cari ve tedarikçi süreçlerinin kullanıcı hesabına bağlı olarak yürütülmesi.</li>
              <li>Hizmet güvenliğinin sağlanması, hataların giderilmesi ve kötüye kullanımın önlenmesi.</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi ve hakların tesisi, kullanılması veya korunması.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Hizmet sağlayıcıları ve aktarım</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Çalışkan RMA; kimlik doğrulama, veritabanı ve ilgili bulut hizmetleri için Supabase, sunucu/API
              barındırma için Railway altyapısından yararlanır. Veriler yalnızca hizmetin sağlanması,
              güvenliği ve teknik işletimi için gerekli ölçüde bu hizmet sağlayıcıları tarafından işlenebilir.
              Kullanılan bulut altyapısının konumuna bağlı olarak kişisel veriler Türkiye dışında da
              işlenebilir. Yurt dışı veri aktarımlarında yürürlükteki 6698 sayılı Kanun'un 9. maddesi ve
              ilgili ikincil düzenlemelerdeki aktarım şartları esas alınır.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Saklama ve hesap silme</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Veriler, hesabın aktif olduğu ve yukarıdaki amaçlar için gerekli olduğu süre boyunca saklanır.
              Kullanıcı uygulama içindeki “Hesabımı Sil” özelliğini kullanarak hesabının silinmesini
              başlatabilir. Bu işlem, kullanıcıya açıkça bağlı RMA kayıtlarını, ürün/cari kataloglarını,
              tedarikçi kayıtlarını ve kimlik doğrulama hesabını siler. Kanunen saklanması zorunlu kayıtlar,
              güvenlik kayıtları veya yedeklerde teknik olarak sınırlı süreyle kalan veriler ilgili saklama
              yükümlülükleri ve teknik silme döngüleri kapsamında tutulabilir.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Çocukların gizliliği</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Çalışkan RMA, iş süreçlerinin yönetimi amacıyla tasarlanmıştır ve çocuklara yönelik bir hizmet
              değildir.
            </p>
          </div>
        </section>

        <section className="mt-8 space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <div>
            <h2 className="text-2xl font-semibold">2. KVKK Aydınlatma Metni</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              İşbu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi
              kapsamında, Çalışkan RMA kullanımı sırasında elde edilen kişisel veriler bakımından hazırlanmıştır.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Veri sorumlusu</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Erdem Çalışgan — İletişim: erdemcls94@gmail.com
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Kişisel verilerin işlenme amaçları</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Hesap ve kimlik doğrulama süreçlerinin yürütülmesi; RMA, ürün, cari ve tedarikçi kayıtlarının
              tutulması; kullanıcıya uygulama hizmetlerinin sunulması; bilgi güvenliğinin sağlanması;
              teknik sorunların giderilmesi; hukuki yükümlülüklerin yerine getirilmesi ve uyuşmazlıklarda
              hakların korunması amaçlarıyla kişisel veriler işlenebilir.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Toplama yöntemi ve hukuki sebepler</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Kişisel veriler; mobil uygulama, web uygulaması, API ve kullanıcı tarafından girilen kayıtlar
              aracılığıyla elektronik ortamda toplanır. Veriler, somut işleme faaliyetine göre 6698 sayılı
              Kanun'un 5. maddesinde yer alan sözleşmenin kurulması veya ifası için gerekli olma, veri
              sorumlusunun hukuki yükümlülüğünü yerine getirmesi için zorunlu olma, bir hakkın tesisi,
              kullanılması veya korunması için zorunlu olma ve ilgili kişinin temel hak ve özgürlüklerine
              zarar vermemek kaydıyla veri sorumlusunun meşru menfaati için zorunlu olma hukuki sebeplerine
              dayanılarak işlenebilir. Açık rıza gerektiren ayrı bir işleme faaliyeti ortaya çıkarsa açık rıza
              ayrıca alınır.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Aktarım yapılabilecek alıcı grupları</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Kişisel veriler, hizmetin teknik olarak sunulması amacıyla barındırma, kimlik doğrulama,
              veritabanı ve bilişim altyapısı sağlayıcılarına; ayrıca kanunen yetkili kamu kurum ve
              kuruluşlarına, yalnızca gerekli olduğu ölçüde aktarılabilir.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">KVKK kapsamındaki haklarınız</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              6698 sayılı Kanun'un 11. maddesi kapsamında kişisel verilerinizin işlenip işlenmediğini öğrenme,
              işlenmişse bilgi talep etme, işlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,
              aktarıldığı üçüncü kişileri bilme, eksik veya yanlış verilerin düzeltilmesini isteme, şartları
              oluştuğunda silinmesini veya yok edilmesini isteme, bu işlemlerin verilerin aktarıldığı üçüncü
              kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz sonucunda aleyhinize bir
              sonuca itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini
              talep etme haklarına sahipsiniz.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Başvuru</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Gizlilik, kişisel veri veya KVKK kapsamındaki başvurularınızı erdemcls94@gmail.com adresine
              iletebilirsiniz. Başvurunun değerlendirilmesi için kimliğinizi ve talebinizi doğrulamaya yetecek
              bilgiler istenebilir.
            </p>
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-muted-foreground">
          Bu metin uygulamanın mevcut teknik işleyişini açıklamak amacıyla hazırlanmıştır. Mevzuat veya
          uygulamanın veri işleme faaliyetleri değiştiğinde metin güncellenebilir.
        </p>
      </div>
    </main>
  );
}
