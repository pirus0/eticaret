# Hepsiburada araştırması (11 Ağustos 2026)

Bu dosya, kullanıcının "programı daha kullanışlı hale getirmek için ne
ekleyebiliriz" sorusuna verdiği önceliklerden biri olan **Hepsiburada desteği**
için yapılan araştırmayı belgeler — Trendyol ve Amazon.com.tr'den sonra
Türkiye'nin üçüncü büyük genel pazaryeri, uygulamada şimdiye kadar hiç yoktu.

## Özet tablo

| Konu | Bulgu | Uygulamaya etkisi | Güven |
|---|---|---|---|
| Komisyon oranları (kategori bazlı) | Resmi PDF'te 70+ alt kategori, uygulamanın 31 sektörüne eşlendi | `SECTORS[].hepsiburada` | YÜKSEK (kaynak) / ORTA (eşleme) — aşağıya bakın |
| Komisyon mekanizması (KDV) | Oran doğrudan satış fiyatına uygulanıyor, ayrıca %20 çarpanı YOK | Trendyol/n11 ile aynı `pct` deseni (Amazon'daki `pct*1.20` DEĞİL) | ORTA-YÜKSEK — aşağıya bakın |
| Sabit hizmet bedeli | Var olduğu belirtiliyor ama somut bir TL/₺ rakamı hiçbir kaynakta yok | Modellenmedi (Trendyol/n11'deki gibi bir sabit ücret alanı EKLENMEDİ) | — (rakam yok, kasıtlı boş) |
| Kargo | Kapalı/yarı-kapalı anlaşmalı liste (11 taşıyıcı), HepsiJET öncelikli ama zorunlu değil | `hepsiburadaKargoOverrideTRY` eklendi (Trendyol/n11 deseni) | YÜKSEK — resmi + ikincil kaynak örtüşüyor |
| Mağaza açılış ücreti | Yok | Zaten modellenmiyor (diğer platformlarda da yok) | YÜKSEK |

## Komisyon oranları — kaynak ve eşleme metodolojisi

Amazon.com.tr'nin aksine Hepsiburada'nın kategori komisyonları için `satis.
hepsiburada.com/ucretlendirme` gibi tek, statik bir resmi sayfa yok — merchant
destek merkezi (`merchant.hepsiburada.com`) JavaScript ile render edildiği için
otomatik olarak okunamadı (içerik boş döndü). Bunun yerine, ikincil bir kaynağın
(Paraşüt) linklediği ve doğrudan Hepsiburada'nın kendi CDN'sinde barındırılan
resmi PDF kullanıldı:

**[Hepsiburada Kategori Bazlı Komisyon Oranları Listesi (resmi PDF)](https://images.hepsiburada.net/mp/mp-cms/1625757354638_kategori-bazli-komisyon-oranlari-listesi.pdf)**
— 70'ten fazla alt kategoriyi ve komisyon oranını listeliyor. Dosya adındaki
zaman damgası ve içerik yapısı, bunun Hepsiburada'nın satıcılara resmi olarak
dağıttığı canlı/güncel bir liste olduğunu gösteriyor (dosyada ayrı bir
"yayın tarihi" yazmıyor). Bu PDF resmi kaynak olduğu için YÜKSEK güven.

**Eşleme sorunu:** Uygulamanın 31 sektörlük taksonomisi, PDF'in 70+ alt
kategorisinden daha KABA (coarse) — ör. Hepsiburada "Cep Telefonu Aksesuarları"nı
tek başına 5 alt dilime ayırırken (%12,5-%23 arası), uygulama bunu tek bir
"Telefon Yedek Parça" sektörüyle temsil ediyor. Bu yüzden aşağıdaki tabloda
HER sektör için hangi PDF satırı/satırlarının kullanıldığı ayrıca not edildi —
birden fazla alt kategori bir sektöre karşılık geldiğinde en temsili/baskın
olanı seçildi, tam örtüşmeyen durumlarda override alanı ÖZELLİKLE önerilir.
Bu, eşlemenin kendisi için (kaynağın güvenilirliği için değil) genel güveni
YÜKSEK'ten ORTA'ya çeken tek etken.

| Sektör (uygulama) | Hepsiburada % | Kullanılan PDF satırı/satırları | Not |
|---|---|---|---|
| Giyim | 18 | Giyim | Doğrudan eşleşme |
| Ayakkabı | 18 | Ayakkabı | Doğrudan eşleşme |
| Çanta, Bavul, Seyahat | 18 | Çanta - Valiz / Çanta - Günlük-Spor | İkisi de 18, doğrudan |
| Takı, Mücevher, Bijuteri | 18 | Altın/Takı/Mücevher | "Altın Yatırım" (%4) ayrı bir hat — o saf külçe/yatırım altını, takı DEĞİL |
| Kol Saati | 18 | Saat/Gözlük | Doğrudan eşleşme |
| Cep Telefonu | 4,5 | Android/iPhone | "İkinci El Telefon" (%7) hariç tutuldu, sıfır ürün varsayıldı |
| Bilgisayar | 7 | Masaüstü/Server | "Taşınabilir Bilgisayar" %6 da yakın — override önerilir |
| Elektronik Aksesuar | 10 | Modem/Network, Bluetooth/HDD/Klavye | Küme %8,5-12 arası, temsili orta değer |
| TV, Ev Eğlence Sistemleri | 6 | LCD/LED/Smart TV | Ev sinema/ses sistemleri PDF'te ayrı ve daha yüksek (%10-12) — override önerilir |
| Beyaz Eşya | 8,5 | Bulaşık/Çamaşır/Buzdolabı | Doğrudan eşleşme |
| Küçük Ev Aletleri | 11 | Süpürge/Ütü, Mutfak Gereçleri | Doğrudan eşleşme |
| Mutfak & Dekorasyon | 18 | Züccaciye — Sofra/Mutfak Gereçleri | Doğrudan eşleşme |
| Mobilya, Ev Tekstili | 18 | Ev Mobilya, Ev Tekstili grubu | Küme geneli 18 (Dekorasyon alt kalemi %22, dışlandı) |
| Bahçe, Elektrikli El Aletleri | 14 | Bahçe Makineleri | Bahçe kümesi %14-20 arası geniş — override önerilir |
| Yapı Market, Banyo | 16 | Banyo Dolap/Aksesuar, Boya Aksesuarları | Küme %15-18, temsili orta değer |
| Kozmetik, Parfüm | 15 | Parfüm, Cilt Bakım/Saç Bakım, Makyaj | Üçü de 15, doğrudan |
| Kişisel Bakım Cihazları | 13 | Elektrikli Kişisel Bakım | Doğrudan eşleşme |
| Sağlık & Kişisel Bakım | 15 | Kişisel Bakım (Ağız/Sağlık/Güzellik) | Doğrudan eşleşme |
| Gıda, Süpermarket | 15 | İçecek/Gıda Ürünleri | PDF'te dilimli değil (Amazon'daki gibi tiered DEĞİL), düz oran |
| Oyuncak & Oyun | 16 | Oyuncak (Tüm Türleri) | Doğrudan eşleşme |
| Kitap | 13 | Kitap (Edebiyat/Akademik) | "Dergi/İthal" (%15) hariç tutuldu |
| Anne & Bebek | 16 | Anne/Bebek Bakım | "Bebek Bezi" (%12,5) ayrı, bakım ürünleri temsili alındı |
| Ofis, Kırtasiye | 15 | Kırtasiye/Sanatsal Malzeme | "Ofis Teknolojileri" (makine/kağıt, %6-12) hariç — override önerilir |
| Spor, Outdoor | 13 | Spor Branşları, Fitness Ekipmanları | Küme %10-14, temsili orta değer |
| Video Oyun Konsolu | 5 | Konsol (Xbox/PS4/PS5/Nintendo) | Doğrudan eşleşme |
| Video Oyunları | 8,5 | Oyunlar (PS5/PS4/Xbox/Nintendo) | Doğrudan eşleşme |
| Otomotiv & Motosiklet | 14 | (küme ortalaması) | PDF'te 14 ayrı oto alt kategorisi (%9-18) var — bu sektörde override ÖZELLİKLE önerilir |
| Evcil Hayvan (Petshop) | 14 | Beslenme (%13) + Aksesuar (%15) ortalaması | Blend |
| Telefon Yedek Parça | 23 | Cep Telefonu Aksesuarları 5 (Batarya/Kılıf) | En yakın eşleşme; tam "yedek parça" hattı yok |
| Dijital Hediye Kartı | *(veri yok)* | — | PDF'te hediye kartına özel bir satır yok, "Dijital Ürünler" genel yazılım/kod kalemi — zorlama yapılmadı |
| Diğer | *(veri yok)* | — | Hepsiburada'da genel bir "diğer" kategorisi yok — satıcı spesifik kategori seçmek ZORUNDA |

Kısacası: 29/31 sektörde bir rakam var, 2'sinde (hediye kartı, diğer) diğer
platformlarda da (Trendyol/n11) sık görülen "veri yok" deseniyle boş bırakıldı
— override alanı her zaman kullanılabilir.

## Komisyon mekanizması — KDV nasıl hesaplanıyor?

Bu, Amazon/Trendyol ayrımına benzer ve dikkatle çözülmesi gereken bir nokta
oldu. Resmi PDF'in HER sayfasının altında aynı dipnot tekrarlanıyor:

> "Tüm komisyonlar listeleme fiyatı üzerinden +KDV olarak hesaplanacaktır."

Bu cümle tek başına iki farklı okumaya açık (Amazon'daki gibi komisyona AYRICA
KDV mi ekleniyor, yoksa oran zaten KDV dahil bir sonuç mu veriyor). Bunu
netleştirmek için [ideasoft.com.tr'nin Hepsiburada komisyon sayfası](https://www.ideasoft.com.tr/hepsiburada-komisyon-oranlari/)
somut bir formül ve örnek veriyor:

> "Hizmet Bedeli (Komisyon) Tutarı = Satış Fiyatı × (Komisyon Oranı / 100)" —
> örnek: 200₺ satış fiyatı, %18 komisyon → 200 × 0,18 = **36₺** (başka bir ek
> adım yok). Sayfa ayrıca "satış fiyatının KDV dahil olmasına dikkat edilmesi
> gerekir" diyor, yani oran DOĞRUDAN KDV dahil satış fiyatına uygulanıyor ve
> sonuç zaten nihai/all-in tutar.

Bu, Trendyol'un mekanizmasıyla (ve nihai olarak n11'inkiyle) aynı sonuca
varıyor: oran doğrudan satış fiyatına (P) uygulanıyor, Amazon'daki gibi ayrı
bir `* 1.20` çarpanı YOK. Uygulamada `KH.SECTORS[].hepsiburada` değeri
Trendyol/n11 ile aynı düz `pct` deseniyle kullanıldı. Güven ORTA-YÜKSEK:
resmi kaynağın dipnotu tek başına belirsizdi ama ikincil kaynağın somut
formül+örneği bu belirsizliği gideriyor; yine de tam resmi bir teyit
(Amazon'un `satis.amazon.com.tr/ucretlendirme` sayfası kadar net) olmadığı
için Amazon kadar YÜKSEK değil.

## Sabit hizmet bedeli — bilinçli olarak eklenmedi

Birden fazla ikincil kaynak ("Hepsiburada, her gönderi için teknolojik altyapı
ve operasyon maliyetlerine karşılık gönderi başına ayrı bir hizmet bedeli ve
işlem bedeli tahsil eder") komisyondan AYRI bir hizmet bedelinin var
OLDUĞUNU söylüyor — Trendyol'un `TRENDYOL_HIZMET_BEDELI_TRY`'siyle aynı
kavram. Ama hiçbir kaynak (resmi PDF dahil) somut bir ₺ rakamı vermiyor.
Trendyol/n11'in aksine burada güvenilir bir varsayılan değer YOK — bu yüzden
Trendyol'daki gibi sabit bir sabit alanı EKLENMEDİ. Gerçek tutarı satıcı
panelinizden görebiliyorsanız, şimdilik reklam gideri alanına dahil edebilir
ya da genel bir sabit maliyet olarak ürün maliyetine ekleyebilirsiniz —
ileride net bir kaynak bulunursa `hepsiburadaHizmetBedeliTRY` olarak ayrı
bir alan eklenebilir.

## Kargo — kapalı/yarı-kapalı anlaşmalı liste

[yengec.co](https://yengec.co/blog/hepsiburada-kargo-ucreti/) ve
[Sentos](https://www.sentos.com.tr/hepsiburada-kargo-ucretleri/) örtüşen
bir tabloda Hepsiburada'nın 11 anlaşmalı taşıyıcıyla (HepsiJET, HepsiJET XL,
Aras Kargo, PTT Kargo, DHL E-commerce, Sürat Kargo, Yurtiçi Kargo, CEVA
Lojistik, Borusan Lojistik, Horoz Lojistik, Kolay Gelsin) çalıştığını
belirtiyor. HepsiJET ZORUNLU değil ama "barem" (indirimli/sabit fiyat)
kampanyalarından yararlanmak için öncelikli taşıyıcılarla (genellikle
HepsiJET, Sürat Kargo) çalışmak gerekiyor — yani Shopier'deki tam serbestlik
YOK, ama tek bir mecburi taşıyıcı da yok; Trendyol/n11'deki "kapalı liste"
modeline en yakın durum bu. Kaynaklar ayrıca 400₺ altı siparişler için
desi-bazlı DEĞİL sabit barem fiyatlandırma (ör. "199,99₺'ye kadar 42₺+KDV")
olduğunu gösteriyor — bu, uygulamanın paylaşılan desi tablosundan (`KH.CARGO`)
yapısal olarak farklı bir model, ve zaten kargo taşıyıcı/desi tabloları bu
turun kapsamı DIŞINDA tutuldu (ayarlar paneli çalışmasında kullanıcının kendi
seçimiyle). Bu yüzden Trendyol/n11 desenine birebir uyan
`hepsiburadaKargoOverrideTRY` eklendi — paylaşılan `kargoTRY` yön gösterici
varsayılan kalıyor, panelinizdeki gerçek tutarı bu alana girebilirsiniz.
Güven: YÜKSEK (iki bağımsız kaynak örtüşüyor, resmi merchant destek
sayfasının başlığı da "Kargo Desteği" olarak aynı yönde ama JS-render
olduğu için içeriği otomatik okunamadı).

## Mağaza açılış ücreti / abonelik

Sentos'un sayfası açıkça belirtiyor: *"Hepsiburada'da mağaza açılışı için
herhangi bir giriş ücreti veya abonelik bedeli talep edilmemektedir."* Diğer
platformlarla (Trendyol, n11, Amazon) tutarlı — zaten modellenmiyor, ek bir
işlem gerekmedi.

## Kaynaklar

- [Hepsiburada Kategori Bazlı Komisyon Oranları Listesi — resmi PDF (images.hepsiburada.net)](https://images.hepsiburada.net/mp/mp-cms/1625757354638_kategori-bazli-komisyon-oranlari-listesi.pdf)
- [Hepsiburada Komisyon Oranları (2026 Güncellendi) & Hesaplama Aracı — ideasoft](https://www.ideasoft.com.tr/hepsiburada-komisyon-oranlari/)
- [Hepsiburada Komisyon Oranları 2026: Güncel Liste — Sentos](https://www.sentos.com.tr/hepsiburada-komisyon-oranlari-ve-magaza-acilis-ucretleri/)
- [Hepsiburada Komisyon Oranları 2026: Güncel Tablo ve Kar Hesaplama — Paraşüt](https://www.parasut.com/blog/hepsiburada-komisyon-oranlari)
- [Hepsiburada Kargo Ücretleri 2026: Güncel Liste — Sentos](https://www.sentos.com.tr/hepsiburada-kargo-ucretleri/)
- [2026 Hepsiburada Kargo Ücreti ve Anlaşmalı Firmalar — yengec.co](https://yengec.co/blog/hepsiburada-kargo-ucreti/)
- [Kargo Desteği — Hepsiburada Merchant Çözüm Merkezi](https://merchant.hepsiburada.com/cozummerkezi/merchant/sikca-sorulan-sorular-detay/4053) (başlık teyit edildi, içerik JS-render olduğu için otomatik okunamadı)

## Açık noktalar / gelecekte gözden geçirilebilir

- Sabit hizmet bedeli rakamı (yukarıya bakın) — resmi bir kaynak bulunursa eklenmeli.
- Otomotiv, Bahçe, Yapı Market, Telefon Yedek Parça sektörlerinde tek bir
  temsili oran, PDF'in gerçek alt kategori sayısına göre kaba bir yaklaşım —
  bu sektörlerde override alanı özellikle önerilir (UI'da da not edildi).
- "Barem" (400₺ altı sabit fiyat) kargo modeli bu turda kasıtlı olarak
  modellenmedi (kargo taşıyıcı tabloları genel kapsam dışı, bkz. ayarlar
  paneli çalışması) — override alanı bunun yerine geçiyor.
