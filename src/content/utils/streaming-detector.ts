// src/content/utils/streaming-detector.ts
import { PlatformType } from '../../shared/types';

type FSMState = 'idle' | 'streaming' | 'settling';

interface PlatformConfig {
  stopButtonSelectors: string[];
  chatContainerSelector: string;
  assistantMessageSelectors: string[];
}

const PLATFORM_CONFIGS: Record<PlatformType, PlatformConfig> = {
  chatgpt: {
    stopButtonSelectors: [
      'button[data-testid="stop-button"]',
      'button[aria-label*="Stop" i]',
      'button[aria-label*="generating" i]',
    ],
    chatContainerSelector: 'main',
    assistantMessageSelectors: [
      '[data-message-author-role="assistant"]',
      'div.markdown.prose',
    ],
  },
  claude: {
    stopButtonSelectors: [
      'button[aria-label*="Stop" i]',
      'button[aria-label*="Durdur" i]',
    ],
    chatContainerSelector: 'main',
    assistantMessageSelectors: [
      'div.font-claude-message',
      'div[class*="font-claude"]',
      'div.standard-markdown',
    ],
  },
  gemini: {
    stopButtonSelectors: [
      // Locale-independent: mat-icon based
      'button:has(mat-icon[fonticon*="stop"])',
      'button[aria-label*="Stop" i]',
      'button[aria-label*="Durdur" i]',
      'button[aria-label*="Arrêter" i]',
      'button[aria-label*="Anhalten" i]',
    ],
    chatContainerSelector: 'chat-window, main',
    assistantMessageSelectors: [
      'model-response',
      '.model-response-text',
      'message-content',
    ],
  },
};

export class StreamingDetector {
  private state: FSMState = 'idle';
  private settlingTimer: ReturnType<typeof setTimeout> | null = null;
  private observer: MutationObserver | null = null;
  private readonly settlingDelayMs = 650;

  constructor(
    private platform: PlatformType,
    private onTurnComplete: (lastMessageEl: HTMLElement | null) => void
  ) {}

  public start(): void {
    this.stop(); // Clean up any existing observer

    const config = PLATFORM_CONFIGS[this.platform];
    const container =
      document.querySelector<HTMLElement>(config.chatContainerSelector) ||
      document.body;

    this.observer = new MutationObserver(() => this.handleMutation());
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: false, // characterData = too noisy during streaming
    });

    // Run once immediately to pick up existing streaming state
    this.handleMutation();
  }

  public stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clearSettlingTimer();
    this.state = 'idle';
  }

  private handleMutation(): void {
    const isCurrentlyStreaming = this.detectStreaming();

    if (isCurrentlyStreaming) {
      // Reset settling timer if a new mutation came in while settling
      if (this.state === 'settling') {
        this.clearSettlingTimer();
      }
      this.state = 'streaming';
    } else if (this.state === 'streaming') {
      // Transition from streaming → settling
      this.state = 'settling';
      this.clearSettlingTimer();
      this.settlingTimer = setTimeout(() => {
        this.state = 'idle';
        this.settlingTimer = null;
        this.dispatchCompletion();
      }, this.settlingDelayMs);
    }
    // If state is 'idle' and no streaming detected — do nothing
  }

  private detectStreaming(): boolean {
    const config = PLATFORM_CONFIGS[this.platform];
    for (const selector of config.stopButtonSelectors) {
      try {
        if (document.querySelector(selector)) return true;
      } catch {
        // Ignore invalid selectors (e.g. :has() unsupported browsers)
      }
    }
    return false;
  }

  private dispatchCompletion(): void {
    const config = PLATFORM_CONFIGS[this.platform];
    let lastEl: HTMLElement | null = null;

    for (const selector of config.assistantMessageSelectors) {
      try {
        const els = document.querySelectorAll<HTMLElement>(selector);
        if (els.length > 0) {
          lastEl = els[els.length - 1];
          break;
        }
      } catch {
        continue;
      }
    }

    this.onTurnComplete(lastEl);
  }

  private clearSettlingTimer(): void {
    if (this.settlingTimer !== null) {
      clearTimeout(this.settlingTimer);
      this.settlingTimer = null;
    }
  }
}
