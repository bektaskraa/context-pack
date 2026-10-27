// src/content/utils/auto-save-manager.ts
import { PlatformType, ContextPackData } from '../../shared/types';
import { redactObjectSecrets } from '../../shared/redaction';

export interface SaveQueueItem {
  platform: PlatformType;
  externalChatId: string;
  title: string;
  pack: ContextPackData;
  contentHash: string;
  metadata?: Record<string, unknown>;
  packId?: string;
}

export class AutoSaveManager {
  private queue: SaveQueueItem[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private knownHashes = new Set<string>();
  private readonly debounceMs = 1500;
  private isFlushing = false;

  /**
   * Enqueue a save item. Items with already-seen hashes are silently dropped.
   */
  public enqueue(item: SaveQueueItem): void {
    if (this.knownHashes.has(item.contentHash)) {
      console.debug('[ContextPack AutoSave] Duplicate hash, skipping:', item.contentHash.substring(0, 8));
      return;
    }

    this.knownHashes.add(item.contentHash);
    item.pack = redactObjectSecrets(item.pack) as ContextPackData;
    this.queue.push(item);

    // Debounce — batch rapid successive turns
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), this.debounceMs);

    console.debug('[ContextPack AutoSave] Queued item for:', item.platform, item.externalChatId);
  }

  private async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;

    this.isFlushing = true;
    const batch = [...this.queue];
    this.queue = [];
    this.flushTimer = null;

    // Save latest item for this chat (the last one wins)
    // We group by (platform, externalChatId) and take only the last
    const latestByChat = new Map<string, SaveQueueItem>();
    for (const item of batch) {
      latestByChat.set(`${item.platform}::${item.externalChatId}`, item);
    }

    for (const item of latestByChat.values()) {
      try {
        const response: any = await chrome.runtime.sendMessage({
          type: 'SAVE_PACK',
          payload: {
            platform: item.platform,
            externalChatId: item.externalChatId,
            title: item.title,
            pack: item.pack,
            packId: item.packId,
            metadata: {
              ...(item.metadata || {}),
              autoSaved: true,
              contentHash: item.contentHash,
              savedAt: new Date().toISOString(),
            },
          },
        });

        if (!response?.success) {
          console.warn('[ContextPack AutoSave] Save failed:', response?.error);
          // Re-queue for retry (but don't re-add to knownHashes so it can retry)
          this.knownHashes.delete(item.contentHash);
          this.queue.push(item);
        } else {
          console.debug('[ContextPack AutoSave] ✅ Saved:', item.title);
        }
      } catch (err) {
        console.error('[ContextPack AutoSave] Network error:', err);
        this.knownHashes.delete(item.contentHash);
        this.queue.push(item);
      }
    }

    this.isFlushing = false;

    // If items were re-queued due to failure, retry in 5s
    if (this.queue.length > 0) {
      this.flushTimer = setTimeout(() => this.flush(), 5000);
    }
  }

  /** Reset session state (call on chat navigation) */
  public resetSession(): void {
    this.queue = [];
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    // NOTE: keep knownHashes to prevent re-saving on soft SPA navigation
  }

  /** Flush immediately (e.g. before nav away) */
  public async flushNow(): Promise<void> {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}
