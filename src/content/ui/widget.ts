// src/content/ui/widget.ts
import { IPlatformAdapter } from '../adapters/types';
import { PACK_TEMPLATE } from '../../shared/constants';
import { ContextPackData, ContextPackSummary } from '../../shared/types';
import { showPackSelectionModal } from './modal';

const WIDGET_HOST_ID = 'context-pack-widget-host';

export class ContextPackWidget {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private adapter: IPlatformAdapter;
  private isAwaitingSummary = false;

  constructor(adapter: IPlatformAdapter) {
    this.adapter = adapter;
  }

  public mount(): void {
    if (document.getElementById(WIDGET_HOST_ID)) {
      return;
    }

    this.host = document.createElement('div');
    this.host.id = WIDGET_HOST_ID;
    this.host.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      pointer-events: none;
    `;

    document.documentElement.appendChild(this.host);
    this.shadow = this.host.attachShadow({ mode: 'open' });

    this.render();
    this.bindEvents();
    this.setupKeepAlive();
  }

  private render(): void {
    if (!this.shadow) return;

    this.shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 13px;
          color: #1f2937;
        }

        .cp-bar {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(229, 231, 235, 0.9);
          padding: 6px 8px;
          border-radius: 30px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
        }

        .cp-bar:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px -5px rgba(0, 0, 0, 0.14), 0 10px 10px -5px rgba(0, 0, 0, 0.08);
        }

        .cp-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: none;
          outline: none;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          white-space: nowrap;
        }

        .cp-btn:hover {
          filter: brightness(1.08);
          transform: translateY(-0.5px);
        }

        .cp-btn:active {
          transform: scale(0.97);
        }

        .cp-btn-pack {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: #ffffff;
        }

        .cp-btn-save {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          color: #ffffff;
          display: none;
        }

        .cp-btn-save.visible {
          display: inline-flex;
          animation: cp-pop 0.25s ease-out;
        }

        .cp-btn-load {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .cp-btn-load:hover {
          background: #e5e7eb;
        }

        .cp-toast {
          position: fixed;
          bottom: 74px;
          right: 24px;
          pointer-events: auto;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          color: #fff;
          opacity: 0;
          transform: translateY(8px);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2147483647;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .cp-toast.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .cp-toast.success { background: #059669; }
        .cp-toast.error { background: #dc2626; }
        .cp-toast.warning { background: #d97706; }

        @keyframes cp-pop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        /* Modal Styles */
        .cp-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          z-index: 2147483647;
          animation: cp-fade 0.15s ease-out;
        }

        .cp-modal {
          background: #ffffff;
          width: 90%;
          max-width: 540px;
          max-height: 80vh;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: cp-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cp-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .cp-modal-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .cp-count {
          color: #64748b;
          font-weight: 500;
          font-size: 13px;
        }

        .cp-close-btn {
          background: none;
          border: none;
          font-size: 22px;
          color: #94a3b8;
          cursor: pointer;
          line-height: 1;
        }

        .cp-close-btn:hover { color: #0f172a; }

        .cp-modal-body {
          padding: 16px 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cp-search-input {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 12px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          outline: none;
          font-size: 13px;
          transition: border-color 0.15s;
        }

        .cp-search-input:focus {
          border-color: #6366f1;
        }

        .cp-pack-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 50vh;
          overflow-y: auto;
        }

        .cp-pack-card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: background 0.15s, border-color 0.15s;
        }

        .cp-pack-card:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .cp-pack-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .cp-pack-title {
          font-weight: 600;
          color: #1e293b;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cp-badge {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          color: #ffffff;
          padding: 2px 7px;
          border-radius: 12px;
          letter-spacing: 0.5px;
        }

        .cp-pack-meta {
          font-size: 11px;
          color: #64748b;
        }

        .cp-pack-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .cp-btn-inject {
          background: #4f46e5;
          color: #fff;
          border: none;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .cp-btn-inject:hover { background: #4338ca; }

        .cp-btn-copy {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .cp-btn-copy:hover { background: #e2e8f0; }

        .cp-empty {
          text-align: center;
          color: #64748b;
          padding: 30px 10px;
          line-height: 1.5;
        }

        @keyframes cp-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes cp-scale {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      </style>

      <div class="cp-bar">
        <button class="cp-btn cp-btn-pack" id="cp-btn-pack" title="Özetleme şablonunu prompt kutusuna yazar">
          📦 Paketle
        </button>
        <button class="cp-btn cp-btn-save" id="cp-btn-save" title="Modelin ürettiği özeti Supabase'e kaydeder">
          💾 Kaydet
        </button>
        <button class="cp-btn cp-btn-load" id="cp-btn-load" title="Başka modellerden kaydedilmiş bağlamları yükler">
          📥 Context Yükle
        </button>
      </div>

      <div class="cp-toast" id="cp-toast"></div>
    `;
  }

  private bindEvents(): void {
    if (!this.shadow) return;

    const packBtn = this.shadow.getElementById('cp-btn-pack');
    const saveBtn = this.shadow.getElementById('cp-btn-save');
    const loadBtn = this.shadow.getElementById('cp-btn-load');

    packBtn?.addEventListener('click', () => this.handlePack());
    saveBtn?.addEventListener('click', () => this.handleSave());
    loadBtn?.addEventListener('click', () => this.handleLoad());
  }

  private handlePack(): void {
    const input = this.adapter.getInputBox();
    if (!input) {
      // Konsola debug bilgisi yaz
      console.warn('[ContextPack] Input box not found. Debugging selectors...');
      if ('debugSelectors' in this.adapter && typeof (this.adapter as any).debugSelectors === 'function') {
        (this.adapter as any).debugSelectors();
      }
      const allEditables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
      const allTextareas = Array.from(document.querySelectorAll('textarea'));
      console.warn('[ContextPack] contenteditable elements:', allEditables);
      console.warn('[ContextPack] textarea elements:', allTextareas);

      this.toast('⚠️ Prompt kutusu bulunamadı. Sayfanın tam yüklenip yüklenmediğini kontrol edin.', 'error');
      return;
    }

    const success = this.adapter.insertText(PACK_TEMPLATE);
    if (success) {
      this.isAwaitingSummary = true;
      this.showSaveButton(true);
      this.toast('📝 Şablon yazıldı! Gönderin ve yanıt bitince 💾 Kaydet\'e basın.', 'warning');
    } else {
      this.toast('Şablon yazılamadı.', 'error');
    }
  }

  private async handleSave(): Promise<void> {
    const saveBtn = this.shadow?.getElementById('cp-btn-save') as HTMLButtonElement | null;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerText = '⏳ Kaydediliyor...';
    }

    try {
      if (this.adapter.isStreaming()) {
        this.toast('Model henüz yanıt yazıyor, lütfen bitmesini bekleyin.', 'warning');
        return;
      }

      const lastResponse = this.adapter.getLastAssistantMessage();
      if (!lastResponse) {
        this.toast('Asistan yanıtı bulunamadı.', 'error');
        return;
      }

      const parsedPack = this.extractPackJson(lastResponse);
      const chatId = this.adapter.getChatId() || 'chat-' + Date.now();
      const title = this.adapter.getTitle() || 'Başlıksız Sohbet';

      const response: any = await chrome.runtime.sendMessage({
        type: 'SAVE_PACK',
        payload: {
          platform: this.adapter.platform,
          externalChatId: chatId,
          title: title,
          pack: parsedPack,
          metadata: {
            extractedAt: new Date().toISOString(),
            url: window.location.href,
          },
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'Bilinmeyen hata');
      }

      this.toast('✅ Context Pack başarıyla Supabase\'e kaydedildi!', 'success');
      this.showSaveButton(false);
      this.isAwaitingSummary = false;
    } catch (err: any) {
      console.error('[ContextPack] Save failed:', err);
      this.toast(`Kaydetme hatası: ${err.message}`, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerText = '💾 Kaydet';
      }
    }
  }

  private async handleLoad(): Promise<void> {
    try {
      const response: any = await chrome.runtime.sendMessage({ type: 'LIST_PACKS' });
      if (!response.success) {
        throw new Error(response.error || 'Paketler yüklenemedi');
      }

      const packs: ContextPackSummary[] = response.data || [];
      if (this.shadow) {
        showPackSelectionModal(this.shadow, packs, this.adapter, (msg, type) => {
          this.toast(msg, type);
        });
      }
    } catch (err: any) {
      this.toast(`Hata: ${err.message}`, 'error');
    }
  }

  private extractPackJson(rawText: string): ContextPackData {
    // 1. Try finding fenced json code block ```json ... ```
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const candidate = match ? match[1] : rawText;

    try {
      // Find start and end of outer curly braces
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = candidate.substring(start, end + 1);
        const parsed = JSON.parse(jsonStr);
        return {
          decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
          architecture: typeof parsed.architecture === 'object' && parsed.architecture ? parsed.architecture : {},
          open_questions: Array.isArray(parsed.open_questions) ? parsed.open_questions : [],
          latest_code: Array.isArray(parsed.latest_code) ? parsed.latest_code : [],
        };
      }
    } catch {
      // Fallback
    }

    // Fallback if model didn't return valid JSON
    return {
      decisions: [rawText.substring(0, 300) + '...'],
      architecture: { overview: 'Özet JSON ayrıştırılamadı, ham metin kaydedildi.' },
      open_questions: [],
      latest_code: [],
      raw_content: rawText,
    };
  }

  private showSaveButton(visible: boolean): void {
    const saveBtn = this.shadow?.getElementById('cp-btn-save');
    if (saveBtn) {
      if (visible) {
        saveBtn.classList.add('visible');
      } else {
        saveBtn.classList.remove('visible');
      }
    }
  }

  public toast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    if (!this.shadow) return;
    const toastEl = this.shadow.getElementById('cp-toast');
    if (!toastEl) return;

    toastEl.textContent = message;
    toastEl.className = `cp-toast ${type} visible`;

    setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 4000);
  }

  private setupKeepAlive(): void {
    try {
      const port = chrome.runtime.connect({ name: 'sw-keepalive' });
      setInterval(() => {
        try {
          port.postMessage({ type: 'PING' });
        } catch {
          // ignore
        }
      }, 25000);
    } catch {
      // ignore
    }
  }
}
