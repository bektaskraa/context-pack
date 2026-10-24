// src/content/adapters/chatgpt.ts
import { IPlatformAdapter, ChatMessage } from './types';
import { queryFirst, queryAll } from '../utils/dom-helpers';
import { injectPromptText } from '../utils/text-injection';

// ChatGPT DOM değişkendir — geniş yedek seçici zinciri kullanılır.
// Seçiciler öncelik sırasına göre denenir.
const SELECTORS = {
  input: [
    // 2024-2026 ProseMirror tabanlı contenteditable (en güncel)
    '#prompt-textarea',
    'div#prompt-textarea[contenteditable="true"]',
    'div[contenteditable="true"][data-testid="textbox"]',
    // ProseMirror genel
    'div.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"].ProseMirror',
    // Eski textarea tabanlı alan
    'textarea[name="prompt-textarea"]',
    'textarea#prompt-textarea',
    // Genel fallback — sayfada yalnızca tek contenteditable input varsa
    'form textarea',
    'form div[contenteditable="true"]',
    // Son çare: sayfadaki herhangi bir contenteditable
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
  ],
  userMessage: [
    '[data-message-author-role="user"]',
    '[data-testid*="user-message"]',
    '.text-message[data-testid*="user"]',
  ],
  assistantMessage: [
    '[data-message-author-role="assistant"]',
    '[data-testid*="assistant"]',
    'div.markdown.prose',
    'div.markdown',
  ],
  stopButton: [
    'button[data-testid="stop-button"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label*="Stop"]',
    'button[title*="Stop"]',
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send message"]',
    'button[aria-label*="Send"]',
  ],
  title: [
    '[data-testid="conversation-title"]',
    'nav li a.active span',
    'nav a[aria-current="page"] span',
    'nav a[aria-current="page"]',
    'h1.text-sm',
  ],
};

export class ChatGPTAdapter implements IPlatformAdapter {
  readonly platform = 'chatgpt' as const;

  getChatId(): string | null {
    // /c/<uuid> veya /g/<gpt>/c/<uuid>
    const match = window.location.pathname.match(/\/c\/([0-9a-fA-F-]+)/);
    return match ? match[1] : null;
  }

  getTitle(): string {
    const titleEl = queryFirst(SELECTORS.title);
    if (titleEl?.textContent?.trim()) {
      return titleEl.textContent.trim();
    }
    const docTitle = document.title.replace(/\s*[-–—|•]\s*ChatGPT.*$/i, '').trim();
    return docTitle || 'ChatGPT Sohbeti';
  }

  getMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Yöntem 1: article[data-testid^="conversation-turn-"] ile yapısal okuma
    const turns = queryAll(['article[data-testid^="conversation-turn-"]']);
    if (turns.length > 0) {
      for (const turn of turns) {
        const userNode = turn.querySelector('[data-message-author-role="user"]');
        const assistantNode = turn.querySelector('[data-message-author-role="assistant"]');

        if (userNode instanceof HTMLElement) {
          const text = userNode.innerText.trim();
          if (text) messages.push({ role: 'user', text });
        } else if (assistantNode instanceof HTMLElement) {
          const text = assistantNode.innerText.trim();
          if (text) messages.push({ role: 'assistant', text });
        }
      }
      if (messages.length > 0) return messages;
    }

    // Yöntem 2: role attribute ile doğrudan sorgula
    const userNodes = queryAll(SELECTORS.userMessage);
    const assistantNodes = queryAll(SELECTORS.assistantMessage);

    const allTurns = [
      ...userNodes.map((el) => ({ role: 'user' as const, el })),
      ...assistantNodes.map((el) => ({ role: 'assistant' as const, el })),
    ].sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    for (const turn of allTurns) {
      const text = (turn.el as HTMLElement).innerText?.trim();
      if (text) messages.push({ role: turn.role, text });
    }

    return messages;
  }

  getLastAssistantMessage(): string | null {
    const assistantNodes = queryAll(SELECTORS.assistantMessage);
    if (assistantNodes.length === 0) return null;
    return (assistantNodes[assistantNodes.length - 1] as HTMLElement).innerText?.trim() || null;
  }

  getInputBox(): HTMLElement | null {
    // Önce standart seçicileri dene
    const found = queryFirst<HTMLElement>(SELECTORS.input);
    if (found) return found;

    // Son çare: ana form alanı içindeki her türlü yazılabilir elemanı bul
    const form = document.querySelector('form');
    if (form) {
      const editable = form.querySelector<HTMLElement>('[contenteditable="true"]');
      if (editable) return editable;
      const textarea = form.querySelector<HTMLElement>('textarea');
      if (textarea) return textarea;
    }

    return null;
  }

  insertText(text: string): boolean {
    const editor = this.getInputBox();
    if (!editor) return false;
    return injectPromptText(editor, text);
  }

  isStreaming(): boolean {
    if (queryFirst(SELECTORS.stopButton) !== null) return true;
    if (document.querySelector('.result-streaming') !== null) return true;
    // Send butonu disabled ise model yazıyor olabilir
    const sendBtn = queryFirst<HTMLButtonElement>(SELECTORS.sendButton);
    if (sendBtn?.disabled) return true;
    return false;
  }

  /** Hata ayıklama için DOM durumunu konsola yazar */
  debugSelectors(): void {
    console.group('[ContextPack] ChatGPT Selector Debug');
    console.log('URL:', window.location.href);
    console.log('Chat ID:', this.getChatId());

    for (const [name, sels] of Object.entries(SELECTORS)) {
      const found = queryFirst(sels as string[]);
      console.log(`${name}:`, found ? found : `❌ NOT FOUND (tried: ${(sels as string[]).join(', ')})`);
    }

    // Sayfadaki tüm contenteditable'ları listele
    const allEditables = Array.from(document.querySelectorAll('[contenteditable]'));
    console.log('All contenteditable elements on page:', allEditables);

    // Sayfadaki tüm textarea'ları listele
    const allTextareas = Array.from(document.querySelectorAll('textarea'));
    console.log('All textareas on page:', allTextareas);

    console.groupEnd();
  }
}
