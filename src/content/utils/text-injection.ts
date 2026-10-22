// src/content/utils/text-injection.ts

/**
 * Injects text reliably into contenteditable rich-text editors
 * used by Claude (TipTap/ProseMirror), ChatGPT (ProseMirror/Lexical), and Gemini (Quill).
 */
export function injectPromptText(editorElement: HTMLElement, text: string): boolean {
  try {
    editorElement.focus();

    // 1. Select all existing text if user wants clean replacement, or position caret
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(editorElement);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // 2. Primary method: document.execCommand('insertText')
    // This triggers native Blink editing pipeline and works with virtual editors
    let success = document.execCommand('insertText', false, text);

    // 3. Fallback: If execCommand returns false or failed to insert
    const sample = text.trim().substring(0, 30);
    const content = editorElement.textContent || '';
    if (!success || (!content.includes(sample) && sample.length > 0)) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });
      editorElement.dispatchEvent(pasteEvent);
      success = true;
    }

    // 4. Dispatch synthetic events to make sure React/Angular forms detect changes
    // and activate the "Send" button
    editorElement.dispatchEvent(new Event('input', { bubbles: true }));
    editorElement.dispatchEvent(new Event('change', { bubbles: true }));

    return success;
  } catch (err) {
    console.error('[ContextPack] injectPromptText error:', err);
    return false;
  }
}

/**
 * Fallback to copying directly to user clipboard when DOM injection is blocked.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = text;
    tempTextarea.style.position = 'fixed';
    tempTextarea.style.opacity = '0';
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(tempTextarea);
    return result;
  } catch (e) {
    console.error('[ContextPack] copyToClipboard error:', e);
    return false;
  }
}
