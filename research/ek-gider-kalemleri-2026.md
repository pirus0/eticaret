# Ek gider kalemleri — 2. tur araştırma (10 Ağustos 2026)

Bu dosya, kullanıcının "gider kalemlerinin tümü doğru mu sayılmış, e-ticaretçi
gerçekten böyle mi fiyat belirler" sorusuna cevaben yapılan bağımsız audit'in
bulgularını belgeler. Kapsam: (1) Amazon/Trendyol'un KDV-komisyon tabanı
tartışmasının çözülmesi, (2) daha önce modellenmeyen dört gider kalemi
(Trendyol sabit hizmet bedeli, Shopify dış ödeme sağlayıcı modeli, Etsy para
birimi çevrim ücreti, iade/return maliyeti), (3) Etsy'nin Türkiye düzenleyici
işletim ücretindeki kaynak çelişkisinin çözülmesi.

## 1. Amazon vs. Trendyol: komisyon KDV'li mi KDV'siz mi tabana uygulanıyor? — ÇÖZÜLDÜ

Önceki tur, `amazon-trendyol-shopify-komisyonlar.md` dosyasında şu şekilde
açık bırakılmıştı: *"KDV dahil/hariç çelişkisi çözülmeden Trendyol hesaplama
formülü kesinleştirilmemeli."* Bu tur her iki platform da ayrı ayrı, resmi/
yarı-resmi kaynaklarla doğrulandı.

**Amazon — komisyon KDV'Lİ (brüt) tabana uygulanıyor, üzerine ayrıca KDV eklenir.**
Resmi kaynak (satis.amazon.com.tr/ucretlendirme): toplam satış fiyatı
müşterinin ödediği toplam tutar (kargo+KDV dahil) olarak tanımlanıyor ve
referral fee bu tutar üzerinden hesaplanıp üzerine ayrıca KDV ekleniyor.
Yani `effectivePct = pct * 1.20` ve bu doğrudan brüt satış fiyatına (P)
uygulanıyor — kodda zaten böyle yapılıyordu, DOKUNULMADI.

**Trendyol — komisyon KDV HARİÇ (net) tabana uygulanıyor, komisyon FATURASINA
ayrıca KDV eklenir.** İki bağımsız kaynak aynı mekanizmayı doğruluyor:

> "komisyon, ürünün **KDV hariç** satış fiyatı üzerinden hesaplanır"
> — [Sentos, Trendyol Komisyon Oranları 2026](https://www.sentos.com.tr/trendyol-komisyon-oranlari/)

> "Komisyon, ürünün **KDV hariç satış fiyatı** üzerinden hesaplanır; komisyon
> tutarına ayrıca KDV eklenerek faturalandırılır." Örnek: "Komisyon tutarı:
> 500 × 0,20 = 100 TL / Komisyon + KDV: 100 × 1,20 = **120 TL**"
> — [Faturaport, 2026 Trendyol Kâr Hesaplama Rehberi](https://faturaport.com/blog/on-muhasebe/2026-trendyol-kar-hesaplama-komisyon-kargo-kdv-ve-net-kazanc-rehberi)

**Bu iki mekanizma matematiksel olarak birbirine eşdeğer sonuç veriyor.**
Faturaport örneğini brüt fiyat cinsinden yeniden yazalım: KDV hariç taban
500₺ ise, brüt (müşterinin ödediği) fiyat P = 500 × 1,2 = 600₺. Trendyol'un
yöntemiyle kesilen komisyon: (P/1,2) × %20 × 1,2 = 100 × 1,2 = **120₺**.
Doğrudan brüt fiyata %20 uygulanırsa: P × %20 = 600 × %20 = **120₺**. **Aynı
sonuç** — çünkü `(P/1.2) × pct × 1.2 = P × pct` cebirsel olarak sadeleşiyor.

**Sonuç:** Aracın mevcut formülü — Trendyol için `pct`'yi doğrudan brüt satış
fiyatına uygulamak — halihazırda doğruydu, sadece Amazon'dan FARKLI bir
sözleşme mekanizması üzerinden (net taban + KDV'nin cebirsel olarak
sadeleşmesi) doğru çıkıyordu. Amazon ise doğrudan brüt taban kullandığı için
zaten doğrudan doğruydu. **İki platformda da kod değişikliği gerekmedi.**
Bu, ilk bakışta "Amazon muhtemelen komisyonu iki kez KDV'liyor" şüphesiyle
başlayan bir soruşturmaydı; sonuç negatif çıktı (bug yoktu) ama süreç
belgelendi çünkü kullanıcı açıkça "doğru mu saymışız" diye sordu.

## 2. Trendyol sabit "platform hizmet bedeli" — YENİ MODELLENDİ

Komisyondan tamamen ayrı, sipariş başına sabit bir ücret. Resmi/yarı-resmi
tek kaynak (pazarfiyat.com), 30 Ocak 2026 tarihli:

> "Bugün Kargoda" etiketi tanımlayan ve siparişleri aynı gün taşıma statüsüne
> geçiren satıcılarda: **6,99 TL + KDV**. Etiketi tanımlamayan/aynı gün
> göndermeyen satıcılarda: **10,99 TL + KDV**. İade kargo gönderimlerinde
> uygulanmaz.
> — [Pazar Fiyat, Trendyol Platform Hizmet Bedeli 2026](https://pazarfiyat.com/blog/51-trendyol-platform-hizmet-bedeli-2026)

Kullanıcının 10 Ağustos 2026 tarihli notu ("trendyol sabit hizmet bedeli daha
yüksek şu an 15 lira falandı en son") bu aralığa yakın ama biraz üstünde —
muhtemelen kaynağın 10,99+KDV rakamının (=13,19₺) güncel bir artıştan sonraki
hali ya da satıcı bazında küçük farklar var. Aracın varsayılanı muhafazakâr
üst kademe: `round2(10,99 × 1,20) = 13,19₺`. Kullanıcı panelinde 15₺'ye yakın
bir rakam görüyorsa "Trendyol → Hizmet bedeli" alanına yazarak ezebilir
(diğer tüm override alanlarıyla aynı desen).

**Not (kapsam dışı bırakıldı):** Aynı kaynak, Mikro İhracat siparişlerinde
ayrıca KDV dahil %6 oranında bir "uluslararası hizmet bedeli" olduğunu da
belirtiyor. Bu, dar bir gümrük/ihracat rejimine özgü olduğu ve genel satıcı
kitlesini ilgilendirmediği için bu araca eklenmedi — mikro ihracat yapan
satıcılar bu ek maliyeti kendileri hesaba katmalı.

## 3. Shopify: Shopify Payments Türkiye'de yok — dış ödeme sağlayıcı modeli — YENİ MODELLENDİ

> "Shopify'ın kendi ödeme sistemi olan Shopify Payments, Türkiye'de
> kullanılamıyor." Türkiye'deki satıcılar yerel sağlayıcıları (iyzico, PayTR,
> PayU) kullanmak zorunda.
> — [Workon, Shopify Türkiye Ödeme Çözümleri Rehberi](https://workon.com.tr/blog/shopify-turkiye-odeme-cozumleri/)

Bu, aracın önceki tasarımını (Shopify'ın kendi "online kart oranı"nı — %2,9+
30¢ gibi — doğrudan kullanmak) kavramsal olarak YANLIŞ hale getiriyordu: o
oran sadece Shopify Payments kullanan mağazalar için geçerli, ve Türkiye
merchant'ları hiçbir zaman bu oranı ödemiyor. Bunun yerine iki ayrı ücret
topluyorlar:

1. **Yerel sağlayıcının kendi komisyonu** — sağlayıcıya göre değişir. Workon'a
   göre iyzico "%2,99 + 0,25 TL"den, PayTR "%2,85 + 0,25 TL" civarından
   başlıyor (ciroya göre pazarlığa açık).
2. **Shopify'ın "dış ödeme sağlayıcı" ek ücreti** — plana göre sabit bir
   yüzde, resmi shopify.com/pricing kaynaklı (round-1 araştırmasında zaten
   doğrulanmıştı): Basic %2, Grow %1, Advanced %0,6.

Araç artık her ikisini de ayrı ayrı topluyor (`gatewayPct` + `plan.externalSurchargePct`).
**Varsayılan gateway oranı %2,65** — bu, aracın asıl kullanıcısının kendi dış
ödeme sisteminden ekran görüntüsüyle bildirdiği GERÇEK rakam ("15 Gün Valörlü
Ödeme — Ödemeyi 15 gün sonra alırsınız"). Workon'un genel iyzico/PayTR
tahminlerinden (%2,85-2,99) biraz daha düşük olması, daha uzun bir valör
(ödeme vadesi) karşılığında sağlayıcının daha düşük bir oran vermesiyle
tutarlı — genel bir piyasa tahmini yerine kullanıcının kendi doğrulanmış
rakamı kullanıldı. Farklı bir sağlayıcı/valör kullanan biri için
"Ödeme sağlayıcı komisyonu (%)" alanından değiştirilebilir.

## 4. Etsy: para birimi çevrim ücreti (%2,5) — YENİ MODELLENDİ

Resmi kaynak, doğrudan çekildi:

> "You will be charged a 2.5% currency conversion fee on the sale amount.
> This fee will be subtracted from your sale amount before the funds are
> reflected on your Payment account."
> — [Etsy Help, Currency Conversion Fees](https://help.etsy.com/hc/en-us/articles/360000344668-Currency-Conversion-Fees)

Listeleme para birimi ile ödeme hesabı para birimi farklı olduğunda
uygulanıyor. Bu araç Etsy fiyatlarını USD üzerinden TL'ye çevirdiği için
(bkz. `FX.USD_TRY`) bu ücretin uygulandığı varsayıldı. YÜKSEK güven — tek,
net, resmi bir rakam; kaynaklar arasında çelişki yok.

## 5. Etsy: Türkiye düzenleyici işletim ücreti — ÇELİŞKİ ÇÖZÜLDÜ (%2,27 → %1,67)

Önceki tur bu değeri üç çelişkili kaynak nedeniyle değiştirmeden bırakmıştı
(mevcut kod %2,27; bir çekim %1,67; belirsiz bir "%0,32-1,15" aralığı). Bu
tur, resmi kaynağın kendisi (help.etsy.com'un "What is a Regulatory Operating
Fee" makalesi) doğrudan çekilebildi — önceki oturumda aynı sayfaya erişim
`PROVENANCE_REQUIRED` hatasıyla engellenmişti, bu turda başarılı oldu ve
**ülke bazlı tam bir tablo** döndü:

| Ülke | Oran |
|---|---|
| Kanada | %0,50 |
| Fransa | %1,14 |
| Macaristan | %1,97 |
| İtalya | %0,80 |
| Hindistan | %0,05 |
| İspanya | %0,88 |
| **Türkiye** | **%1,67** |
| Birleşik Krallık | %0,48 |
| Vietnam | %1,24 |

— [Etsy Help, What is a Regulatory Operating Fee](https://help.etsy.com/hc/en-us/articles/1500011073202-What-is-a-Regulatory-Operating-Fee)

Rakip iki kaynak hâlâ farklı rakamlar veriyor ama ikisi de resmi değil ve
kendi aralarında da tutarsız:
- [Synder](https://synder.com/fees-etsy/regulatory-operating-fee/): "ranging
  from 0.32% to 1.15%" — bu aralık, help.etsy.com'un kendi %1,67 rakamıyla
  bile ÇELİŞİYOR (1,67, 0,32-1,15 aralığının dışında) — yani bu kaynağın
  kendisi güncel değil/yanlış görünüyor.
- [Global Fee Calculator](https://globalfeecalculator.com/etsy-fee-turkey/):
  "2.27% of total order... Highest regulatory fee globally" — ama resmi
  tablo Macaristan'ı %1,97 ile daha yüksek gösteriyor, yani bu kaynağın "en
  yüksek küresel oran" iddiası da resmi tabloyla çelişiyor.

**Karar:** Mevcut değer %2,27'den resmi kaynaktaki %1,67'ye düzeltildi.
Gerekçe: (a) doğrudan resmi sayfa, (b) iki bağımsız çekimde aynı sonuç,
(c) rakip kaynaklar hem resmi olmayan hem de kendi aralarında/resmi kaynakla
tutarsız. **Kalan küçük belirsizlik:** sayfa bir otomatik özetleme aracıyla
okundu — ham HTML birebir/manuel teyit edilmedi. Kesinlik için kullanıcının
kendi Etsy satıcı panelinden (Ödemeler → Ücretler) teyit etmesi önerilir.

## 6. İade (return) maliyeti: 1 Ocak 2026 mevzuat değişikliği — YENİ MODELLENDİ

Resmi/yarı-resmi haber kaynağı (Anadolu Ajansı, Ticaret Bakanlığı
açıklamasına dayanarak):

> "Tüketicilerimizin mesafeli olarak kurulan sözleşmelerde cayma hakkını
> kullanmaları halinde iade kargo ücretlerinin satıcı veya sağlayıcı
> tarafından karşılanması şeklindeki uygulamanın korunması yönünde yeniden
> mevzuat değişikliği yapıldı." Yürürlük: **1 Ocak 2026**.
> — [AA, Mesafeli satışlarda iade edilen ürünün kargo ücretini satıcı ödemeye devam edecek](https://www.aa.com.tr/tr/ekonomi/mesafeli-satislarda-iade-edilen-urunun-kargo-ucretini-satici-odemeye-devam-edecek-/3578058)

Aynı haberde ilgili bir detay daha var: cep telefonu, akıllı saat ve
bilgisayar ürünleri artık cayma hakkı istisnalarından çıkarıldı — yani bu
kategoriler de artık iade edilebilir hale geldi (önceden hijyen/mühür gibi
gerekçelerle istisnaydı). Bu, elektronik kategorilerinde iade oranının diğer
kategorilere göre daha da yükselebileceği anlamına gelebilir; ama bu araca
kategoriye özel bir varsayılan iade oranı eklenmedi (bkz. aşağıdaki gerekçe).

**Modelleme kararı:** İade maliyeti "iade oranı% × iade başına maliyet"
şeklinde bir beklenen-değer formülüyle Amazon/Trendyol/Shopify'ın sabit
maliyetine ekleniyor. **Etsy hariç** — Etsy satışları ağırlıkla yurt dışına
gidiyor ve farklı bir tüketici koruma rejimine (alıcının ülkesi) tabi, bu
Türkiye mevzuatı doğrudan uygulanmıyor.

Türkiye e-ticaretinde standart bir "tipik iade oranı" taranan genel
kaynaklarda (ör. sentos.com.tr'nin e-ticaret tavsiye içeriği) bulunamadı —
iade genelde "kârın en büyük düşmanı" gibi niteliksel olarak anlatılıyor,
kategoriye göre çok değişken tek bir yüzde olarak sunulmuyor (giyim/ayakkabı
gibi "denenerek alınan" kategorilerde araştırmalarda %18-%70 arası rakamlar
görüldü). Güvenilir tek bir varsayılan seçmek yerine — projenin "belirsizliği
gizlemek yerine işaretle" ilkesiyle tutarlı olarak — her iki alan da
varsayılan 0 bırakıldı (reklam gideri alanıyla aynı "kullanıcı doldurur"
deseni): doldurulmazsa hesaba hiç girmiyor, kullanıcı kendi geçmiş iade
oranını ve iade başına maliyetini (kargo iki yönlü + yeniden
paketleme/değer kaybı) biliyorsa girebiliyor.

## Kaynaklar

- [Sentos, Trendyol Komisyon Oranları 2026](https://www.sentos.com.tr/trendyol-komisyon-oranlari/)
- [Faturaport, 2026 Trendyol Kâr Hesaplama: Komisyon ve Net Kazanç Rehberi](https://faturaport.com/blog/on-muhasebe/2026-trendyol-kar-hesaplama-komisyon-kargo-kdv-ve-net-kazanc-rehberi)
- [Amazon Satış — Ücretlendirme (resmi)](https://satis.amazon.com.tr/ucretlendirme)
- [Pazar Fiyat, Trendyol Platform Hizmet Bedeli 2026](https://pazarfiyat.com/blog/51-trendyol-platform-hizmet-bedeli-2026)
- [Workon, Shopify Türkiye Ödeme Çözümleri Rehberi (iyzico, PayTR, PayU)](https://workon.com.tr/blog/shopify-turkiye-odeme-cozumleri/)
- [Etsy Help, Currency Conversion Fees (resmi)](https://help.etsy.com/hc/en-us/articles/360000344668-Currency-Conversion-Fees)
- [Etsy Help, What is a Regulatory Operating Fee (resmi)](https://help.etsy.com/hc/en-us/articles/1500011073202-What-is-a-Regulatory-Operating-Fee)
- [Synder, Regulatory Operating Fee: Etsy Fees (çelişkili/düşük güven)](https://synder.com/fees-etsy/regulatory-operating-fee/)
- [Global Fee Calculator, Etsy Fee Calculator Turkey (çelişkili/düşük güven)](https://globalfeecalculator.com/etsy-fee-turkey/)
- [Anadolu Ajansı, Mesafeli satışlarda iade edilen ürünün kargo ücretini satıcı ödemeye devam edecek](https://www.aa.com.tr/tr/ekonomi/mesafeli-satislarda-iade-edilen-urunun-kargo-ucretini-satici-odemeye-devam-edecek-/3578058)
