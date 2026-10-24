// src/background/supabase-client.ts
import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js';
import { STORAGE_KEYS } from '../shared/constants';

const chromeStorageAdapter: SupportedStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const result = await chrome.storage.local.get(key);
      const val = result[key];
      return typeof val === 'string' ? val : null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (e) {
      console.error('[StorageAdapter] setItem error:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await chrome.storage.local.remove(key);
    } catch (e) {
      console.error('[StorageAdapter] removeItem error:', e);
    }
  },
};

let cachedClient: SupabaseClient | null = null;
let currentConfig = { url: '', anonKey: '' };

export function sanitizeSupabaseUrl(inputUrl: string): string {
  let cleaned = inputUrl.trim().replace(/^["']|["']$/g, '');
  const dashboardMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned.replace(/\/+$/, '');
}

export function sanitizeSupabaseKey(inputKey: string): string {
  return inputKey.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
}

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.SUPABASE_URL,
    STORAGE_KEYS.SUPABASE_ANON_KEY,
  ]);

  const rawUrl = stored[STORAGE_KEYS.SUPABASE_URL];
  const rawKey = stored[STORAGE_KEYS.SUPABASE_ANON_KEY];
  const url = sanitizeSupabaseUrl(typeof rawUrl === 'string' ? rawUrl : '');
  const anonKey = sanitizeSupabaseKey(typeof rawKey === 'string' ? rawKey : '');

  if (!url || !anonKey) {
    return null;
  }

  // Reuse instance if config hasn't changed
  if (cachedClient && currentConfig.url === url && currentConfig.anonKey === anonKey) {
    return cachedClient;
  }

  currentConfig = { url, anonKey };
  cachedClient = createClient(url, anonKey, {
    auth: {
      storage: chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}

export function resetSupabaseClient(): void {
  cachedClient = null;
  currentConfig = { url: '', anonKey: '' };
}
