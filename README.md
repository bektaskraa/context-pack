# Context Pack — Cross-Model AI Context Sync Chrome Extension

Çapraz model AI sohbet bağlamı aktarımı: **Claude (claude.ai)**, **ChatGPT (chatgpt.com)** ve **Gemini (gemini.google.com)** arasında bağlam kaybı olmadan teknik kararları, sistem mimarisini ve kod durumunu tek tıkla senkronize edin.

---

## 🚀 Hızlı Başlangıç

### 1. Supabase Veritabanı Kurulumu
1. [supabase.com](https://supabase.com) üzerinde ücretsiz bir proje oluşturun veya mevcut projenizi açın.
2. Sol menüden **SQL Editor** sekmesine gidin.
3. Proje dizinindeki [`supabase/schema.sql`](supabase/schema.sql) dosyasının içeriğini kopyalayıp SQL Editor'a yapıştırın ve **Run** butonuna basın.
   - Bu şema; `context_packs` (aktif paketler), `context_pack_revisions` (revizyon geçmişi), RLS politikalarını ve atomik OCC upsert fonksiyonunu (`save_context_pack_atomic`) otomatik olarak kurar.
4. **Authentication -> Providers** bölümünden Email sağlayıcısının açık olduğundan emin olun.
5. **Project Settings -> API** bölümünden:
   - `Project URL`
   - `anon public key`  
   bilgilerini kopyalayın.

---

### 2. Eklentiyi Chrome'a Yükleme
1. Projeyi derleyin (zaten `dist/` klasörü hazır durumdadır, değişiklik yaparsanız):
   ```bash
   npm run build
   ```
2. Google Chrome'da `chrome://extensions/` adresine gidin.
3. Sağ üstteki **Geliştirici modu (Developer mode)** anahtarını açın.
4. Sol üstteki **Paketlenmemiş öğe yükle (Load unpacked)** butonuna tıklayın.
5. Dosya seçicide bu projenin `dist/` klasörünü seçin:
   `/Users/bektaskra/.gemini/antigravity/scratch/context-pack-extension/dist`
6. Context Pack eklentisi uzantılar çubuğunuza eklenecektir.

---

### 3. Eklenti Yapılandırması ve Giriş
1. Chrome uzantılar menüsünden **Context Pack** ikonuna tıklayın.
2. **Ayarlar** sekmesine geçin.
3. Supabase `Project URL` ve `Anon Key` değerlerinizi girip **Yapılandırmayı Kaydet**'e tıklayın.
4. Alt kısımdan e-posta ve şifrenizle **Kayıt Ol** veya **Giriş Yap** butonuna tıklayın.
5. Giriş yapıldığında üstteki durum çubuğu `🟢 Giriş yapıldı` şeklinde yeşile dönecektir.

---

### 4. Kullanım Senaryosu

#### Adım 1: Bağlamı Paketleme (Örn: Claude veya ChatGPT'de)
1. Claude.ai, ChatGPT.com veya Gemini.google.com üzerinde teknik bir sohbet açın.
2. Sayfanın sağ alt köşesinde **Context Pack** çubuğu belirecektir.
3. **📦 Paketle** butonuna tıklayın. Eklenti standart teknik özet şablonunu prompt kutusuna yazacaktır.
4. Mesajı gönderin ve modelin özet JSON'u oluşturmasını bekleyin.
5. Modelin yanıtı tamamlandığında beliren yeşil **💾 Kaydet** butonuna basın.
6. Bağlam anında Supabase veritabanınıza kaydedilecektir.

#### Adım 2: Bağlamı Başka Bir Modele Aktarma (Örn: Gemini'de)
1. Diğer AI platformunu açın (örneğin Gemini veya Claude).
2. Sağ alttaki **📥 Context Yükle** butonuna tıklayın (veya `Alt + C` kısayolunu kullanın).
3. Açılan kütüphane penceresinden istediğiniz paketi seçin:
   - **📥 Prompt'a Aktar**: Bağlamı doğrudan aktif prompt giriş kutusuna yazar.
   - **📋 Kopyala**: Bağlamı panoya kopyalar.
4. Artık yeni model, önceki modeldeki tüm kararlara ve kod durumuna sahip olarak çalışmaya hazırdır!

---

## 🛠️ Mimari ve Güvenlik
- **Manifest V3 Uyumlu:** Background Service Worker ve izole Content Script mimarisi.
- **Shadow DOM İzolasyonu:** Sayfa stillerinin widget'ı bozması engellenir.
- **Güvenli Metin Enjeksiyonu:** ProseMirror, TipTap ve Quill için `document.execCommand('insertText')` + `ClipboardEvent` yedek zinciri.
- **İstemci Tarafı Secret Redaction:** API anahtarları (`sk-...`), GitHub token'ları ve AWS kimlik bilgileri veritabanına gönderilmeden önce filtrelenir.
- **Merkezi Auth:** Service Worker üzerinden tekil token yenileme ile oturum çakışmaları engellenir.
