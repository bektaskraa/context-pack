// src/shared/types.ts

export type PlatformType = 'claude' | 'chatgpt' | 'gemini';

export interface ContextCodeSnippet {
  file: string;
  description: string;
  code: string;
  language?: string;
}

export interface ContextArchitecture {
  overview?: string;
  components?: string[];
  patterns?: string[];
  [key: string]: unknown;
}

export interface ContextPackData {
  decisions: string[];
  architecture: ContextArchitecture;
  open_questions: string[];
  latest_code: ContextCodeSnippet[];
  [key: string]: unknown;
}

export interface ContextPackRecord {
  id: string;
  user_id: string;
  platform: PlatformType;
  external_chat_id: string;
  title: string;
  version: number;
  pack: ContextPackData;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContextPackSummary {
  id: string;
  platform: PlatformType;
  external_chat_id: string;
  title: string;
  version: number;
  updated_at: string;
}

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export type ExtensionMessage =
  | {
      type: 'SAVE_PACK';
      payload: {
        platform: PlatformType;
        externalChatId: string;
        title: string;
        pack: ContextPackData;
        metadata?: Record<string, unknown>;
        expectedVersion?: number;
      };
    }
  | { type: 'LIST_PACKS' }
  | { type: 'GET_PACK'; payload: { id: string } }
  | { type: 'DELETE_PACK'; payload: { id: string } }
  | { type: 'GET_AUTH_STATUS' }
  | { type: 'SIGN_IN'; payload: { email: string; password: string } }
  | { type: 'SIGN_UP'; payload: { email: string; password: string } }
  | { type: 'SIGN_OUT' }
  | { type: 'SAVE_CONFIG'; payload: SupabaseConfig }
  | { type: 'GET_CONFIG' };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
