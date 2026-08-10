# n11, Shopier ve GittiGidiyor araştırması (10 Ağustos 2026)

Bu dosya, kullanıcının "başka hangi mağazalar var, Shopier veya GittiGidiyor
veya n11, bunları da ekleyebilir miyiz araştırıp?" sorusunun araştırmasını
belgeler. Sonuç: **n11 ve Shopier eklendi, GittiGidiyor araştırılıp
eklenmedi** (aktif bir pazaryeri değil — aşağıya bakın).

## Düzeltme notu — önemli

İlk uygulama turunda n11 ve Shopier için iki noktada **hatalı** varsayım
yapılmıştı. Bu dosya yazılırken (aynı gün, ikinci/taze bir kaynak turunda)
her ikisi de resmi kaynaklarla çapraz kontrol edilirken ortaya çıktı ve
hem `calc.js` hem testler burada düzeltildi:

1. **n11 kargo firması seçimi "serbest" SANILMIŞTI — yanlıştı.** n11'in
   kendi resmi destek merkezi sayfası açıkça satıcının kendi bağımsız kargo
   anlaşmasını *kullanamayacağını*, yalnızca n11'in listelediği firmalar
   arasından seçim yapmasının *zorunlu* olduğunu söylüyor — Trendyol'daki
   kapalı anlaşmalı liste modeliyle aynı durum. Bkz. "n11 — Kargo" bölümü.
2. **Shopier'in komisyonu sabit "%2,99" SANILMIŞTI — yanlıştı.** Shopier'in
   kendi ana sayfası bile "%2,99'dan **başlayan**" diyor; bu, sadece yüksek
   aylık satış hacmine ulaşan satıcılar için geçerli en iyi/taban oran.
   Yeni/düşük hacimli satıcılar için standart oran %4,99 + 0,49₺. Bkz.
   "Shopier — Komisyon oranı" bölümü.

Her iki düzeltme de hesaplayıcının ÜRETTİĞİ FİYATI etkiliyordu (sadece bir
dokümantasyon eksikliği değildi) — n11 kargo maliyeti gerçekte panel
tutarından farklı çıkabiliyordu, Shopier'in komisyonu ise çoğu satıcı için
gerçekte koddaki değerden ~%67 daha yüksekti (4,99 / 2,99 ≈ 1,67). Düzeltme
sonrası her iki alan da diğer platformlardaki override desenine uyduruldu
(`n11KargoOverrideTRY`, `shopierOverridePct`) — panelinizdeki gerçek tutarı
biliyorsanız oraya yazabilirsiniz.

## Özet tablo

| Konu | Bulgu | Uygulamaya etkisi | Güven |
|---|---|---|---|
| n11 komisyon (kategori) | ~8 sektörde %6-23 arası, kısmi kapsam | `SECTORS[].n11` | ORTA — ikincil kaynaklar |
| n11 hizmet bedeli | %1 pazarlama + %0,67 pazaryeri (KDV dahil) | `N11_HIZMET_BEDELI_PCT` | YÜKSEK — resmi kaynak |
| n11 kargo | **KAPALI liste, zorunlu** (düzeltildi) | `n11KargoOverrideTRY` eklendi | YÜKSEK — resmi kaynak |
| n11 stopaj | %1, ayrı bir kesinti | Kasıtlı olarak modellenmedi | YÜKSEK — resmi kaynak |
| Shopier komisyon | **Kademeli**, standart %4,99+0,49₺ (düzeltildi) | `SHOPIER.commissionPct = 4.99` | ORTA — eşikler kaynaklar arası tutarsız |
| Shopier ödeme yöntemi farkı | Tek çekim/taksit/havale farklı oranlı olabilir | Modellenmedi | DÜŞÜK — tek kaynak |
| Shopier kargo | Anlaşmalı kargo opsiyonel | Paylaşılan `kargoTRY` kullanılıyor | YÜKSEK — resmi kaynak |
| GittiGidiyor | Temmuz 2022'de kapandı, eBay'e katıldı | Eklenmedi | YÜKSEK — çoklu haber kaynağı |

## n11 — Komisyon oranları (kategori bazlı)

n11'in Amazon'daki gibi tek/resmi bir kategori-komisyon oran sayfası yok;
oranlar satıcı panelinde kategoriye özel gösteriliyor ve üçüncü parti
entegratör/danışmanlık siteleri bunları derleyip yayınlıyor. İki bağımsız,
2026 tarihli ikincil kaynak karşılaştırıldı:

- [Sentos](https://www.sentos.com.tr/n11-komisyon-oranlari/) (güncelleme 27
  Şubat 2026): Giyim & Moda %20,34-21; Ayakkabı & Çanta %18-19; Aksesuar &
  Takı %20,34-21; Kozmetik & Kişisel Bakım %14-16; Ev & Yaşam %18-23;
  Elektronik %10-20; Otomotiv %10,5-14.
- [Paraşüt](https://www.parasut.com/blog/n11-komisyon-oranlari) (güncelleme
  9 Mart 2026): Ayakkabı & Çanta %18-19; Çocuk Giyim & Aksesuar %20-20,34 —
  aynı aralıkları doğruluyor. Sayfa ayrıca telefon/kozmetik/mobilya gibi bazı
  kategoriler için kendi tablosunun 2024'ten kalma olduğunu itiraf ediyor —
  bu da n11 komisyon verisinin kaynaklar arasında NE KADAR tutarsız/eski
  kalabildiğinin bir göstergesi.

İki kaynak da uygulamadaki mevcut `SECTORS[].n11` rakamlarıyla (ör. giyim
20,34; ayakkabı 18,5; takı 21; kozmetik 16; mutfak 20; mobilya 19) örtüşüyor
— bu yüzden kategori tablosunda değişiklik yapılmadı, sadece doğrulandı.
Kapsamın KASITLI OLARAK KISMİ (yalnızca ~8 sektör) bırakılması kararı da
duruyor: geri kalan kategorilerde ya kaynaklar hiç veri vermiyor ya da
(yukarıdaki Paraşüt örneğinde olduğu gibi) verinin güncelliği şüpheli.
Kapsam dışı kalan her sektörde override alanı her zaman kullanılabilir.

## n11 — Pazarlama + pazaryeri hizmet bedeli (ve stopaj)

n11'in kendi resmi destek merkezi sayfası
([Sıkça Sorulan Sorular #285](https://magazadestek.n11.com/sss/285)) komisyona
EK olarak iki ayrı, tüm kategorilerde sabit oranlı kesinti tanımlıyor:

- **Pazarlama hizmet bedeli:** ürün bedelinin %1 + KDV (Yatırımlık Altın &
  Gümüş kategorisinde istisnai olarak %0,17 + KDV — uygulamanın kapsadığı
  sektörlerin hiçbiri bu kategoride değil, göz ardı edildi).
  **Pazaryeri hizmet bedeli:** sipariş başına %0,67 + KDV. Sayfa açıkça bu
  ikisinin KDV DAHİL olduğunu belirtiyor — koddaki `N11_HIZMET_BEDELI_PCT =
  (1 + 0.67) * 1.20` hesabıyla birebir örtüşüyor. Bu, resmi bir kaynak
  olduğu için YÜKSEK güvenilirlik.

Aynı sayfa ayrıca satıcılardan **%1 oranında stopaj (vergi) kesintisi**
yapıldığını da belirtiyor. Bu bilgi bu turda YENİ bulundu ama **kasıtlı
olarak modellenmedi**: stopaj bir platform gideri değil, satıcının yıl
sonu gelir vergisi borcundan mahsup edilen (düşülen) bir vergi avansı —
komisyon gibi kâr marjını kalıcı olarak azaltmıyor, muhasebe/vergi
danışmanınızın konusu. Bu hesaplayıcı zaten KDV'yi de benzer şekilde bir
"maliyet" olarak saymıyor (bkz. calc.js genel formül notu) — aynı ilke
burada da uygulandı.

## n11 — Kargo (düzeltildi: kapalı liste, zorunlu)

İlk uygulama turunda n11'de kargo firması seçiminin Amazon/Shopify gibi
serbest olduğu varsayılmıştı. Bu YANLIŞTI. n11'in kendi resmi destek
merkezi, konuyla ilgili iki ayrı sayfada bunun tam tersini söylüyor:

- [Sıkça Sorulan Sorular #641](https://magazadestek.n11.com/sss/641):
  *"Satıcı, kendi bağımsız kargo anlaşmasını kullanamaz. Yalnızca n11'in
  listelediği firmalar arasından seçim yapabilir ve bu zorunludur."*
  ("Siparişlerinizi kargo şablonunda yer alan kampanya kodu ile anlaşmalı
  olduğumuz kargo firmaları üzerinden sağlamanız gerekmektedir.")
- [Kargo Süreci](https://magazadestek.n11.com/satis-surecleri/kargo-sureci-141):
  satıcı, teslimat şablonu oluştururken n11'in anlaşmalı kargo firmaları
  (Ceva Lojistik, Horoz Lojistik ve n11'in diğer anlaşmalı firmaları)
  arasından seçim yapıyor — yani seçim VAR ama sadece n11'in kendi listesi
  İÇİNDE.

Bağımsız bir ikincil kaynak ([Dopigo](https://www.dopigo.com/n11-kargo-ucretleri-nedir/))
n11'in anlaşmalı taşıyıcı listesini Aras Kargo, Yurtiçi Kargo, Sürat Kargo,
MNG Kargo, PTT Kargo ve Sendeo Kargo olarak veriyor — bu da resmi kaynakların
tarifiyle örtüşüyor. Sonuç: n11, Trendyol'la AYNI modele giriyor (kapalı
anlaşmalı liste, tek bir genel piyasa fiyatı doğrudan geçerli olmayabilir).
Bu yüzden Trendyol'daki `trendyolKargoOverrideTRY` desenine birebir uyan
`n11KargoOverrideTRY` alanı eklendi — paylaşılan `kargoTRY` yön gösterici
varsayılan olarak kalıyor, panelinizdeki gerçek tutarı bu yeni alana
girebilirsiniz. Güven: YÜKSEK (iki resmi kaynak + bir bağımsız kaynak
örtüşüyor).

## Shopier — Komisyon oranı (düzeltildi: kademeli, sabit değil)

İlk uygulama turunda Shopier'in komisyonunun herkes için sabit %2,99 +
0,49₺ olduğu varsayılmıştı. Bu YANLIŞTI — Shopier'in kendi ana sayfası
([shopier.com](https://shopier.com)) bile şunu yazıyor: *"Bu kesinti,
sipariş tutarı üzerinden %2,99 + 0,49 TL'DEN BAŞLAYAN oranlarda
uygulanır."* "Başlayan" ifadesi, %2,99'un sadece belirli bir aylık satış
hacmine ulaşan satıcılar için geçerli EN İYİ/taban oran olduğunu, herkes
için geçerli sabit bir oran olmadığını gösteriyor.

Üç bağımsız ikincil kaynak bunu doğruluyor, ama tam kademe eşiklerinde
BİRBİRLERİYLE ÇELİŞİYORLAR:

- [ideasoft.com.tr](https://www.ideasoft.com.tr/shopier-komisyon-oranlari/)
  (güncelleme 8 Eylül 2025) tam bir tablo veriyor: 100.000₺/ay ve üzeri
  → %2,99+0,49₺; 50.000-99.999₺ → %3,49+0,49₺; 20.000-49.999₺ →
  %3,99+0,49₺; 5.000-19.999₺ → %4,49+0,49₺; 5.000₺ altı → %4,99+0,49₺.
  Sayfa %4,99'u açıkça *"Standart başlangıç komisyon oranı"* olarak
  adlandırıyor.
- [prismindmedia.com](https://prismindmedia.com/shopier-komisyon-oranlari/)
  (yayın 19 Haziran 2026, güncelleme 22 Haziran 2026 — en güncel kaynak):
  daha basit iki kademeli bir çerçeve veriyor — aylık 15.000₺ altı ciro
  için %4,99, üzeri için %2,99 ("en düşük seviye"). Sabit 0,49₺ ücrete ek
  olarak *"bu tutarların tamamına %20 KDV eklenir"* diyor — bu KDV notu tek
  kaynakta geçiyor, uygulamada modellenmedi (aşağıya bakın).
- [poskomisyon.com](https://poskomisyon.com/shopier-komisyon/) (güncelleme
  20 Nisan 2026): yeni satıcılar için %5,99'dan başlayıp aylık 1,5 milyon₺
  üzerindeki satıcılar için %2,99'a düşen bir kademe tarif ediyor — eşik
  ideasoft'unkinden (100.000₺) ÇOK farklı (1,5 milyon₺). Aynı kaynak ayrıca
  ödeme yöntemine göre de farklı oranlar veriyor: tek çekim kart %2,99+0,49₺,
  taksitli %3,40+0,49₺, havale/EFT %1,90+0,49₺ (en üst kademe için).

Üç kaynak da YÖNÜ aynı (kademeli, taban %2,99 sadece yüksek hacimde) ama
TAM EŞİK DEĞERLERİNDE anlaşmıyor (100 bin₺ mi, 1,5 milyon₺ mi?), üstüne bir
de ödeme yöntemi (tek çekim/taksit/havale) ayrı bir değişken olabilir. Bu
belirsizlik yüzünden tam kademe tablosu VE ödeme-yöntemi ayrımı
MODELLENMEDİ — bunun yerine iki kaynağın (ideasoft, prismindmedia) aynı
rakamla işaret ettiği STANDART/başlangıç oranı (%4,99 + 0,49₺) varsayılan
yapıldı (`SHOPIER.commissionPct = 4.99`). Aylık cironuz yüksekse veya farklı
bir ödeme yöntemi kullanıyorsanız gerçek panel oranınızı
`shopierOverridePct` alanına girin. Aylık üyelik/liste ücreti hiçbir
kaynakta geçmiyor — sadece satış üzerinden kesinti.

**Açık nokta (modellenmedi):** prismindmedia'nın "%20 KDV ayrıca eklenir"
notu diğer iki kaynakta yok ve komisyon yüzdesinin zaten KDV dahil mi
verildiği belirsiz — bu yüzden `SHOPIER.commissionPct` şu an KDV
eklenmeden doğrudan kullanılıyor (Amazon'daki `pct * 1.20` gibi bir çarpan
YOK). Tek kaynaklı ve teyit edilemeyen bir nokta olduğu için değiştirilmedi;
ileride net/resmi bir kaynak bulunursa gözden geçirilmeli.

## Shopier — Kargo

Shopier'in kendi resmi yardım merkezi sayfası
([Anlaşmalı kargo hizmetini nasıl kullanabilirim?](https://help.shopier.com/help/anlasmali-kargo-hizmetini-nasil-kullanabilirim))
anlaşmalı/indirimli kargo hizmetinin avantajlı bir SEÇENEK olarak sunulduğunu,
zorunlu olmadığını gösteriyor — satıcı kargo kodu oluştururken kendi tercih
ettiği taşıyıcıyı seçebiliyor. Bu yüzden paylaşılan genel `kargoTRY` tutarı
Amazon/Shopify gibi doğrudan geçerli kabul edildi, ayrı bir override alanı
eklenmedi. Güven: YÜKSEK (resmi kaynak).

## GittiGidiyor — neden eklenmedi

GittiGidiyor, Türkiye'nin en köklü pazaryerlerinden biriydi (eBay'in 2011'de
satın aldığı platform) ama **2022'de aşamalı olarak kapatıldı** ve aktif bir
pazaryeri değil:

- 20 Haziran 2022: satıcılar yeni ürün listeleyemez hale geldi.
- 18 Temmuz 2022: alım işlemlerinin son tarihi.
- 5 Eylül 2022: kullanıcı hesap sayfalarına erişim tamamen sona erdi.

eBay bu kararı *"pazardaki rekabet dinamikleri incelenerek stratejik
olarak"* aldığını açıkladı; kapanış öncesi GittiGidiyor eBay için Türkiye'de
yaklaşık 4 milyon aktif kullanıcı sağlıyordu. Bu, çoklu ve birbirini
doğrulayan haber kaynağıyla teyit edildi — GÜVEN YÜKSEK:
[Webrazzi](https://webrazzi.com/2022/06/20/gittigidiyor-20-yili-asan-yolculugun-sonuna-geldi/),
[NTV](https://www.ntv.com.tr/ntvpara/ebay-gittigidiyoru-kapatarak-turkiyeden-cekiliyor,9SFIAR8l_kezO-Pom1WaGA),
[Wikipedia](https://tr.wikipedia.org/wiki/GittiGidiyor). Sonuç: platform
2026'da satılabilecek aktif bir kanal değil, bu yüzden hesaplayıcıya
eklenmedi.

## Kaynaklar

- [n11 Komisyon Oranları 2026 — Sentos](https://www.sentos.com.tr/n11-komisyon-oranlari/)
- [N11 Mağaza Komisyon Oranları 2026 — Paraşüt](https://www.parasut.com/blog/n11-komisyon-oranlari)
- [n11 Sıkça Sorulan Sorular #285 (hizmet bedeli, stopaj) — n11 Mağaza Destek Merkezi](https://magazadestek.n11.com/sss/285)
- [n11 Sıkça Sorulan Sorular #641 (kargo firması seçimi) — n11 Mağaza Destek Merkezi](https://magazadestek.n11.com/sss/641)
- [n11 Kargo Süreci — n11 Mağaza Destek Merkezi](https://magazadestek.n11.com/satis-surecleri/kargo-sureci-141)
- [N11 Kargo Ücretleri 2026 — Dopigo](https://www.dopigo.com/n11-kargo-ucretleri-nedir/)
- [Shopier — resmi ana sayfa](https://shopier.com)
- [Shopier Komisyon Oranları Güncellendi (2026) — ideasoft](https://www.ideasoft.com.tr/shopier-komisyon-oranlari/)
- [Shopier Komisyon Oranları, Kesintiler ve Kargo Ücretleri (2026) — prismindmedia](https://prismindmedia.com/shopier-komisyon-oranlari/)
- [Shopier Komisyon Hesaplama ve Oranları 2026 — poskomisyon](https://poskomisyon.com/shopier-komisyon/)
- [Anlaşmalı kargo hizmetini nasıl kullanabilirim? — Shopier Yardım Merkezi](https://help.shopier.com/help/anlasmali-kargo-hizmetini-nasil-kullanabilirim)
- [GittiGidiyor — Vikipedi](https://tr.wikipedia.org/wiki/GittiGidiyor)
- [eBay GittiGidiyor'u kapatarak Türkiye'den çekiliyor — NTV](https://www.ntv.com.tr/ntvpara/ebay-gittigidiyoru-kapatarak-turkiyeden-cekiliyor,9SFIAR8l_kezO-Pom1WaGA)
- [GittiGidiyor kapanıyor, 20 yılı aşan yolculuğun sonuna geldi — Webrazzi](https://webrazzi.com/2022/06/20/gittigidiyor-20-yili-asan-yolculugun-sonuna-geldi/)
