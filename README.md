# Kâr Marjı Hesaplayıcı

Ürün maliyetini ve hedef kâr oranını girince; Amazon.com.tr, Trendyol, n11, Shopify,
Shopier ve Etsy'de o hedefe ulaşmak için gereken satış fiyatını — komisyon, kargo ve
(opsiyonel) reklam giderini hesaba katarak — gösteren, framework'süz, tek sayfalık bir
PWA (telefona "uygulama gibi" eklenebilen web aracı). Ters yönde de çalışır: elinizde
zaten bir satış fiyatı varsa (ör. rakip fiyatı), o fiyatın hangi kâr marjına denk
geldiğini de hesaplar.

Build adımı yok. Sunucu tarafı yok. Tüm hesaplama tarayıcıda, `calc.js` içinde çalışıyor.

## Klasördeki dosyalar

```
index.html          Form + sonuç kartlarının + diyalogların HTML iskeleti
styles.css           Görünüm (mobil öncelikli, bkz. aşağıdaki "Tasarım" bölümü)
calc.js               Tüm oranlar/kargo tabloları/kur + hesaplama mantığı (KH namespace)
storage.js             Kayıtlı ürünler için IndexedDB katmanı (KHStore namespace)
app.js                 DOM kodu: canlı yeniden hesaplama, kaydırma animasyonları, kayıt akışı
manifest.json      PWA manifesti (isim, ikonlar, tema rengi, standalone mod)
sw.js                    Service worker — "ağ öncelikli" önbellekleme (aşağıya bakın)
icons/                 PWA ikonları (favicon, apple-touch-icon, 192/512, maskable)
test.js                 calc.js için Node test paketi (tarayıcısız, hızlı)
scripts/gen_icons.py         İkonları yeniden üretmek için Python/Pillow betiği
scripts/verify_ui.py           Gerçek tarayıcıda (Playwright) uçtan uca UI doğrulaması
scripts/capture_screenshots.py  Gözle inceleme için ekran görüntüsü alma betiği (Playwright)
research/              Oranların dayandığı kaynak notları (tarih + link + güven seviyesi)
```

## Tasarım

Renk sadece işlevsel olduğu yerde var: Amazon/Trendyol/n11/Shopify/Shopier/Etsy'yi
ayırt eden 6 vurgu rengi dışında site tamamen mürekkep/kağıt monokrom — gradyan yok,
"otomatik" seçilmiş bir SaaS-mor teması yok. O renkler de göz kararı seçilmedi:
`dataviz` paletinin çift-çift-ayırt-edilebilirlik doğrulayıcısından geçirildi (gerçek
marka renkleri denendiğinde Amazon/Trendyol/Etsy'nin üçü de turuncu ailesinde çıkıp
`normal-vision ΔE 13.7` ile başarısız oldu — bkz. git geçmişindeki ilgili commit; n11/
Shopier eklenirken de aynı doğrulayıcıdan geçirilip bronz/mürdüm tonlarında karar
kılındı, çünkü altın/zeytin gibi doğal adaylar trendyol turuncusuyla CVD açısından
ayırt edilemiyordu).

Başlıklar ve büyük fiyat rakamları serif (Georgia), arayüz elemanları sans —
tek bir marka rengi yerine bu tipografik kontrastla "tasarlanmış" hissi kuruluyor.
Kartlar gölge değil ince (hairline) çizgiyle ayrılıyor.

Sayfa kaydırıldıkça bölümler (`[data-reveal]` işaretli elemanlar) IntersectionObserver
ile belirir — sayfa yüklenir yüklenmez her şeyin birden görünmesi yerine, aşağı
indikçe animasyon da devam ediyor. Üstteki sabit şerit kaydırınca sıkışıyor (başlık
küçülüyor). `prefers-reduced-motion` açık olan kullanıcılarda tüm bu animasyonlar
otomatik devre dışı kalıyor.

Karanlık tema (header'daki ay/güneş ikonuyla açılıp kapanıyor, tercih
`localStorage`'da kalıcı) kendi ayrı L/C basamaklarıyla `dataviz` doğrulayıcısından
geçirildi — açık temanın renklerinin otomatik koyulaştırılmış hali değil, koyu
yüzeye göre yeniden seçilmiş bir palet (bkz. aşağıdaki "Yeni pazaryerleri, ters mod
ve arayüz güncellemeleri" bölümü). Üstteki sabit şerit (topbar/canlı-şerit/rozet)
tema değişse de HER ZAMAN koyu kalacak şekilde ayrı, sabit CSS değişkenleriyle
(`--chrome-bg` vb.) pimlendi — metin/yüzey rolleriyle aynı değişkenleri paylaşmıyor.

## Kayıtlı ürünler

Özet şeridindeki yer imi (bookmark) ikonuyla o anki hesaplama — ürün adı, satış için
öncelikli platform, isteğe bağlı bir görsel ve 6 platformun da hesaplanan fiyatlarıyla
birlikte — kaydedilebiliyor. Header'daki (sağ üst) ikinci yer imi ikonu kayıtlı
ürünler panelini açıyor; buradan inceleyip silebilirsiniz.

Önemli sınırlama: backend yok, bu yüzden kayıtlar tarayıcının kendi IndexedDB
veritabanında tutuluyor. Yani kayıtlar **sadece o an kullandığınız tarayıcı/cihazda**
duruyor — farklı bir tarayıcıdan, telefondan veya "gizli sekme"den açtığınızda
görünmezler, tarayıcı verisini temizlerseniz silinirler. Cihazlar arası senkron
istiyorsanız bir backend (ör. basit bir Supabase/Firebase tablosu) eklenmesi gerekir
— şu anki statik-site kapsamının dışında.

Görseller IndexedDB'ye yazılmadan önce tarayıcıda (canvas ile) en fazla 640px kenar
uzunluğuna küçültülüp JPEG'e çevriliyor — telefon kamerasından gelen 5-10MB'lık bir
fotoğraf veritabanını şişirmesin diye.

## Kargo modeli (platform bazlı)

Kargo tutarı artık tek bir paylaşılan alan değil — 10 Ağustos 2026'da yapılan
araştırma (bkz. `research/platform-kargo-kisitlari.md`), platformların kargo
firması seçiminde birbirinden çok farklı kısıtlara sahip olduğunu ortaya çıkardı:

- **Amazon (satıcı-gönderimli) ve Shopify:** Kargo firması seçimi serbest —
  soldaki "Kargo" bölümündeki genel piyasa tutarı doğrudan geçerli. (Amazon
  Lojistik/FBA ve Amazon Kolay Gönderi farklı ücretlendirir, kapsam dışı.)
- **Trendyol ve n11:** Satıcı, sözleşmesindeki KAPALI bir anlaşmalı kargo
  listesiyle sınırlı — serbest taşıyıcı seçimi yok (n11 için bu, n11'in kendi
  resmi destek merkezi sayfasıyla doğrulandı; ilk uygulama turunda n11'in
  serbest olduğu YANLIŞLIKLA varsayılmıştı, bkz.
  `research/n11-shopier-gittigidiyor-arastirmasi.md`). Soldaki genel tutar
  varsayılan/yön gösterici olarak kullanılıyor; "Platforma özel ayarlar →
  Trendyol" ve "→ n11" içinde gerçek tutarınızı girebileceğiniz opsiyonel
  birer "Kargo (₺)" alanı var.
- **Shopier:** Anlaşmalı/indirimli kargo hizmeti Shopier'in kendi resmi
  yardım merkezi sayfasına göre bir seçenek, zorunlu değil — bu yüzden
  Amazon/Shopify gibi soldaki genel tutar doğrudan geçerli, ayrı bir override
  alanı yok.
- **Etsy:** Satışlar genelde yurt dışına gittiği için soldaki yurt içi tablo
  HİÇ uygulanmıyor — kavramsal olarak farklı bir maliyet sınıfı. Etsy'nin
  kendi "Kargo — yurt dışı gönderim (₺)" alanı var ("Platforma özel ayarlar →
  Etsy" içinde), varsayılan 0 — Reklam Gideri alanıyla aynı mantıkla, siz
  doldurursunuz.

## Gider kalemleri (2. tur audit, 10 Ağustos 2026)

Kullanıcının "gider kalemlerinin tümü doğru mu sayılmış" sorusu üzerine yapılan
bağımsız bir audit'in ardından (bkz. `research/ek-gider-kalemleri-2026.md`)
şu değişiklikler yapıldı:

- **Amazon/Trendyol KDV-komisyon tabanı sorusu ÇÖZÜLDÜ (bug yoktu):** Amazon
  komisyonu brüt (KDV dahil) fiyata uygulanıp üzerine KDV ekleniyor; Trendyol'da
  komisyon KDV-hariç tabana uygulanıp komisyon FATURASINA KDV ekleniyor — bu
  ikinci mekanizma matematiksel olarak brüt fiyatın doğrudan yüzdesine
  sadeleşiyor. İki platformun kodu da halihazırda doğruydu, sadece farklı
  mekanizmalar üzerinden.
- **Trendyol sabit "platform hizmet bedeli" eklendi:** Komisyondan ayrı,
  sipariş başına sabit bir ücret (varsayılan ₺13,19 — "Platforma özel
  ayarlar → Trendyol" içinden değiştirilebilir).
- **Shopify dış ödeme sağlayıcı modeli eklendi:** Shopify Payments Türkiye'de
  kullanılamadığı için, artık kullanıcının kendi yerel sağlayıcısının oranı +
  Shopify'ın plana göre eklediği ek ücret ayrı ayrı toplanıyor ("Platforma özel
  ayarlar → Shopify" içinden değiştirilebilir).
- **Etsy para birimi çevrim ücreti (%2,5) eklendi:** Resmi kaynaktan, tek/net
  bir rakam.
- **Etsy Türkiye düzenleyici işletim ücreti düzeltildi (%2,27 → %1,67):** Resmi
  kaynağın ülke tablosu doğrudan okundu.
- **İade (return) beklenen maliyeti eklendi:** 1 Ocak 2026'dan itibaren iade
  kargosu satıcıya ait (mevzuat değişikliği). "İade oranı% × iade başına
  maliyet" formülüyle Amazon/Trendyol/Shopify'a ekleniyor (Etsy hariç); ikisi
  de varsayılan 0, güvenilir bir "tipik" oran bulunamadığı için kullanıcı girer.

## Bug / görsel / optimizasyon audit'i (10 Ağustos 2026, 3. tur)

Kod tabanının tamamı bağımsız 3 gözden geçirmeyle (bug, görsel, optimizasyon)
tarandı; bulgular doğrulanıp şu değişiklikler yapıldı:

- **Kritik bug — Amazon'da dilimli komisyon bazı durumlarda kendiyle tutarsız
  bir fiyat/oran döndürüyordu:** Fiyat arttıkça oranın DÜŞTÜĞÜ dilim
  yapılarında (Takı/Mücevher: ≤900₺ için %20, >900₺ için %6) eski kod tek bir
  düzeltme adımıyla sınırlıydı ve bazı maliyet/kâr kombinasyonlarında yanlış
  dilimde kalabiliyordu (doğrulanan örnek: maliyet=650₺, hedef kâr=%10 →
  eski kod ₺785,02 + %6 komisyon döndürüyordu, ama 785,02₺ ≤ 900₺ olduğu için
  gerçekte %20 uygulanır — satıcı zarar ederdi). Bazı kombinasyonlarda ise
  kendiyle tutarlı HİÇBİR fiyat yok (döngü iki aday arasında sonsuza dek
  salınıyor). Düzeltme: yakınsama artık döngü tespitiyle çalışıyor
  (`solveTieredAmazon`), gerçek bir salınım durumunda satıcıyı daha güvende
  bırakan (daha yüksek fiyat/oran gerektiren) aday seçiliyor ve sonuç
  `tierAmbiguous` olarak işaretlenip ilgili sonuç kartında görünür bir uyarı
  gösteriliyor ("Amazon panelinizden gerçek oranı teyit edin").
- **Negatif girdi savunması:** HTML'deki `min="0"` özniteliği JS tarafında
  hiçbir şeyi engellemiyor — kullanıcı elle "-50" yazıp tablayabiliyordu, bu
  da bazı alanlarda (özellikle iade oranı/maliyeti gibi türetilmiş ara
  değerlerde) fiyatı sessizce düşürüyordu. Artık hem `app.js`'te (okuma
  anında) hem `calc.js`'te (`computeAll()`'a giren tüm sayısal alanlar için
  tek noktadan) 0'a kırpılıyor.
- **Aşırı yüksek kâr hedefi:** Oranlar toplamı %100'e çok yaklaştığında (ör.
  %99,9) payda sıfıra yaklaşıp anlamsız/astronomik bir "fiyat" üretiyordu
  (doğrulanan örnek: %99,99 toplamda ₺150 sabit maliyet ~₺1,5 milyon "fiyat"
  üretiyordu). Eşik %100'den %95'e çekildi; üzerinde açık bir hata mesajı
  gösteriliyor.
- **Görsel:** Sayı alanlarındaki tarayıcı ok/spinner düğmeleri artık
  Chromium/Safari VE Firefox'ta tutarlı şekilde gizli. Kayıtlı ürün sayacı
  rozeti yanlışlıkla Trendyol turuncusu kullanıyordu (rozetin platformla
  hiçbir ilgisi yok) — nötr mürekkep/kağıt temasına çekildi. Sonuç
  kartlarındaki platform başlıkları (`AMAZON.COM.TR` vb.) WCAG AA kontrast
  eşiğinin altındaydı (shopify 2.82:1, trendyol 3.20:1 — gereken 4.5:1); kimlik
  zaten kartın üstündeki renkli çizgiyle taşındığı için başlık metni düz
  mürekkep rengine çekildi. Geniş ekranlarda (≥1300px) sonuç kartları 4
  sütuna geçiyordu ama konteyner 900px eşiğinden beri 1180px'te sabitti — her
  kart ~157px'e sıkışıyordu; aynı eşikte konteyner de 1440px'e kadar
  büyüyecek şekilde düzeltildi (kart başına ~222px).
- **Optimizasyon/sağlamlık:** `Intl.NumberFormat`/`Intl.DateTimeFormat`
  nesneleri artık her render'da değil modül yüklenirken bir kez oluşturuluyor.
  Sabit şerit yüksekliği her tuş vuruşunda değil sadece gerçekten
  değişebileceği anlarda (yeniden boyutlandırma/kaydırma) yeniden
  hesaplanıyor. Görsel yükleme ve kayıtlı ürün silme akışlarında birer
  yarış durumu vardı (hızlı art arda iki işlemde, yavaş kalan asenkron
  sonuç daha yeni olanın üzerine yazabiliyordu) — nesil sayaçlarıyla
  düzeltildi. Kayıtlı ürünler paneli her yeniden çizildiğinde eski kartlar
  `IntersectionObserver`'dan çıkarılmadan DOM'dan siliniyordu (büyüyen bir
  sızıntı) — düzeltildi. `storage.js` her işlemde IndexedDB bağlantısını
  yeniden açıyordu — artık bağlantı modül kapsamında önbelleğe alınıyor.
  `sw.js`, başarısız (4xx/5xx) ağ yanıtlarını da önbelleğe yazabiliyordu
  (cevrimdışı kullanıcıya bozuk bir yanıt sunma riski) — artık sadece 2xx
  yanıtlar önbelleğe alınıyor; önbellek sürümü v5 → v6.

Denetimde tespit edilip **kasıtlı olarak değiştirilmeyen** noktalar da var —
ör. dosyaların minify edilmemesi (statik/framework'süz bir site için okunabilirlik
tercih edildi), görsel yeniden boyutlandırma tavanının (640px) yükseltilmemesi.
Bu değişiklikler `node test.js` ve `scripts/verify_ui.py` ile doğrulandı (yeni
`tierAmbiguous` uyarısı, rozet rengi ve geniş-ekran konteyner genişliği için
yeni otomatik kontroller eklendi).

## Yeni pazaryerleri, ters mod ve arayüz güncellemeleri (10 Ağustos 2026)

Kullanıcının "güncellik & görünüm", "hesaplama gücü" ve "başka hangi mağazalar
var (Shopier, GittiGidiyor, n11)?" isteklerinin ardından yapılan üçüncü bir
genişletme turu:

- **n11 ve Shopier eklendi, GittiGidiyor araştırılıp EKLENMEDİ:** GittiGidiyor
  2022'de aşamalı olarak kapanıp eBay bünyesine katıldı — aktif bir pazaryeri
  değil (çoklu haber kaynağıyla doğrulandı, YÜKSEK güven). n11'in kategori
  komisyonu + sabit "%1 pazarlama + %0,67 pazaryeri" hizmet bedeli, Shopier'in
  komisyonu ve kargo modelleri eklendi — kaynaklar ve güven seviyeleri için
  bkz. `research/n11-shopier-gittigidiyor-arastirmasi.md`.
- **Aynı gün, dokümantasyon yazılırken yakalanan iki DÜZELTME:** n11'in kargo
  firması seçiminin serbest olduğu ve Shopier'in komisyonunun sabit %2,99
  olduğu, ilk uygulama turunda YANLIŞ varsayılmıştı. n11'in kendi resmi destek
  sayfası kargo seçiminin ZORUNLU kapalı bir liste olduğunu (Trendyol'la aynı
  desen), Shopier'in kendi ana sayfası da komisyonun "%2,99'DAN BAŞLAYAN"
  (yani sadece yüksek hacimli satıcılar için geçerli taban oran) olduğunu
  gösteriyor — standart/başlangıç oranı %4,99. İkisi de gerçek hesaplanan
  fiyatı etkilediği için (sadece dokümantasyon değil) hem `calc.js` hem
  testler düzeltildi; n11 için Trendyol'daki desenle aynı `n11KargoOverrideTRY`
  alanı eklendi. Ayrıntı için araştırma dosyasındaki "Düzeltme notu" bölümüne
  bakın.
- **Ters mod (fiyattan kâra):** Üstteki "Maliyetten fiyat / Fiyattan kâr"
  geçişiyle, elinizde zaten bir satış fiyatı varsa (ör. rakip fiyatı) o
  fiyatın her platformda hangi kâr marjına denk geldiği hesaplanıyor
  (`KH.computeAllFromPrice`). Dilimli Amazon kategorilerinde bile yakınsama
  gerekmiyor — fiyat zaten bilindiği için doğru komisyon dilimi doğrudan
  bulunuyor (ileri moddaki gibi bir "hangi dilim" arayışı yok).
- **Birim kâr (₺) ve aylık hacim projeksiyonu:** Her sonuç kartında artık
  yüzdenin yanında TL cinsinden birim kâr da gösteriliyor; opsiyonel "Aylık
  tahmini satış adedi" alanı doldurulursa aylık toplam kâr projeksiyonu da
  ekleniyor (sadece gösterim amaçlı, fiyatı etkilemez — Shopify'ın kendi
  abonelik-bölme alanından bağımsız bir alan).
- **Güncellik şeridi:** Sayfa başında kur/oran verisinin hangi tarihe ait
  olduğunu gösteren bir şerit var; veri güncelse nötr, 30 günden eskiyse
  (ör. uzun süre güncellenmeyen bir kopya) görsel olarak "bayat" işaretleniyor.
- **Sektör arama:** "Sektör" açılır listesinin üstüne, yazarken en yakın
  eşleşen sektöre atlayan (listeyi filtrelemeden — `scripts/verify_ui.py`
  uyumluluğu için kasıtlı) bir arama kutusu eklendi; 31 sektör arasında elle
  kaydırmak yerine "ayakkab" yazıp doğrudan atlanabiliyor.
- **Karanlık tema:** Header'daki ay/güneş ikonuyla açılıp kapanıyor, tercih
  `localStorage`'da kalıcı. Kendi ayrı L/C basamaklarıyla `dataviz`
  doğrulayıcısından geçirilmiş bir palet (açık temanın otomatik koyulaştırılmış
  hali değil) — bkz. yukarıdaki "Tasarım" bölümü.
- **Bulunan ve düzeltilen ayrı bir görsel bug:** `#targetPriceFieldWrap`
  (ters mod alanı) ileri modda `hidden` özniteliğine rağmen GÖRÜNÜR
  render ediyordu — `class="field"` (`display:flex`) yazar-kökenli CSS'i,
  `[hidden]`'ın tarayıcı-kökenli `display:none` varsayılanının HER ZAMAN
  ezmesi yüzünden (özgüllükten bağımsız, CSS kademesinin temel bir kuralı).
  Bunu otomatik Playwright kontrolleri (sadece `el.hidden` DOM özniteliğine
  bakıyordu) YAKALAYAMADI — ekran görüntüsü incelemesiyle bulundu. Düzeltme:
  global `[hidden] { display: none !important; }` kuralı eklendi, ilgili
  testler artık hem `el.hidden` HEM `getComputedStyle(el).display` kontrol
  ediyor.

## Nasıl çalıştırılır

Servis çalışanı (service worker) ve `fetch` ile okunan `manifest.json` nedeniyle dosyayı
doğrudan çift tıklayıp `file://` ile açmayın — bazı tarayıcılarda service worker
kaydı `file://` üzerinde çalışmaz. Basit bir yerel sunucuyla açın:

```
cd kar-hesap
python3 -m http.server 8080
```

sonra tarayıcıda `http://localhost:8080/` adresine gidin. Node yüklüyse alternatif olarak
`npx serve .` de kullanılabilir.

## Telefona "uygulama gibi" ekleme (PWA)

Site bir yere deploy edildikten sonra (bkz. aşağıdaki "Yayınlama" bölümü):

- **Android / Chrome:** Siteyi aç → sağ üstteki ⋮ menü → "Ana ekrana ekle" / "Uygulama yükle".
- **iPhone / Safari:** Siteyi aç → paylaş simgesi → "Ana Ekrana Ekle". (iOS'ta bu adım
  yalnızca Safari'den yapılabilir; Chrome/diğer tarayıcılardan çalışmaz — bu bir
  Apple kısıtlaması.)

## Oranları / kargo fiyatlarını / kuru güncelleme

Hepsi `calc.js` içinde, düz JavaScript objeleri olarak duruyor — build gerekmiyor,
değiştirip kaydetmeniz yeterli:

- `KH.FX` — USD/TRY, EUR/TRY anlık kur değeri ve tarihi (Shopify/Etsy TL çevirisinde kullanılıyor).
- `KH.CARGO` — Her taşıyıcı için desi bazlı fiyat aralıkları (Aras Kargo kasıtlı olarak yok).
  Bu tablo Amazon/Shopify/Shopier/n11/Trendyol-varsayılanı için ortak; Trendyol'un ve
  n11'in kendi override'ları (`trendyolKargoOverrideTRY` / `n11KargoOverrideTRY`) ve
  Etsy'nin tamamen ayrı kargo alanı `computeAll()`'a doğrudan input olarak geçiliyor
  (bkz. "Kargo modeli" bölümü yukarıda).
- `KH.SECTORS` — Sektör başına Amazon/Trendyol/n11 komisyon oranları (Amazon'da bazı
  sektörler fiyata göre dilimli, ör. Takı/Mücevher, Kozmetik, Gıda; n11 alanı kasıtlı
  olarak kısmi — bkz. "Kaynak güvenilirliği" bölümü aşağıda).
- `KH.N11_HIZMET_BEDELI_PCT` — n11'in komisyondan ayrı, tüm kategorilerde sabit
  "%1 pazarlama + %0,67 pazaryeri" hizmet bedeli (KDV dahil, n11'in resmi destek
  sayfasıyla doğrulandı).
- `KH.SHOPIFY_PLANS` — Plan başına aylık ücret + Shopify'ın "dış ödeme sağlayıcı"
  ek ücreti (Shopify Payments Türkiye'de yok, bkz. "Gider kalemleri" bölümü aşağıda).
- `KH.SHOPIFY_GATEWAY_DEFAULT_PCT` — Kullanıcının kendi yerel ödeme sağlayıcısından
  (iyzico/PayTR/banka sanal POS vb.) bildirdiği varsayılan komisyon oranı.
- `KH.TRENDYOL_HIZMET_BEDELI_TRY` — Trendyol'un komisyondan ayrı, sipariş başına sabit ücreti.
- `KH.SHOPIER` — Sabit 0,49₺ işlem ücreti + komisyon oranı (`commissionPct`, varsayılan
  %4,99 — Shopier'in kendi ana sayfasına göre bu SADECE standart/başlangıç oranı, aylık
  satış hacmi arttıkça %2,99'a kadar düşen kademeli bir yapı var ama tam eşikler kaynaklar
  arası tutarsız olduğu için modellenmedi; gerçek panel oranınızı arayüzdeki override
  alanına girin).
- `KH.ETSY` — İşlem/ilan/düzenleyici/ödeme işleme/para birimi çevrim oranları + Offsite Ads ücreti.

Bir değeri değiştirdikten sonra `node test.js` çalıştırıp hâlâ "TÜM TESTLER GEÇTİ"
çıktığını görmeniz yeterli (mantık testleri elle hesaplanmış örneklerle karşılaştırıyor,
oranların kendisini değil hesaplama mantığının doğruluğunu kontrol ediyor).

İkonları değiştirmek isterseniz `scripts/gen_icons.py`'deki `BRAND` rengini (şu an
`styles.css`'teki `--ink` ile aynı `#17160F`) veya glif karakterini (`"%"`)
değiştirip `python3 scripts/gen_icons.py` çalıştırmanız yeterli.

## Kaynak güvenilirliği — önemli

`research/` klasöründeki beş dosya, uygulamaya gömülü her oranın nereden geldiğini,
hangi tarihte doğrulandığını ve ne kadar güvenilir olduğunu anlatıyor. Özetle:

- **Amazon.com.tr:** Resmi kaynak (satis.amazon.com.tr/ucretlendirme), 16 Nisan 2026
  tarifesi — yüksek güven. Komisyon KDV dahil (brüt) fiyat üzerinden hesaplanıp
  üzerine ayrıca KDV ekleniyor.
- **Trendyol (komisyon):** Amazon gibi tek/resmi bir oran sayfası yok. 4 bağımsız
  kaynaktan derlenen YAKLAŞIK değerler kullanılıyor — arayüzde bunun yerine kendi
  satıcı panelinizdeki gerçek oranı yazabileceğiniz opsiyonel bir alan var. KDV-hariç
  tabana uygulanıp komisyon faturasına KDV eklendiği doğrulandı (bkz. "Gider kalemleri"
  bölümü) — bu, brüt fiyatın doğrudan yüzdesiyle matematiksel olarak eşdeğer çıkıyor.
- **Trendyol (sabit hizmet bedeli):** pazarfiyat.com kaynaklı, 30 Ocak 2026 tarihli,
  iki kademeli (6,99₺+KDV / 10,99₺+KDV) — ORTA güven, tek kaynak; panelinizdeki
  gerçek tutarla değiştirilebilir.
- **Shopify (abonelik + dış sağlayıcı ek ücreti):** Resmi kaynak (shopify.com/pricing)
  — yüksek güven, USD'den güncel kur anlık görüntüsüyle TL'ye çevrildi. Shopify
  Payments'ın Türkiye'de kullanılamadığı ayrıca doğrulandı (workon.com.tr).
- **Shopify (ödeme sağlayıcı komisyonu):** Varsayılan %2,65, aracın kullanıcısının
  kendi dış ödeme sisteminden ekran görüntüsüyle bildirdiği GERÇEK rakam — genel bir
  piyasa tahmini değil, YÜKSEK güven ama kişiye özel (farklı sağlayıcı/valör
  kullananlar değiştirmeli).
- **Etsy (işlem komisyonu + para birimi çevrim ücreti):** Çok kaynaklı/resmi
  teyitli — yüksek güven. **Etsy (TR düzenleyici ücreti):** %1,67, resmi kaynağın
  ülke tablosundan (10 Ağustos 2026, 2. tur) — ORTA-YÜKSEK güven (otomatik
  özetleme aracıyla okundu, ham HTML birebir teyit edilmedi). **Etsy (ödeme
  işleme oranı):** Türkiye için hiçbir kaynakta netleşmedi (tahmini %4, elle
  düzeltilebilir alan var).
- **İade (return) maliyeti:** Kargo sorumluluğunun satıcıya geçtiği mevzuat
  değişikliği (1 Ocak 2026) resmi haber kaynağıyla (AA) doğrulandı — YÜKSEK güven.
  Ama "tipik iade oranı" hiçbir kaynakta standart bir rakam olarak bulunamadı —
  bu yüzden varsayılan 0, kullanıcı kendi rakamını girer.
- **Kargo (yurt içi tablo):** Navlungo Domestic 2026 teklif PDF'inden — Aras Kargo,
  isteğiniz üzerine listeden çıkarıldı.
- **Kargo — platform kısıtları (10 Ağustos 2026):** `research/platform-kargo-kisitlari.md`.
  Trendyol resmi olarak KAPALI bir anlaşmalı kargo listesi kullanıyor (developers.trendyol.com);
  üç ikincil kaynağın Trendyol tarifeleri aynı taşıyıcı/desi için %35'e varan farkla
  ayrışıyor — DÜŞÜK güven, override alanı önerilir. Amazon'un satıcı-gönderimli
  seçeneği serbest (YÜKSEK güven, resmi kaynak). Shopify tamamen serbest. Etsy
  satışları yurt dışına gittiği için yurt içi tablo hiç geçerli değil — güvenilir
  tek bir "ortalama uluslararası kargo" rakamı hiçbir kaynakta bulunamadı (rakip bir
  Etsy kâr hesaplama aracı bile bu yüzden sabit bir tahmin kullanmıyor); bu alan
  kasıtlı olarak kullanıcı girişine bırakıldı.
- **n11 (kategori komisyonu):** Amazon gibi tek/resmi bir oran sayfası yok; iki
  bağımsız 2026 tarihli ikincil kaynaktan (Sentos, Paraşüt) derlenen YAKLAŞIK
  değerler — ORTA güven, kapsam kasıtlı olarak kısmi (~8 sektör; kaynaklardan
  biri bazı kategoriler için 2024'ten kalma veri kullandığını itiraf ediyor).
  **n11 (hizmet bedeli + kargo):** n11'in kendi resmi destek merkezi sayfasıyla
  doğrulandı — YÜKSEK güven. Kargo firması seçimi ZORUNLU kapalı bir liste
  (Trendyol'la aynı model) — ilk uygulama turunda "serbest" YANLIŞLIKLA
  varsayılmıştı, bu doğrulama sırasında düzeltildi (bkz.
  `research/n11-shopier-gittigidiyor-arastirmasi.md`).
- **Shopier (komisyon):** Kademeli bir yapı (Shopier'in kendi ana sayfası
  "%2,99'DAN BAŞLAYAN" diyor) — ilk uygulama turunda YANLIŞLIKLA herkes için
  sabit %2,99 sanılmıştı. Standart/başlangıç oranı (%4,99) iki bağımsız
  kaynakla doğrulandı ama tam kademe eşikleri (hangi ciroda %2,99'a düşüldüğü)
  kaynaklar arasında 100.000₺/ay ile 1,5 milyon₺/ay arasında ÇELİŞİYOR — bu
  yüzden ORTA güven, panelinizdeki gerçek oranı override alanına girmeniz
  önerilir. **Shopier (kargo):** Resmi kaynakla doğrulandı, anlaşmalı kargo
  opsiyonel — YÜKSEK güven.
- **GittiGidiyor:** Araştırıldı ama EKLENMEDİ — 2022'de aşamalı olarak kapandı,
  eBay bünyesine katıldı, aktif bir pazaryeri değil. Çoklu ve birbirini
  doğrulayan haber kaynağıyla teyit edildi (Webrazzi, NTV, Wikipedia) —
  YÜKSEK güven.

Uygulamanın kendisinde de "Kaynaklar & güven notları" bölümü (sayfanın altında,
açılır panel) aynı uyarıları gösteriyor.

## Reklam gideri alanı

"Reklam gideri (₺)" alanı bilinçli olarak araştırılmadı/varsayılan değer verilmedi —
opsiyonel bir alan, kâr hesabına dahil edilecek reklam maliyetini istediğinizde siz
belirlersiniz (Etsy'nin zorunlu Offsite Ads ücretinden ayrı bir kalem; o ayrıca kendi
onay kutusuyla hesaba giriyor).

## Test etme

```
node test.js                      # calc.js mantık testleri (tarayıcısız)
python3 -m http.server 8080 &     # UI testi için önce siteyi yerelde servis edin
python3 scripts/verify_ui.py      # Playwright ile gerçek tarayıcıda uçtan uca test
python3 scripts/capture_screenshots.py   # (opsiyonel) gözle inceleme için ekran görüntüsü
```

Otomatik testler DOM/computed-style seviyesinde doğru olsa bile gerçek bir görsel
bug'ı kaçırabilir (bkz. yukarıdaki `[hidden]` bug'ı) — önemli bir CSS/görsel
değişiklikten sonra ekran görüntülerini gözle de kontrol etmek önerilir.

## Yayınlama (GitHub / Vercel)

Bu oturumda GitHub veya Vercel bağlantısı aktif değil (bağlı bir connector bulunamadı).
İki seçenek:

1. **Elle:** Bu klasörü bilgisayarınıza indirip `git init`, GitHub'da boş bir repo
   açıp `git remote add origin ...` + `git push` yapın; ardından vercel.com'da
   "Import Project" ile o repo'yu seçin (framework: "Other" / statik site — build
   komutu yok, "Output Directory" bu klasörün kökü).
2. **Connector bağlayarak:** claude.ai/Claude ayarlarından GitHub ve Vercel
   bağlantılarını etkinleştirirseniz, sonraki bir oturumda repo oluşturma ve deploy
   işlemini sizin adınıza (onayınızla) yapabilirim.

Statik dosyalar olduğu için Vercel/Netlify/GitHub Pages gibi herhangi bir statik
hosting ile de sorunsuz çalışır.
