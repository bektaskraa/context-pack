# Context Pack — Cross-Model AI Context Sync Chrome Extension

Claude, ChatGPT ve Gemini arasında AI sohbet bağlamını tek tıkla aktar. Teknik kararlar, mimari ve kod durumu eksiksiz korunur.

---

## 🚀 Kurulum (Kendi Supabase'ini Kullan)

Bu uygulama **"Bring Your Own Supabase"** modeliyle çalışır — herkes GitHub'dan indirip kendi ücretsiz Supabase hesabına bağlayabilir. Veriler tamamen size aittir.

---

### Adım 1: Supabase Projesi Oluştur

1. [supabase.com](https://supabase.com) → **New project** ile ücretsiz proje oluşturun (region: EU West önerilir).
2. Sol menüden **SQL Editor** → **New query** seçin.
3. Bu depodaki [`supabase/schema.sql`](supabase/schema.sql) dosyasının **tüm içeriğini** yapıştırıp **Run** butonuna basın.
   - `Success. No rows returned` yazısı görürseniz tablolar hazır demektir.

#### ⚠️ Mail Doğrulamasını Kapat (Önemli!)

Chrome eklentisinde mail onay linki çalışmaz — tıklayınca `localhost:3000`'e yönlendirir. Bu yüzden kapatın:

1. Sol menüden **Authentication** → **Providers** → **Email**
2. **"Confirm email"** seçeneğini **OFF** konumuna getirin
3. **Save** butonuna basın

Artık kayıt olunca direkt giriş yapılır.

---

### Adım 2: Supabase Bilgilerini Al

**Project Settings** (sol alt ⚙️ simgesi) → **API** sayfasına gidin:

| Alan | Nerede? | Dikkat |
|---|---|---|
| **Project URL** | `https://xxxxx.supabase.co` | "Copy" butonunu kullanın |
| **Anon Key** | `Project API Keys` → `anon public` | ⚠️ `service_role`'ü değil, `anon`'u kopyalayın |

> **İpucu:** Anon Key ~200 karakterdir, `eyJhbGciOi...` ile başlar. Fareyle seçmek yerine **Copy** butonuna basın — aksi hâlde son karakterler kesilebilir.

---

### Adım 3: Eklentiyi Chrome'a Yükle

> `dist/` klasörü önceden derlenmiş olarak depoda yer alır. Değişiklik yapmadıysanız derlemeye gerek yoktur.

1. Chrome'da `chrome://extensions/` sayfasını açın
2. Sağ üstten **Developer mode** anahtarını açın
3. **Load unpacked** butonuna tıklayın
4. Bu deponun **`dist/`** klasörünü seçin

---

### Adım 4: Eklentiyi Yapılandır ve Giriş Yap

1. Chrome toolbar'daki **Context Pack (📦)** simgesine tıklayın
2. **Ayarlar** sekmesine geçin
3. **Supabase Project URL** ve **Anon Key** alanlarını doldurun → **Yapılandırmayı Kaydet**
4. Bir e-posta ve şifre belirleyip **Kayıt Ol** butonuna basın
5. Üstteki banner `🟢 Giriş yapıldı` yazısıyla yeşile dönerse hazırsınız!

---

## 📖 Kullanım

### Bağlamı Paketle (Mevcut Sohbetten)

1. `claude.ai`, `chatgpt.com` veya `gemini.google.com` üzerinde bir sohbet açın
2. Sağ alt köşedeki **📦 Paketle** butonuna basın → özet şablonu prompt kutusuna yazılır
3. Gönder'e basın, modelin JSON özeti oluşturmasını bekleyin
4. Beliren yeşil **💾 Kaydet** butonuna basın → bağlam Supabase'e kaydedilir

### Bağlamı Başka Modele Aktar

1. Başka bir AI sitesini açın (örn. Claude → Gemini)
2. **📥 Context Yükle** butonuna basın (ya da `Alt+C`)
3. Listeden paketi seçip **Prompt'a Aktar** tıklayın → bağlam doğrudan prompt kutusuna yazılır

---

## 🔒 Güvenlik ve Gizlilik

- **RLS (Row Level Security):** Her kullanıcı yalnızca kendi paketlerini görür — veritabanı düzeyinde zorunlu
- **Secret Redaction:** API anahtarları (`sk-...`), GitHub token'ları vb. kaydetmeden önce otomatik filtrelenir
- **Yerel Auth Token:** Oturum bilgisi yalnızca `chrome.storage.local`'da tutulur, hiçbir üçüncü tarafla paylaşılmaz
- **Kendi Supabase'in:** Veriler Supabase projenizde, sizin hesabınızda saklanır

---

## 🛠️ Geliştirme

```bash
npm install        # Bağımlılıkları yükle
npm run build      # dist/ klasörüne derle
npm run typecheck  # TypeScript tip kontrolü
```

**Dosya Yapısı:**

```
src/
├── background/         # Service Worker (auth + Supabase)
├── content/
│   ├── adapters/       # Claude / ChatGPT / Gemini DOM adaptörleri
│   ├── ui/             # Shadow DOM widget ve modal
│   └── utils/          # DOM helpers, metin enjeksiyonu
├── popup/              # Eklenti popup (ayarlar, paket listesi)
└── shared/             # Tipler, sabitler, redaction
supabase/
└── schema.sql          # Tüm tabloları, RLS ve fonksiyonları içerir
```

---

## ✅ Platform Destek Matrisi

| Platform | Chat ID | Input Enjeksiyon | Mesaj Okuma | Streaming Tespiti |
|---|---|---|---|---|
| **Claude** | ✅ | ✅ ProseMirror | ✅ | ✅ |
| **ChatGPT** | ✅ | ✅ Lexical/ProseMirror | ✅ | ✅ |
| **Gemini** | ✅ | ✅ Quill | ✅ | ✅ |
