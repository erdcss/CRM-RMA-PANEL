# Çalışkan Dükkan — bağımsız Windows Ön Muhasebe

Bu, Çalışkan Admin panelini açan bir kabuk DEĞİLDİR. Elektron masaüstü penceresi ve tam yerel SQLite dosyasıyla çalışır. İnternet gerekmez, web adresi yüklemez.

Özellikler: satış/alış/iade; stok/barkod/fiyat; cari borç alacak; tahsilat/ödeme; kasa; bankalar; çek/senet; alış-satış siparişi; rapor ve CSV; yerel SQLite yedek ve geri yükleme.

Windows EXE: GitHub Actions > Çalışkan Dükkan Bağımsız Windows Kurulumu > Caliskan-Dukkan-Bagimsiz-Windows artifact.

Veriler Windows kullanıcı profili altındaki Electron userData klasöründe, dukkan.sqlite dosyasında tutulur. Ayarlardan düzenli harici yedek alın.

Önemli sınırlamalar: GİB e-Fatura ve e-Arşiv entegrasyonu yoktur; uygulama içi fatura kayıtları resmî belge değildir. Çoklu cihaz senkronizasyonu ve Çalışkan B2B entegrasyonu yoktur. Tek kullanıcı/tek bilgisayar pilot sürümüdür; kapsamlı ticari muhasebe yerine geçmez.

Test ve derleme: npm install, npm test, npm run dist. Windows x64 .exe NSIS kurulum.