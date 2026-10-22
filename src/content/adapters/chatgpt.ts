// src/content/adapters/chatgpt.ts
import { IPlatformAdapter, ChatMessage } from './types';
import { queryFirst, queryAll } from '../utils/dom-helpers';
import { injectPromptText } from '../utils/text-injection';

const SELECTORS = {
  input: [
    '#prompt-textarea',
    'div#prompt-textarea[contenteditable="true"]',
    'textarea[name="prompt-textarea"]',
  ],
  userMessage: [
    '[data-message-author-role="user"]',
  ],
  assistantMessage: [
    '[data-message-author-role="assistant"]',
    'div.markdown.prose',
  ],
  stopButton: [
    'button[data-testid="stop-button"]',
    'button[aria-label="Stop generating"]',
    'button[aria-label*="Stop"]',
  ],
  title: [
    'nav li a.active',
    'nav a[aria-current="page"]',
  ],
};

export class ChatGPTAdapter implements IPlatformAdapter {
  readonly platform = 'chatgpt' as const;

  getChatId(): string | null {
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
    const turns = queryAll(['article[data-testid^="conversation-turn-"]']);

    if (turns.length > 0) {
      for (const turn of turns) {
        const userNode = turn.querySelector('[data-message-author-role="user"]');
        const assistantNode = turn.querySelector('[data-message-author-role="assistant"]');

        if (userNode && userNode instanceof HTMLElement) {
          messages.push({ role: 'user', text: userNode.innerText.trim() });
        } else if (assistantNode && assistantNode instanceof HTMLElement) {
          messages.push({ role: 'assistant', text: assistantNode.innerText.trim() });
        }
      }
      return messages;
    }

    // Fallback: direct query
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
    return queryFirst(SELECTORS.stopButton) !== null || document.querySelector('.result-streaming') !== null;
  }
}
