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
- `KH.SECTORS` — Sektör başına Amazon/Trendyol komisyon oranları (Amazon'da bazı
  sektörler fiyata göre dilimli, ör. Takı/Mücevher, Kozmetik, Gıda).
- `KH.SHOPIFY_PLANS` — Plan başına aylık ücret + kart işlem oranı.
- `KH.ETSY` — İşlem/ilan/düzenleyici/ödeme işleme oranları + Offsite Ads ücreti.

Bir değeri değiştirdikten sonra `node test.js` çalıştırıp hâlâ "TÜM TESTLER GEÇTİ"
çıktığını görmeniz yeterli (mantık testleri elle hesaplanmış örneklerle karşılaştırıyor,
oranların kendisini değil hesaplama mantığının doğruluğunu kontrol ediyor).

İkonları değiştirmek isterseniz `scripts/gen_icons.py`'deki `BRAND` rengini (şu an
`styles.css`'teki `--ink` ile aynı `#17160F`) veya glif karakterini (`"%"`)
değiştirip `python3 scripts/gen_icons.py` çalıştırmanız yeterli.

## Kaynak güvenilirliği — önemli

`research/` klasöründeki iki dosya, uygulamaya gömülü her oranın nereden geldiğini,
hangi tarihte doğrulandığını ve ne kadar güvenilir olduğunu anlatıyor. Özetle:

- **Amazon.com.tr:** Resmi kaynak (satis.amazon.com.tr/ucretlendirme), 16 Nisan 2026
  tarifesi — yüksek güven.
- **Trendyol:** Amazon gibi tek/resmi bir oran sayfası yok. 4 bağımsız kaynaktan
  derlenen YAKLAŞIK değerler kullanılıyor — arayüzde bunun yerine kendi satıcı
  panelinizdeki gerçek oranı yazabileceğiniz opsiyonel bir alan var.
- **Shopify:** Resmi kaynak (shopify.com/pricing) — yüksek güven, USD'den güncel
  kur anlık görüntüsüyle TL'ye çevrildi.
- **Etsy:** İşlem komisyonu ve TR düzenleyici ücreti çok kaynaklı teyitli; ödeme
  işleme oranı Türkiye için hiçbir kaynakta netleşmedi (tahmini %4, elle
  düzeltilebilir alan var).
- **Kargo:** Navlungo Domestic 2026 teklif PDF'inden — Aras Kargo, isteğiniz üzerine
  listeden çıkarıldı.

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
