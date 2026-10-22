// src/background/service-worker.ts
import { getSupabaseClient, resetSupabaseClient } from './supabase-client';
import { STORAGE_KEYS } from '../shared/constants';
import { ExtensionMessage, MessageResponse } from '../shared/types';
import { redactObjectSecrets } from '../shared/redaction';

console.log('[ContextPack SW] Service Worker initialized.');

// ----------------------------------------------------------------------------
// 1. CHROME ALARMS: Periodic Token Refresh
// ----------------------------------------------------------------------------
chrome.alarms.create('supabase-token-refresh', { periodInMinutes: 30 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'supabase-token-refresh') {
    try {
      const client = await getSupabaseClient();
      if (client) {
        const { data, error } = await client.auth.getSession();
        if (error) {
          console.warn('[ContextPack SW] Token refresh error:', error.message);
        } else if (data.session) {
          console.log('[ContextPack SW] Session refreshed for user:', data.session.user.id);
        }
      }
    } catch (err) {
      console.error('[ContextPack SW] Error during alarm token refresh:', err);
    }
  }
});

// ----------------------------------------------------------------------------
// 2. KEEPALIVE PORT LISTENER
// ----------------------------------------------------------------------------
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sw-keepalive') {
    port.onMessage.addListener((msg) => {
      if (msg.type === 'PING') {
        port.postMessage({ type: 'PONG' });
      }
    });
  }
});

// ----------------------------------------------------------------------------
// 3. MESSAGE DISPATCHER
// ----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    // Only process messages originating from this extension
    if (sender.id !== chrome.runtime.id) {
      return false;
    }

    handleMessage(message)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => {
        console.error('[ContextPack SW] Message handling failed:', err);
        sendResponse({ success: false, error: err.message || 'Bilinmeyen hata' });
      });

    // Return true to keep message channel open for async response
    return true;
  }
);

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'SAVE_CONFIG': {
      const { supabaseUrl, supabaseAnonKey } = message.payload;
      await chrome.storage.local.set({
        [STORAGE_KEYS.SUPABASE_URL]: supabaseUrl.trim(),
        [STORAGE_KEYS.SUPABASE_ANON_KEY]: supabaseAnonKey.trim(),
      });
      resetSupabaseClient();
      return { saved: true };
    }

    case 'GET_CONFIG': {
      const stored = await chrome.storage.local.get([
        STORAGE_KEYS.SUPABASE_URL,
        STORAGE_KEYS.SUPABASE_ANON_KEY,
      ]);
      return {
        supabaseUrl: stored[STORAGE_KEYS.SUPABASE_URL] || '',
        supabaseAnonKey: stored[STORAGE_KEYS.SUPABASE_ANON_KEY] || '',
      };
    }

    case 'GET_AUTH_STATUS': {
      const client = await getSupabaseClient();
      if (!client) {
        return { configured: false, authenticated: false, user: null };
      }
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) {
        return { configured: true, authenticated: false, user: null };
      }
      return {
        configured: true,
        authenticated: true,
        user: {
          id: data.session.user.id,
          email: data.session.user.email,
        },
      };
    }

    case 'SIGN_IN': {
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error('Supabase URL ve Anon Key henüz yapılandırılmamış. Lütfen eklenti popup ayarlarından girin.');
      }
      const { email, password } = message.payload;
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message);
      }
      return { user: data.user, session: data.session };
    }

    case 'SIGN_UP': {
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error('Supabase URL ve Anon Key henüz yapılandırılmamış.');
      }
      const { email, password } = message.payload;
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) {
        throw new Error(error.message);
      }
      return { user: data.user, session: data.session };
    }

    case 'SIGN_OUT': {
      const client = await getSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
      return { signedOut: true };
    }

    case 'SAVE_PACK': {
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error('Supabase yapılandırılmamış. Lütfen popup menüsünden ayarları kaydedin.');
      }

      const { data: authData } = await client.auth.getSession();
      if (!authData.session) {
        throw new Error('Giriş yapılmamış. Lütfen eklenti popup menüsünden giriş yapın.');
      }

      const { platform, externalChatId, title, pack, metadata, expectedVersion } = message.payload;

      // Redact sensitive credentials before sending to Supabase
      const sanitizedPack = redactObjectSecrets(pack);

      // Call stored procedure with OCC
      const { data, error } = await client.rpc('save_context_pack_atomic', {
        p_platform: platform,
        p_external_chat_id: externalChatId,
        p_title: title || 'Başlıksız Sohbet',
        p_pack: sanitizedPack,
        p_metadata: metadata || {},
        p_expected_version: expectedVersion ?? null,
      });

      if (error) {
        throw new Error(`Paket kaydedilemedi: ${error.message}`);
      }

      return data;
    }

    case 'LIST_PACKS': {
      const client = await getSupabaseClient();
      if (!client) {
        return [];
      }

      const { data: authData } = await client.auth.getSession();
      if (!authData.session) {
        return [];
      }

      const { data, error } = await client
        .from('context_packs')
        .select('id, platform, external_chat_id, title, version, updated_at')
        .order('updated_at', { ascending: false })
        .limit(30);

      if (error) {
        throw new Error(`Paketler yüklenemedi: ${error.message}`);
      }

      return data ?? [];
    }

    case 'GET_PACK': {
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error('Supabase yapılandırılmamış.');
      }

      const { data, error } = await client
        .from('context_packs')
        .select('*')
        .eq('id', message.payload.id)
        .single();

      if (error) {
        throw new Error(`Paket detayı getirilemedi: ${error.message}`);
      }

      return data;
    }

    case 'DELETE_PACK': {
      const client = await getSupabaseClient();
      if (!client) {
        throw new Error('Supabase yapılandırılmamış.');
      }

      const { error } = await client
        .from('context_packs')
        .delete()
        .eq('id', message.payload.id);

      if (error) {
        throw new Error(`Paket silinemedi: ${error.message}`);
      }

      return { deleted: true };
    }

    default:
      throw new Error(`Bilinmeyen mesaj tipi: ${(message as { type: string }).type}`);
  }
}
