// src/popup/popup.ts
import { ContextPackSummary, ContextPackData } from '../shared/types';
import { formatPackToMarkdown } from '../content/ui/modal';
import { copyToClipboard } from '../content/utils/text-injection';

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await loadConfig();
  await checkAuthStatus();
  await loadPacks();
  bindActions();
});

function setupTabs(): void {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const tabName = target.getAttribute('data-tab');

      tabs.forEach((t) => t.classList.remove('active'));
      target.classList.add('active');

      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
      document.getElementById(`tab-${tabName}`)?.classList.add('active');

      if (tabName === 'packs') {
        loadPacks();
      }
    });
  });
}

async function loadConfig(): Promise<void> {
  try {
    const res: any = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    if (res.success && res.data) {
      const urlInput = document.getElementById('cfg-url') as HTMLInputElement | null;
      const keyInput = document.getElementById('cfg-key') as HTMLInputElement | null;
      if (urlInput) urlInput.value = res.data.supabaseUrl || '';
      if (keyInput) keyInput.value = res.data.supabaseAnonKey || '';
    }
  } catch (err) {
    console.error('Failed to load config:', err);
  }
}

async function checkAuthStatus(): Promise<void> {
  const banner = document.getElementById('auth-banner');
  const bannerText = document.getElementById('auth-status-text');
  const loginForm = document.getElementById('login-form');
  const logoutForm = document.getElementById('logout-form');
  const userEmail = document.getElementById('user-email');

  try {
    const res: any = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });
    if (res.success && res.data?.authenticated) {
      if (banner) {
        banner.className = 'auth-banner auth';
        if (bannerText) bannerText.textContent = `🟢 Giriş yapıldı (${res.data.user.email})`;
      }
      if (loginForm) loginForm.style.display = 'none';
      if (logoutForm) logoutForm.style.display = 'block';
      if (userEmail) userEmail.textContent = res.data.user.email;
    } else {
      if (banner) {
        banner.className = 'auth-banner unauth';
        if (bannerText) {
          bannerText.textContent = res.data?.configured
            ? '🟡 Giriş yapılmadı'
            : '⚠️ Supabase yapılandırılmamış';
        }
      }
      if (loginForm) loginForm.style.display = 'block';
      if (logoutForm) logoutForm.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to check auth status:', err);
  }
}

async function loadPacks(): Promise<void> {
  const container = document.getElementById('packs-container');
  if (!container) return;

  container.innerHTML = '<div class="loading-state">Paketler getiriliyor...</div>';

  try {
    const res: any = await chrome.runtime.sendMessage({ type: 'LIST_PACKS' });
    if (!res.success) {
      container.innerHTML = `<div class="empty-state">${escapeHtml(res.error || 'Hata oluştu')}</div>`;
      return;
    }

    const packs: ContextPackSummary[] = res.data || [];
    if (packs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          Henüz kayıtlı bağlam paketi yok.<br/>
          <small>Claude, ChatGPT veya Gemini'de "📦 Paketle" ve "💾 Kaydet" yapabilirsiniz.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = packs.map((pack) => {
      const dateStr = new Date(pack.updated_at).toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `
        <div class="pack-card" data-id="${pack.id}">
          <div class="pack-card-header">
            <span class="pack-title">${escapeHtml(pack.title)}</span>
            <span class="badge ${pack.platform}">${pack.platform}</span>
          </div>
          <div class="pack-meta">
            <span>v${pack.version}</span> • <span>${dateStr}</span>
          </div>
          <div class="pack-card-actions">
            <button class="btn-icon" data-action="copy" data-id="${pack.id}">📋 Kopyala</button>
            <button class="btn-icon danger" data-action="delete" data-id="${pack.id}">🗑️ Sil</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind card buttons
    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const action = target.getAttribute('data-action');
        const packId = target.getAttribute('data-id');
        if (!packId) return;

        if (action === 'copy') {
          target.innerText = '...';
          const packRes: any = await chrome.runtime.sendMessage({
            type: 'GET_PACK',
            payload: { id: packId },
          });
          if (packRes.success && packRes.data?.pack) {
            const md = formatPackToMarkdown(packRes.data.pack);
            await copyToClipboard(md);
            toast('📋 Bağlam panoya kopyalandı!', 'success');
            target.innerText = '✅';
            setTimeout(() => (target.innerText = '📋 Kopyala'), 1500);
          } else {
            toast('Kopyalama başarısız', 'error');
            target.innerText = 'Hata';
          }
        } else if (action === 'delete') {
          if (confirm('Bu bağlam paketini silmek istediğinize emin misiniz?')) {
            target.innerText = '...';
            const delRes: any = await chrome.runtime.sendMessage({
              type: 'DELETE_PACK',
              payload: { id: packId },
            });
            if (delRes.success) {
              toast('🗑️ Paket silindi', 'success');
              loadPacks();
            } else {
              toast(`Silinemedi: ${delRes.error}`, 'error');
              target.innerText = '🗑️ Sil';
            }
          }
        }
      });
    });
  } catch (err: any) {
    container.innerHTML = `<div class="empty-state">Bağlantı hatası: ${escapeHtml(err.message)}</div>`;
  }
}

function bindActions(): void {
  // Save Config
  document.getElementById('btn-save-config')?.addEventListener('click', async () => {
    const urlInput = document.getElementById('cfg-url') as HTMLInputElement | null;
    const keyInput = document.getElementById('cfg-key') as HTMLInputElement | null;
    let url = urlInput?.value.trim() || '';
    let anonKey = keyInput?.value.trim() || '';

    // Auto fix if user pasted dashboard URL: https://supabase.com/dashboard/project/<ref>
    const dashboardMatch = url.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
    if (dashboardMatch) {
      url = `https://${dashboardMatch[1]}.supabase.co`;
    }
    url = url.replace(/^["']|["']$/g, '').replace(/\/+$/, '');
    anonKey = anonKey.replace(/^["']|["']$/g, '').replace(/\s+/g, '');

    if (urlInput) urlInput.value = url;
    if (keyInput) keyInput.value = anonKey;

    if (!url || !anonKey) {
      toast('Lütfen URL ve Anon Key alanlarını doldurun.', 'warning');
      return;
    }

    if (anonKey.length < 50 && !anonKey.startsWith('sb_')) {
      toast('⚠️ Anon Key çok kısa! (Project Settings > API > anon public anahtarını kopyalayın)', 'warning');
    }

    const res: any = await chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      payload: { supabaseUrl: url, supabaseAnonKey: anonKey },
    });

    if (res.success) {
      toast('✅ Yapılandırma kaydedildi!', 'success');
      await checkAuthStatus();
    } else {
      toast(`Hata: ${res.error}`, 'error');
    }
  });

  // Sign In
  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const emailInput = document.getElementById('auth-email') as HTMLInputElement | null;
    const passInput = document.getElementById('auth-password') as HTMLInputElement | null;
    const email = emailInput?.value.trim() || '';
    const password = passInput?.value.trim() || '';

    if (!email || !password) {
      toast('E-posta ve şifre gereklidir.', 'warning');
      return;
    }

    toast('Giriş yapılıyor...', 'warning');
    const res: any = await chrome.runtime.sendMessage({
      type: 'SIGN_IN',
      payload: { email, password },
    });

    if (res.success) {
      toast('✅ Giriş başarılı!', 'success');
      await checkAuthStatus();
      await loadPacks();
    } else {
      toast(`Giriş başarısız: ${res.error}`, 'error');
    }
  });

  // Sign Up
  document.getElementById('btn-signup')?.addEventListener('click', async () => {
    const emailInput = document.getElementById('auth-email') as HTMLInputElement | null;
    const passInput = document.getElementById('auth-password') as HTMLInputElement | null;
    const email = emailInput?.value.trim() || '';
    const password = passInput?.value.trim() || '';

    if (!email || !password) {
      toast('E-posta ve şifre gereklidir.', 'warning');
      return;
    }

    toast('Kayıt oluşturuluyor...', 'warning');
    const res: any = await chrome.runtime.sendMessage({
      type: 'SIGN_UP',
      payload: { email, password },
    });

    if (res.success) {
      toast('✅ Kayıt başarılı! (E-posta doğrulaması gerekebilir)', 'success');
      await checkAuthStatus();
    } else {
      toast(`Kayıt başarısız: ${res.error}`, 'error');
    }
  });

  // Sign Out
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    const res: any = await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
    if (res.success) {
      toast('Çıkış yapıldı.', 'success');
      await checkAuthStatus();
      await loadPacks();
    }
  });

  // Search filter
  document.getElementById('pack-search')?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value.toLowerCase();
    const cards = document.querySelectorAll('.pack-card');
    cards.forEach((card) => {
      const text = card.textContent?.toLowerCase() || '';
      (card as HTMLElement).style.display = text.includes(val) ? 'flex' : 'none';
    });
  });
}

function toast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
  const el = document.getElementById('popup-toast');
  if (!el) return;
  el.textContent = message;
  el.className = `popup-toast ${type} visible`;
  setTimeout(() => el.classList.remove('visible'), 3000);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
