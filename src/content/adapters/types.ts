// src/content/adapters/types.ts
import { PlatformType } from '../../shared/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface IPlatformAdapter {
  readonly platform: PlatformType;

  /** Extracts unique chat session ID from the current URL or page */
  getChatId(): string | null;

  /** Extracts session/thread title from UI or document.title */
  getTitle(): string;

  /** Retrieves all conversation messages in order */
  getMessages(): ChatMessage[];

  /** Retrieves the latest assistant response text */
  getLastAssistantMessage(): string | null;

  /** Locates the active prompt input element */
  getInputBox(): HTMLElement | null;

  /** Inserts text into prompt input */
  insertText(text: string): boolean;

  /** Checks if the model is currently generating an active response */
  isStreaming(): boolean;
}
