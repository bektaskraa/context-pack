// src/shared/redaction.ts

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-[a-zA-Z0-9]{20,}/g, '[REDACTED_API_KEY]'],
  [/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_GITHUB_TOKEN]'],
  [/github_pat_[a-zA-Z0-9_]{50,}/g, '[REDACTED_GITHUB_PAT]'],
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]'],
  [/xoxb-[0-9]+-[a-zA-Z0-9]+/g, '[REDACTED_SLACK_TOKEN]'],
  [/(Bearer\s+)[a-zA-Z0-9._\-]{25,}/gi, '$1[REDACTED_BEARER_TOKEN]'],
  [/eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[REDACTED_JWT]'],
  [/-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]'],
];

export function redactSecrets(text: string): string {
  if (typeof text !== 'string') return text;
  let sanitized = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export function redactObjectSecrets<T>(obj: T): T {
  if (!obj) return obj;
  try {
    const jsonStr = JSON.stringify(obj);
    const sanitizedStr = redactSecrets(jsonStr);
    return JSON.parse(sanitizedStr) as T;
  } catch {
    return obj;
  }
}
