# Platform bazlı kargo kısıtları — araştırma notları (10 Ağustos 2026)

Bu dosya, "kargo tutarı her platformda aynı mı" sorusunun araştırmasını belgeler.
Kullanıcı, Trendyol'un kendi kargosunu zorunlu tuttuğunu ("Ben kargoyla
gönderirken Shopify için kargo pdf attım... Trendyol kendi kargosuyla
gönderiyor sadece") belirtip diğer platformların da araştırılmasını istedi.
`navlungo-kargo-fiyatlari.md`'deki tablo (kullanıcının kendi yüklediği Navlungo
teklif PDF'i) tek bir GENEL PİYASA fiyatı verir; bu dosya o tablonun hangi
platformlar için gerçekten geçerli olduğunu inceliyor.

## Özet tablo

| Platform | Kargo firması seçimi | Bu tablo geçerli mi? |
|---|---|---|
| Amazon.com.tr | Serbest (satıcı-gönderimli senaryoda) | Evet, o senaryoda |
| Trendyol | KAPALI liste (sözleşmeli 10 firma) | Yaklaşık/varsayılan, kesin değil |
| Shopify | Tamamen serbest | Evet |
| Etsy | Serbest AMA yurt dışı gönderim | Hayır — farklı maliyet sınıfı |

## Trendyol

**Resmi kaynak** (developers.trendyol.com, Trendyol Kargo Şirketleri Listesi /
getProviders): Trendyol satıcılara **10 sabit kargo şirketi** sunuyor (Kolay
Gelsin, Ceva Tedarik, DHL eCommerce, PTT Kargo, Sürat Kargo, Trendyol Express,
Horoz Kargo, CEVA, Yurtiçi Kargo, Aras Kargo — hepsi "Marketplace" entegrasyonu
üzerinden). Dokümantasyon açıkça: *"gönderdiğiniz kargo şirketleri, Trendyol
sözleşmenizde onayladığınız kargo firmasından farklı olmamalı"* diyor — yani bu
**kapalı bir liste**, tamamen serbest taşıyıcı seçimi yok.
([Trendyol Kargo Şirketleri Listesi (getProviders)](https://developers.trendyol.com/docs/trendyol-kargo-%C5%9Firketleri-listesi-getproviders))

Bazı ikincil kaynaklar (ör. Kargonomi, Paraşüt) satıcının bu 10 firmadan
biriyle **kendi özel/indirimli anlaşmasını** Trendyol sistemine entegre
edebileceğini de yazıyor — yani "hangi firma" kapalı, ama "o firmayla ne
fiyata anlaştığınız" bir ölçüde satıcıya bağlı olabilir.
([Kargonomi](https://www.kargonomi.com.tr/blog/trendyol-anlasmali-kargo/),
[Paraşüt](https://www.parasut.com/blog/trendyol-kargo-ucretleri))

**Fiyat tablosu güvenilirliği — DÜŞÜK:** Trendyol'un tek/resmi bir kargo
tarife sayfası yok (Amazon'daki gibi). Üç bağımsız blog kaynağından aynı
"2026" tarifesi için çekilen sayılar birbirinden ciddi şekilde farklı
(aynı taşıyıcı, aynı 0-2/1-5 desi aralığı için):

| Kaynak | PTT/TEX 0-2 veya 1-5 desi | Aras | Yurtiçi |
|---|---|---|---|
| [Sentos](https://www.sentos.com.tr/trendyol-kargo-ucretleri-ve-kargo-entegrasyonu/) | TEX 81,95₺ / PTT 83,74₺ | 88,96₺ | 121,75₺ |
| [Dopigo](https://www.dopigo.com/trendyol-kargo-ucretleri/) | PTT/TEX 77,54₺ | 83,93₺ | 112,77₺ |
| [Paraşüt](https://www.parasut.com/blog/trendyol-kargo-ucretleri) | PTT 62,03-80,44₺ / TEX 61,04-81,08₺ | 66,49-91,12₺ | — |

En düşük ve en yüksek rapor edilen PTT rakamı arasında **~%35 fark** var
(62₺ → 84₺). Bu, tek bir kaynağa güvenip sabit bir "Trendyol kargo tablosu"
gömmenin yanıltıcı olacağı anlamına geliyor — projenin genel ilkesiyle
("belirsizliği gizlemek yerine işaretle") tutarlı olarak, uygulamada bu sayı
**hardcode edilmedi**. Bunun yerine:
- Paylaşılan genel kargo tutarı (Navlungo tablosu) Trendyol için **varsayılan/
  yön gösterici** olarak kullanılıyor (kaba sırayla aynı büyüklük mertebesinde —
  ör. Navlungo'daki PTT 1-2 desi=99₺, yukarıdaki üç kaynağın aralığına yakın).
- Kullanıcı satıcı panelindeki **gerçek** tutarı "Trendyol → Kargo (₺)"
  alanına girebiliyor (opsiyonel override, komisyon override'ıyla aynı desen).

**Kim ödüyor:** Tüm kaynaklar hemfikir — standart modelde kargo tutarı
satıcıya ait ve satış hakedişinden otomatik kesiliyor (bazı kaynaklara göre
50₺ altı siparişlerde Trendyol bir kısmını karşılıyor, 50₺ üzerinde tamamı
satıcıya ait).

## Amazon.com.tr

**Kaynak:** satis.amazon.com.tr/lojistik (resmi satıcı sitesi — mevcut
`amazon-trendyol-shopify-komisyonlar.md`'de de "resmi kaynak" olarak
kullanılıyor). Üç gönderim seçeneği var:

1. **Amazon Lojistik (FBA):** Amazon depolar/paketler/teslim eder — bu
   hesaplayıcının kapsamında YOK (tamamen farklı bir ücret yapısı: depolama +
   sevkiyat ücretleri).
2. **Amazon Kolay Gönderi:** Amazon'un anlaşmalı taşıyıcıları (MNG, Kolay
   Gelsin vb.) depodan alıp teslim ediyor; **satıcı taşıyıcıyı seçemiyor**,
   Amazon otomatik atıyor. Bu da kapsam dışı.
3. **Satıcıdan Gönderim (kendi kargonuz):** *"Evet, mümkündür"* — satıcı
   kendi lojistik/kargo firmasını serbestçe seçip yönetiyor. Amazon
   *"zorunlu bir seçim dayatmamakta"*.

Bu hesaplayıcının Amazon kargo tutarı **seçenek 3'ü (satıcıdan gönderim)**
varsayıyor — o senaryoda genel piyasa kargo tablosu doğrudan geçerli.
Kolay Gönderi/FBA kullanan satıcılar için bu rakam geçerli değildir; uygulama
içinde bu artık açıkça not ediliyor.

## Shopify

Shopify bir mağaza altyapısı, pazaryeri değil — kargo firması seçiminde HİÇBİR
kısıtlama yok. Bunu tek bir resmi sayfa yerine dolaylı olarak doğruladık:
"Shopify kargo entegrasyonu" araması, onlarca üçüncü parti uygulamanın
(Kargo Entegratör, Sentos, Zeisoft vb.) Shopify'ı **herhangi bir** Türk kargo
firmasına (Yurtiçi, MNG, PTT, Sürat, Aras...) bağladığını gösteriyor — bu
ekosistemin varlığı, platformun taşıyıcı seçimini kısıtlamadığının pratik
kanıtı. Değişiklik gerekmedi.

## Etsy

**Bu, bulunan en önemli boşluktu.** Etsy satıcıları taşıyıcıyı serbestçe
seçiyor (PTT, DHL, UPS, FedEx, TNT, Navlungo gibi uluslararası kargo
aracıları) — ama asıl mesele bu değil: **gönderiler neredeyse tamamen yurt
dışına** gidiyor (esas olarak ABD/AB alıcılarına).
([Navlungo Etsy Kargo Rehberi](https://navlungo.com/blog/etsy-saticilari-icin-kargo-rehberi),
[Roketfy](https://roketfy.com/tr/blog/etsy-saticilari-icin-kargo-rehberi/))

Bu, mevcut `navlungo-kargo-fiyatlari.md` tablosunun (yurt İÇİ, desi bazlı,
PTT/HepsiJET/Sürat/Kolay Gelsin/Yurtiçi) Etsy için **kavramsal olarak yanlış
maliyet sınıfı** olduğu anlamına geliyor — uluslararası kargo çok daha
pahalı ve farklı bir mantıkla fiyatlanıyor (hedef ülke + ağırlık + taşıyıcıya
göre). Örnek: KargomKolay'ın ABD'ye Etsy kargosu için reklam ettiği başlangıç
fiyatı **5,95€'dan** (≈328₺, bugünkü kurla) — bu bile en HAFİF paket için,
ve yurt içi tablodaki en ucuz 0-1 desi rakamının (99₺) 3 katından fazla.
([KargomKolay Etsy Kargo](https://www.kargomkolay.com/etsy-kargo/))

Tek bir güvenilir "ortalama uluslararası kargo ücreti" **bulunamadı** —
hiçbir kaynak kg/desi başına net bir tarife tablosu vermiyor, hepsi "hedef
ülkeye ve ağırlığa göre değişir, hesaplama panelini kullanın" diyor. Hatta
rakip bir Türk "Etsy Kâr Hesaplama Aracı" (olaybuiste.com) bile kargo için
**hiçbir varsayılan/sabit tahmin kullanmıyor** — satıcının hem alıcıdan
tahsil ettiği hem kendi cebinden çıkan tutarı elle girmesini istiyor, tam
olarak aynı gerekçeyle (tek sayı güvenilir değil).
([olaybuiste.com Etsy Kâr Hesaplama](https://olaybuiste.com/etsy-kar-hesaplama/))

**Karar:** Etsy artık paylaşılan yurt içi kargoTRY alanını HİÇ kullanmıyor.
Kendi ayrı "Kargo — yurt dışı gönderim (₺)" alanı var, varsayılan 0
(Reklam Gideri alanıyla aynı "kullanıcı doldurur" deseni) — bu, sessizce
yanlış bir yurt-içi rakamı kullanmaktan daha dürüst: kullanıcı doldurmazsa
sonuç görünür şekilde eksik kalır (fiyat olduğundan düşük çıkar, ama bunu
not olarak da söylüyoruz), rastgele/optimistik bir sayı ile YANLIŞ kesinlik
izlenimi vermek yerine.

## Kaynaklar

- [Trendyol Kargo Şirketleri Listesi (getProviders) — developers.trendyol.com](https://developers.trendyol.com/docs/trendyol-kargo-%C5%9Firketleri-listesi-getproviders)
- [Trendyol'da Kendi Kargo Anlaşması Kullanımı — Kargonomi](https://www.kargonomi.com.tr/blog/trendyol-anlasmali-kargo/)
- [Trendyol Kargo Ücretleri 2026 — Sentos](https://www.sentos.com.tr/trendyol-kargo-ucretleri-ve-kargo-entegrasyonu/)
- [Trendyol Kargo Ücretleri 2026 — Dopigo](https://www.dopigo.com/trendyol-kargo-ucretleri/)
- [Trendyol'un 2026 yılındaki kargo ücretleri nasıl? — Paraşüt](https://www.parasut.com/blog/trendyol-kargo-ucretleri)
- [Amazon Lojistik Hizmetleri — satis.amazon.com.tr](https://satis.amazon.com.tr/lojistik)
- [Amazon Kolay Gönderi — satis.amazon.com.tr](https://satis.amazon.com.tr/lojistik/kolay-gonderi)
- [Etsy Satıcıları için Kargo Rehberi — Navlungo](https://navlungo.com/blog/etsy-saticilari-icin-kargo-rehberi)
- [Etsy Satıcıları İçin Kargo Rehberi — Roketfy](https://roketfy.com/tr/blog/etsy-saticilari-icin-kargo-rehberi/)
- [Etsy Kargo Fiyatlandırması — KargomKolay](https://www.kargomkolay.com/etsy-kargo/)
- [Etsy Kâr Hesaplama Aracı — olaybuiste.com](https://olaybuiste.com/etsy-kar-hesaplama/)
