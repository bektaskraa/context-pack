// src/content/utils/hash.ts

/**
 * Compute SHA-256 hash of a string using the WebCrypto API.
 * Returns a hex string.
 */
export async function sha256(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normalize message content before hashing to avoid false misses.
 * - Unicode normalize (NFKC)
 * - Collapse whitespace
 * - Trim edges
 */
export function normalizeContent(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compute a deduplication hash for a conversation message.
 * Format: SHA-256("<chatId>::<role>::<normalizedContent>")
 */
export async function computeMessageHash(
  chatId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<string> {
  const normalized = normalizeContent(content);
  const payload = `${chatId}::${role}::${normalized}`;
  return sha256(payload);
}

/**
 * Compute a deduplication hash for a full context pack object.
 */
export async function computePackHash(
  chatId: string,
  pack: unknown
): Promise<string> {
  const payload = `${chatId}::pack::${JSON.stringify(pack)}`;
  return sha256(payload);
}
