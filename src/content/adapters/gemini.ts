// src/content/adapters/gemini.ts
import { IPlatformAdapter, ChatMessage } from './types';
import { queryFirst, queryAll } from '../utils/dom-helpers';
import { injectPromptText } from '../utils/text-injection';

const SELECTORS = {
  input: [
    'rich-textarea div[contenteditable="true"]',
    'div.ql-editor[contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]',
    'textarea.textarea',
  ],
  userMessage: [
    'user-query',
    '.user-query-container',
    'user-query-content',
    '.query-text',
  ],
  assistantMessage: [
    'model-response',
    '.model-response-text',
    'message-content',
  ],
  stopButton: [
    'button[aria-label*="Stop"]',
    'button[aria-label="Stop response"]',
  ],
  title: [
    '.conversation-title',
    'span.title-text',
  ],
};

export class GeminiAdapter implements IPlatformAdapter {
  readonly platform = 'gemini' as const;

  getChatId(): string | null {
    const match = window.location.pathname.match(/\/app\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  getTitle(): string {
    const titleEl = queryFirst(SELECTORS.title);
    if (titleEl?.textContent?.trim()) {
      return titleEl.textContent.trim();
    }
    const docTitle = document.title.replace(/\s*[-–—|•]\s*Gemini.*$/i, '').trim();
    return docTitle || 'Gemini Sohbeti';
  }

  getMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
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
      const text = turn.el.innerText?.trim();
      if (text) {
        messages.push({ role: turn.role, text });
      }
    }

    return messages;
  }

  getLastAssistantMessage(): string | null {
    const assistantNodes = queryAll(SELECTORS.assistantMessage);
    if (assistantNodes.length === 0) return null;
    return assistantNodes[assistantNodes.length - 1].innerText?.trim() || null;
  }

  getInputBox(): HTMLElement | null {
    return queryFirst(SELECTORS.input);
  }

  insertText(text: string): boolean {
    const editor = this.getInputBox();
    if (!editor) return false;
    return injectPromptText(editor, text);
  }

  isStreaming(): boolean {
    return queryFirst(SELECTORS.stopButton) !== null;
  }
}
