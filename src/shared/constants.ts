// src/shared/constants.ts

export const STORAGE_KEYS = {
  SUPABASE_URL: 'cp_supabase_url',
  SUPABASE_ANON_KEY: 'cp_supabase_anon_key',
  AUTH_SESSION: 'cp_auth_session',
  LAST_SELECTED_PACK: 'cp_last_pack_id',
} as const;

export const DEFAULT_SUPABASE_CONFIG = {
  url: '',
  anonKey: '',
};

export const PACK_TEMPLATE = `Lütfen bu sohbetteki ilerlememizi ve ulaştığımız teknik bağlamı aşağıdaki JSON şablonunda özetle.
Her bölümü net ve kısa tut. Sadece aşağıdaki JSON yapısını kod bloğu içinde döndür, başka hiçbir giriş/çıkış metni ekleme:

\`\`\`json
{
  "decisions": [
    "Karar 1: ...",
    "Karar 2: ..."
  ],
  "architecture": {
    "overview": "Kısa mimari özet...",
    "components": ["bileşen1", "bileşen2"],
    "patterns": ["kullanılan pattern'ler"]
  },
  "open_questions": [
    "Açık soru veya çözülecek konu 1"
  ],
  "latest_code": [
    {
      "file": "dosya/yolu.ts",
      "description": "Bu dosya ne yapıyor",
      "code": "// Sadece nihai, temiz kod"
    }
  ]
}
\`\`\``;

export const INJECT_HEADER = `📦 Aşağıdaki, başka bir AI sohbetinde ulaştığımız doğrulanmış teknik bağlamdır.
Lütfen bu kararları, mimariyi ve kod durumunu temel alarak sohbete devam et:

`;
