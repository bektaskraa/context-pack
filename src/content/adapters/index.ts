// src/content/adapters/index.ts
import { IPlatformAdapter } from './types';
import { ClaudeAdapter } from './claude';
import { ChatGPTAdapter } from './chatgpt';
import { GeminiAdapter } from './gemini';

export function getActiveAdapter(): IPlatformAdapter | null {
  const host = window.location.hostname.toLowerCase();

  if (host.includes('claude.ai')) {
    return new ClaudeAdapter();
  }

  if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) {
    return new ChatGPTAdapter();
  }

  if (host.includes('gemini.google.com')) {
    return new GeminiAdapter();
  }

  return null;
}
