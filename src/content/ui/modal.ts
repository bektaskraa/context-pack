// src/content/ui/modal.ts
import { ContextPackSummary, ContextPackData } from '../../shared/types';
import { INJECT_HEADER } from '../../shared/constants';
import { copyToClipboard } from '../utils/text-injection';
import { IPlatformAdapter } from '../adapters/types';

export function formatPackToMarkdown(pack: ContextPackData): string {
  const parts: string[] = [];

  if (Array.isArray(pack.decisions) && pack.decisions.length > 0) {
    parts.push('### 🎯 Alınan Teknik Kararlar\n' + pack.decisions.map((d) => `- ${d}`).join('\n'));
  }

  if (pack.architecture && typeof pack.architecture === 'object') {
    const arch = pack.architecture;
    const archLines: string[] = [];
    if (arch.overview) archLines.push(`**Genel Bakış:** ${arch.overview}`);
    if (Array.isArray(arch.components) && arch.components.length > 0) {
      archLines.push(`**Bileşenler:** ${arch.components.join(', ')}`);
    }
    if (Array.isArray(arch.patterns) && arch.patterns.length > 0) {
      archLines.push(`**Mimarî Kalıplar:** ${arch.patterns.join(', ')}`);
    }
    if (archLines.length > 0) {
      parts.push('### 🏗️ Sistem Mimarisi\n' + archLines.join('\n'));
    }
  }

  if (Array.isArray(pack.open_questions) && pack.open_questions.length > 0) {
    parts.push('### ❓ Açık Sorular ve Bekleyen Maddeler\n' + pack.open_questions.map((q) => `- ${q}`).join('\n'));
  }

  if (Array.isArray(pack.latest_code) && pack.latest_code.length > 0) {
    parts.push('### 💻 Güncel Kod Durumu');
    for (const item of pack.latest_code) {
      const lang = item.language || '';
      parts.push(`#### ${item.file}\n*${item.description}*\n\`\`\`${lang}\n${item.code}\n\`\`\``);
    }
  }

  return parts.join('\n\n');
}

export function showPackSelectionModal(
  shadowRoot: ShadowRoot,
  packs: ContextPackSummary[],
  adapter: IPlatformAdapter,
  onNotify: (msg: string, type: 'success' | 'error' | 'warning') => void
): void {
  // Remove existing modal if any
  const existingModal = shadowRoot.getElementById('cp-modal-overlay');
  if (existingModal) existingModal.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cp-modal-overlay';
  overlay.className = 'cp-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'cp-modal';

  const platformBadgeColor: Record<string, string> = {
    claude: '#d97706',
    chatgpt: '#10b981',
    gemini: '#3b82f6',
  };

  const listItems = packs.length === 0
    ? `<div class="cp-empty">Kayıtlı bağlam paketi bulunamadı.<br/><small>Önce bir sohbette "📦 Paketle" ve "💾 Kaydet" yapın.</small></div>`
    : packs.map((p) => {
        const dateStr = new Date(p.updated_at).toLocaleDateString('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        const badgeColor = platformBadgeColor[p.platform] || '#6b7280';
        return `
          <div class="cp-pack-card" data-id="${p.id}">
            <div class="cp-pack-header">
              <span class="cp-pack-title">${escapeHtml(p.title)}</span>
              <span class="cp-badge" style="background-color: ${badgeColor};">${p.platform}</span>
            </div>
            <div class="cp-pack-meta">
              <span>v${p.version}</span> • <span>${dateStr}</span>
            </div>
            <div class="cp-pack-actions">
              <button class="cp-btn-inject" data-action="inject" data-id="${p.id}">📥 Prompt'a Aktar</button>
              <button class="cp-btn-copy" data-action="copy" data-id="${p.id}">📋 Kopyala</button>
            </div>
          </div>
        `;
      }).join('');

  modal.innerHTML = `
    <div class="cp-modal-header">
      <div class="cp-modal-title">
        <span>📦 Context Pack Kütüphanesi</span>
        <span class="cp-count">(${packs.length})</span>
      </div>
      <button class="cp-close-btn" id="cp-modal-close">&times;</button>
    </div>
    <div class="cp-modal-body">
      <input type="text" class="cp-search-input" id="cp-modal-search" placeholder="Paketlerde ara..." />
      <div class="cp-pack-list" id="cp-pack-list">
        ${listItems}
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  shadowRoot.appendChild(overlay);

  // Close actions
  const close = () => overlay.remove();
  modal.querySelector('#cp-modal-close')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Search filter
  const searchInput = modal.querySelector('#cp-modal-search') as HTMLInputElement | null;
  searchInput?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value.toLowerCase();
    const cards = modal.querySelectorAll('.cp-pack-card');
    cards.forEach((card) => {
      const text = card.textContent?.toLowerCase() || '';
      (card as HTMLElement).style.display = text.includes(val) ? 'flex' : 'none';
    });
  });

  // Button actions (inject & copy)
  modal.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement;
      const action = target.getAttribute('data-action');
      const packId = target.getAttribute('data-id');
      if (!packId) return;

      target.innerText = 'Yükleniyor...';

      try {
        const response: any = await chrome.runtime.sendMessage({
          type: 'GET_PACK',
          payload: { id: packId },
        });

        if (!response.success || !response.data?.pack) {
          throw new Error(response.error || 'Paket içeriği alınamadı');
        }

        const packData: ContextPackData = response.data.pack;
        const formattedMarkdown = formatPackToMarkdown(packData);
        const fullPrompt = INJECT_HEADER + formattedMarkdown;

        if (action === 'inject') {
          const injected = adapter.insertText(fullPrompt);
          if (injected) {
            onNotify('✅ Bağlam prompt kutusuna aktarıldı!', 'success');
            close();
          } else {
            await copyToClipboard(fullPrompt);
            onNotify('⚠️ Kutuya yazılamadı, panoya kopyalandı!', 'warning');
            close();
          }
        } else if (action === 'copy') {
          await copyToClipboard(fullPrompt);
          target.innerText = '✅ Kopyalandı';
          setTimeout(() => (target.innerText = '📋 Kopyala'), 1500);
          onNotify('📋 Bağlam panoya kopyalandı!', 'success');
        }
      } catch (err: any) {
        onNotify(`Hata: ${err.message}`, 'error');
        target.innerText = 'Hata!';
      }
    });
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
