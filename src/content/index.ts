// src/content/index.ts
import { getActiveAdapter } from './adapters';
import { ContextPackWidget } from './ui/widget';

console.log('[ContextPack] Content script loaded on:', window.location.hostname);

function init(): void {
  const adapter = getActiveAdapter();
  if (!adapter) {
    return;
  }

  console.log('[ContextPack] Initialized adapter for:', adapter.platform);

  const widget = new ContextPackWidget(adapter);
  widget.mount();

  // 1. Resilient Mount Guard: Re-mount if React/Vue unmounts the root host
  const hostId = 'context-pack-widget-host';
  const mountObserver = new MutationObserver(() => {
    if (!document.getElementById(hostId)) {
      widget.mount();
    }
  });

  mountObserver.observe(document.body || document.documentElement, {
    childList: true,
  });

  // 2. SPA Route Change Watcher
  let lastHref = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      // Ensure widget is mounted on the new route
      widget.mount();
    }
  }, 1000);

  // 3. Quick Keyboard Shortcut (Alt + C or Cmd + Shift + C) to open Load modal
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.altKey && e.code === 'KeyC') || (e.metaKey && e.shiftKey && e.code === 'KeyC')) {
      const loadBtn = document
        .getElementById(hostId)
        ?.shadowRoot?.getElementById('cp-btn-load') as HTMLButtonElement | null;
      loadBtn?.click();
    }
  });
}

// Ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
