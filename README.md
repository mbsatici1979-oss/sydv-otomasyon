# SYDV Otomasyon Programı

SYDV Otomasyon Programı, Sosyal Yardımlaşma ve Dayanışma Vakfı iş süreçleri için hazırlanmış yerel çalışan bir web otomasyonudur.

## Kullanılan Teknolojiler

- Node.js
- HTML
- CSS
- JavaScript
- JSON tabanlı yerel veri saklama

React, Next.js, PHP veya harici veritabanı kullanılmamaktadır.

## Hazır Modüller

- Ana giriş ekranı
- Kullanıcı ve yetki yönetimi
- Şifre değiştirme
- Ana menü ve modül seçimi
- Taşıt görev programı
- Yazışma işlemleri
- Aşevi ve personel kayıt modülü
- Doğrudan temin işlemleri
  - İhtiyaç talep listesi
  - Taslak ihale oluşturma ve taslaktan yeni ihale açma
  - Yaklaşık maliyet araştırması
  - Üç firmanın teklifini tek ekranda girme
  - Yaklaşık maliyet hesabı
  - Talep listesi
  - Teklif mektubu
  - Piyasa fiyatı ve maliyet kontrolü
  - İhale onay
  - Damga vergisi
  - Teslim alma tutanağı

## Klasör Yapısı

```text
sydv-otomasyon/
├── apps/
│   ├── dogrudan-temin/
│   ├── modul/
│   ├── tasit/
│   └── yazisma/
├── data/
│   └── .gitkeep
├── index.html
├── server.js
├── PROGRAMI-AC.vbs
├── PROGRAMI-BASLAT.bat
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Kurulum

1. Bilgisayarda Node.js kurulu olmalıdır.
2. Proje klasöründe terminal açılır.
3. Gerekli bağımlılık yoktur; ek kurulum yapılmadan çalışır.

## Çalıştırma

Terminalden:

```bash
npm start
```

veya:

```bash
node server.js
```

Windows üzerinde çift tıklayarak çalıştırmak için:

```text
PROGRAMI-AC.vbs
```

Program varsayılan olarak şu adreste açılır:

```text
http://127.0.0.1:8091
```

## Ortam Değişkenleri

`.env.example` dosyasında örnek değişkenler yer alır. Gerçek `.env` dosyası GitHub'a yüklenmemelidir.

Kullanılabilecek değişkenler:

- `PORT`: Programın çalışacağı yerel port.
- `INITIAL_ADMIN_PASSWORD`: İlk kurulumda oluşturulacak yönetici kullanıcının geçici şifresi.

Not: Program `.env` dosyasını otomatik okumaz. Değişkenler terminal veya sistem ortam değişkeni olarak verilmelidir.

## Veri Saklama

Canlı kayıtlar `data/` klasöründeki JSON dosyalarında tutulur. Bu dosyalar kişisel/kurumsal veri içerebileceği için GitHub'a yüklenmemelidir.

GitHub'a yüklenmemesi gereken dosyalar:

- `data/kullanicilar.json`
- `data/modul-veriler.json`
- `data/tasit-veriler.json`
- `data/yazisma-veriler.json`
- `.env`

## İlk Giriş

Yeni kurulumda varsayılan kullanıcı adı:

```text
yonetici
```

Geçici şifre `INITIAL_ADMIN_PASSWORD` ortam değişkeninden alınır. Bu değişken verilmezse program örnek bir geçici şifre ile ilk kullanıcıyı oluşturur. İlk girişten sonra şifre değiştirilmelidir.

## Repository Adı

Önerilen GitHub repository adı:

```text
sydv-otomasyon
```
