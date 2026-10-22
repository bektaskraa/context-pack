// src/content/adapters/claude.ts
import { IPlatformAdapter, ChatMessage } from './types';
import { queryFirst, queryAll } from '../utils/dom-helpers';
import { injectPromptText } from '../utils/text-injection';

const SELECTORS = {
  input: [
    'div.tiptap.ProseMirror[contenteditable="true"]',
    'div.ProseMirror[contenteditable="true"]',
    'fieldset div[contenteditable="true"][role="textbox"]',
    'fieldset div[contenteditable="true"]',
  ],
  userMessage: [
    '[data-testid="user-message"]',
    'div.font-user-message',
    'div[class*="font-user"]',
  ],
  assistantMessage: [
    'div.font-claude-message',
    'div[class*="font-claude"]',
    'div.standard-markdown',
  ],
  stopButton: [
    'button[aria-label="Stop Response"]',
    'button[aria-label="Stop response"]',
    'button[aria-label*="Stop"]',
  ],
  title: [
    'nav a[aria-current="page"] span',
    'a[href*="/chat/"][class*="active"] span',
  ],
};

export class ClaudeAdapter implements IPlatformAdapter {
  readonly platform = 'claude' as const;

  getChatId(): string | null {
    const match = window.location.pathname.match(/\/chat\/([0-9a-fA-F-]+)/);
    return match ? match[1] : null;
  }

  getTitle(): string {
    const titleEl = queryFirst(SELECTORS.title);
    if (titleEl?.textContent?.trim()) {
      return titleEl.textContent.trim();
    }
    // Clean Claude default title suffix (e.g. "Chat Name \ Claude")
    const docTitle = document.title.replace(/\s*[-–—|•\\/]\s*Claude.*$/i, '').trim();
    return docTitle || 'Claude Sohbeti';
  }

  getMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const userNodes = queryAll(SELECTORS.userMessage);
    const assistantNodes = queryAll(SELECTORS.assistantMessage);

    const turns = [
      ...userNodes.map((el) => ({ role: 'user' as const, el })),
      ...assistantNodes.map((el) => ({ role: 'assistant' as const, el })),
    ].sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    for (const turn of turns) {
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
