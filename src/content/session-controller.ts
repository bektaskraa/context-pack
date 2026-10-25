// src/content/session-controller.ts
import { IPlatformAdapter } from './adapters/types';
import { StreamingDetector } from './utils/streaming-detector';
import { AutoSaveManager } from './utils/auto-save-manager';
import { SPANavigationWatcher } from './utils/spa-watcher';
import { computePackHash } from './utils/hash';
import { ContextPackData } from '../shared/types';

/**
 * SessionController ties together:
 *  - StreamingDetector (FSM-based turn completion)
 *  - AutoSaveManager   (debounced, deduplicated Supabase writes)
 *  - SPANavigationWatcher (chat switching)
 *
 * When a new assistant turn completes:
 *   1. Extract last assistant text from DOM
 *   2. Try to parse it as structured JSON (pack format)
 *   3. Wrap as ContextPackData if not JSON
 *   4. Compute SHA-256 hash for deduplication
 *   5. Enqueue for auto-save
 */
export class SessionController {
  private detector: StreamingDetector | null = null;
  private spaWatcher: SPANavigationWatcher | null = null;
  private saveManager: AutoSaveManager;
  private isAutoSaveEnabled: boolean = true;
  private onStatusChange: ((msg: string, type: 'success' | 'info') => void) | null = null;

  constructor(private adapter: IPlatformAdapter) {
    this.saveManager = new AutoSaveManager();
  }

  public setStatusCallback(cb: (msg: string, type: 'success' | 'info') => void): void {
    this.onStatusChange = cb;
  }

  public setAutoSaveEnabled(enabled: boolean): void {
    this.isAutoSaveEnabled = enabled;
    if (enabled && !this.detector) {
      this.startDetector();
    } else if (!enabled && this.detector) {
      this.detector.stop();
      this.detector = null;
    }
  }

  public start(): void {
    // Start SPA navigation watcher
    this.spaWatcher = new SPANavigationWatcher(async (newUrl, oldUrl) => {
      console.log('[ContextPack] SPA navigation:', oldUrl, '→', newUrl);
      await this.saveManager.flushNow(); // Flush pending saves before switching
      this.saveManager.resetSession();
      this.restartDetector();
    });

    // Start streaming detector
    if (this.isAutoSaveEnabled) {
      this.startDetector();
    }
  }

  public stop(): void {
    this.detector?.stop();
    this.detector = null;
    this.spaWatcher?.destroy();
    this.spaWatcher = null;
  }

  private startDetector(): void {
    this.detector?.stop();
    this.detector = new StreamingDetector(
      this.adapter.platform,
      (lastEl) => this.handleTurnComplete(lastEl)
    );
    this.detector.start();
    console.log('[ContextPack] StreamingDetector started for:', this.adapter.platform);
  }

  private restartDetector(): void {
    // Wait briefly for the new chat DOM to mount before re-attaching
    setTimeout(() => {
      if (this.isAutoSaveEnabled) {
        this.startDetector();
      }
    }, 800);
  }

  private async handleTurnComplete(lastEl: HTMLElement | null): Promise<void> {
    if (!this.isAutoSaveEnabled) return;

    const chatId = this.adapter.getChatId();
    if (!chatId) {
      console.debug('[ContextPack] No chat ID yet, skipping auto-save');
      return;
    }

    // Extract text from last element or adapter
    const rawText = lastEl?.innerText?.trim() || this.adapter.getLastAssistantMessage();
    if (!rawText || rawText.length < 30) {
      console.debug('[ContextPack] Response too short, skipping');
      return;
    }

    // Try to parse as structured pack JSON (if model was asked to summarize)
    const pack = this.tryParsePack(rawText);

    // Compute deduplication hash
    const hash = await computePackHash(chatId, pack);

    const title = this.adapter.getTitle() || 'Başlıksız Sohbet';

    this.saveManager.enqueue({
      platform: this.adapter.platform,
      externalChatId: chatId,
      title,
      pack,
      contentHash: hash,
      metadata: {
        url: window.location.href,
        capturedAt: new Date().toISOString(),
        rawTextLength: rawText.length,
      },
    });

    // Show subtle status notification
    this.onStatusChange?.('💾 Otomatik kaydedildi', 'success');
  }

  private tryParsePack(rawText: string): ContextPackData {
    // Try JSON code block first
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const candidate = jsonMatch ? jsonMatch[1] : rawText;

    try {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const parsed = JSON.parse(candidate.substring(start, end + 1));
        if (parsed && typeof parsed === 'object') {
          return {
            decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
            architecture:
              typeof parsed.architecture === 'object' && parsed.architecture
                ? parsed.architecture
                : {},
            open_questions: Array.isArray(parsed.open_questions) ? parsed.open_questions : [],
            latest_code: Array.isArray(parsed.latest_code) ? parsed.latest_code : [],
          };
        }
      }
    } catch {
      // Not valid JSON — store as raw snapshot
    }

    // Fallback: store raw text as a snapshot
    return {
      decisions: [],
      architecture: {},
      open_questions: [],
      latest_code: [],
      raw_snapshot: rawText.substring(0, 4000), // Cap at 4000 chars
    };
  }
}
