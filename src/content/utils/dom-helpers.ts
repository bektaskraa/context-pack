// src/content/utils/dom-helpers.ts

export function queryFirst<T extends Element = HTMLElement>(
  selectors: string[],
  root: ParentNode = document
): T | null {
  for (const selector of selectors) {
    try {
      const el = root.querySelector<T>(selector);
      if (el) return el;
    } catch {
      // Ignore invalid or outdated selectors
    }
  }
  return null;
}

export function queryAll<T extends Element = HTMLElement>(
  selectors: string[],
  root: ParentNode = document
): T[] {
  for (const selector of selectors) {
    try {
      const els = Array.from(root.querySelectorAll<T>(selector));
      if (els.length > 0) return els;
    } catch {
      continue;
    }
  }
  return [];
}

export function waitForElement<T extends Element = HTMLElement>(
  selectors: string[],
  timeoutMs = 10000,
  root: ParentNode = document
): Promise<T | null> {
  return new Promise((resolve) => {
    const existing = queryFirst<T>(selectors, root);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = queryFirst<T>(selectors, root);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(root === document ? document.body : root, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}
