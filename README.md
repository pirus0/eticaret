# Kâr Marjı Hesaplayıcı

Ürün maliyetini ve hedef kâr oranını girince; Amazon.com.tr, Trendyol, Shopify ve Etsy'de
o hedefe ulaşmak için gereken satış fiyatını — komisyon, kargo ve (opsiyonel) reklam
giderini hesaba katarak — gösteren, framework'süz, tek sayfalık bir PWA (telefona
"uygulama gibi" eklenebilen web aracı).

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
research/              Oranların dayandığı kaynak notları (tarih + link + güven seviyesi)
```

## Tasarım

Renk sadece işlevsel olduğu yerde var: Amazon/Trendyol/Shopify/Etsy'yi ayırt eden
4 vurgu rengi dışında site tamamen mürekkep/kağıt monokrom — gradyan yok, "otomatik"
seçilmiş bir SaaS-mor teması yok. O 4 renk de göz kararı seçilmedi: `dataviz`
paletinin çift-çift-ayırt-edilebilirlik doğrulayıcısından geçirildi (gerçek marka
renkleri denendiğinde Amazon/Trendyol/Etsy'nin üçü de turuncu ailesinde çıkıp
`normal-vision ΔE 13.7` ile başarısız oldu — bkz. git geçmişindeki ilgili commit).

Başlıklar ve büyük fiyat rakamları serif (Georgia), arayüz elemanları sans —
tek bir marka rengi yerine bu tipografik kontrastla "tasarlanmış" hissi kuruluyor.
Kartlar gölge değil ince (hairline) çizgiyle ayrılıyor.

Sayfa kaydırıldıkça bölümler (`[data-reveal]` işaretli elemanlar) IntersectionObserver
ile belirir — sayfa yüklenir yüklenmez her şeyin birden görünmesi yerine, aşağı
indikçe animasyon da devam ediyor. Üstteki sabit şerit kaydırınca sıkışıyor (başlık
küçülüyor). `prefers-reduced-motion` açık olan kullanıcılarda tüm bu animasyonlar
otomatik devre dışı kalıyor.

## Kayıtlı ürünler

Özet şeridindeki yer imi (bookmark) ikonuyla o anki hesaplama — ürün adı, satış için
öncelikli platform, isteğe bağlı bir görsel ve 4 platformun da hesaplanan fiyatlarıyla
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
- **Trendyol:** Satıcı, sözleşmesindeki KAPALI bir anlaşmalı kargo listesiyle
  sınırlı (serbest taşıyıcı seçimi yok — bkz. aşağıdaki kaynak güvenilirliği
  bölümü). Soldaki genel tutar varsayılan/yön gösterici olarak kullanılıyor;
  "Platforma özel ayarlar → Trendyol" içinde gerçek tutarınızı girebileceğiniz
  opsiyonel bir "Kargo (₺)" alanı var.
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
  Bu tablo Amazon/Shopify/Trendyol-varsayılanı için ortak; Trendyol'un kendi override'ı ve
  Etsy'nin tamamen ayrı kargo alanı `computeAll()`'a doğrudan input olarak geçiliyor
  (bkz. "Kargo modeli" bölümü yukarıda).
- `KH.SECTORS` — Sektör başına Amazon/Trendyol komisyon oranları (Amazon'da bazı
  sektörler fiyata göre dilimli, ör. Takı/Mücevher, Kozmetik, Gıda).
- `KH.SHOPIFY_PLANS` — Plan başına aylık ücret + Shopify'ın "dış ödeme sağlayıcı"
  ek ücreti (Shopify Payments Türkiye'de yok, bkz. "Gider kalemleri" bölümü aşağıda).
- `KH.SHOPIFY_GATEWAY_DEFAULT_PCT` — Kullanıcının kendi yerel ödeme sağlayıcısından
  (iyzico/PayTR/banka sanal POS vb.) bildirdiği varsayılan komisyon oranı.
- `KH.TRENDYOL_HIZMET_BEDELI_TRY` — Trendyol'un komisyondan ayrı, sipariş başına sabit ücreti.
- `KH.ETSY` — İşlem/ilan/düzenleyici/ödeme işleme/para birimi çevrim oranları + Offsite Ads ücreti.

Bir değeri değiştirdikten sonra `node test.js` çalıştırıp hâlâ "TÜM TESTLER GEÇTİ"
çıktığını görmeniz yeterli (mantık testleri elle hesaplanmış örneklerle karşılaştırıyor,
oranların kendisini değil hesaplama mantığının doğruluğunu kontrol ediyor).

İkonları değiştirmek isterseniz `scripts/gen_icons.py`'deki `BRAND` rengini (şu an
`styles.css`'teki `--ink` ile aynı `#17160F`) veya glif karakterini (`"%"`)
değiştirip `python3 scripts/gen_icons.py` çalıştırmanız yeterli.

## Kaynak güvenilirliği — önemli

`research/` klasöründeki dört dosya, uygulamaya gömülü her oranın nereden geldiğini,
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
```

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
