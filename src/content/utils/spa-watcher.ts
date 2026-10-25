// src/content/utils/spa-watcher.ts

type UrlChangeCallback = (newUrl: string, oldUrl: string) => void;

/**
 * Watches for SPA-style URL changes on ChatGPT, Claude, and Gemini.
 * Uses 3-tier strategy:
 *   1. window.navigation API (Chrome 102+ — instant, no permissions)
 *   2. popstate (back/forward nav)
 *   3. 600ms polling fallback (bulletproof)
 */
export class SPANavigationWatcher {
  private lastUrl: string = window.location.href;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private onUrlChange: UrlChangeCallback) {
    this.init();
  }

  private init(): void {
    // 1. Modern Navigation API (Chrome 102+)
    const nav = (window as any).navigation;
    if (nav && typeof nav.addEventListener === 'function') {
      nav.addEventListener('navigatesuccess', () => {
        this.checkUrl();
      });
    }

    // 2. popstate (browser back/forward, hash changes)
    window.addEventListener('popstate', () => this.checkUrl());

    // 3. Polling fallback — handles pushState not caught above
    this.pollInterval = setInterval(() => this.checkUrl(), 600);
  }

  private checkUrl(): void {
    const currentUrl = window.location.href;
    if (currentUrl !== this.lastUrl) {
      const oldUrl = this.lastUrl;
      this.lastUrl = currentUrl;
      this.onUrlChange(currentUrl, oldUrl);
    }
  }

  public destroy(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
