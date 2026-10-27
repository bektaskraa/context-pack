// src/content/index.ts
import { getActiveAdapter } from './adapters';
import { ContextPackWidget } from './ui/widget';
import { SessionController } from './session-controller';

console.log('[ContextPack] Content script loaded on:', window.location.hostname);

function init(): void {
  const adapter = getActiveAdapter();
  if (!adapter) {
    return;
  }

  console.log('[ContextPack] Initialized adapter for:', adapter.platform);

  const widget = new ContextPackWidget(adapter);
  widget.mount();

  // 1. SessionController: StreamingDetector + AutoSaveManager + SPANavigationWatcher
  const sessionController = new SessionController(adapter);

  // Connect auto-save status to widget toast (subtle info notification)
  sessionController.setStatusCallback((msg, type) => {
    widget.toast(msg, type === 'success' ? 'success' : 'warning');
  });

  // Read persisted auto-save preference
  chrome.storage.local.get(['cp_auto_save_enabled'], (result) => {
    const enabled = result['cp_auto_save_enabled'] !== false; // default ON
    sessionController.setAutoSaveEnabled(enabled);
    widget.setAutoSaveState(enabled);
    sessionController.start();
  });

  // Widget can toggle auto-save
  widget.onAutoSaveToggle((enabled) => {
    sessionController.setAutoSaveEnabled(enabled);
    chrome.storage.local.set({ cp_auto_save_enabled: enabled });
  });

  // Two-way link synchronization between sessionController and widget
  sessionController.setLinkChangeCallback((link) => {
    widget.setLinkedPack(link);
  });

  widget.onLinkChange((link) => {
    sessionController.setLinkedPack(link);
  });

  // 2. Resilient Mount Guard: Re-mount if React/Vue unmounts the root host
  const hostId = 'context-pack-widget-host';
  const mountObserver = new MutationObserver(() => {
    if (!document.getElementById(hostId)) {
      widget.mount();
    }
  });

  mountObserver.observe(document.body || document.documentElement, {
    childList: true,
  });

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
