/**
 * AI 服务类型定义
 */

export interface AIConfig {
  provider: 'openai' | 'deepseek';
  apiKey: string;
  baseUrl?: string;
  model: string;
  useProxy: boolean;
  proxyUrl?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  promptFile?: string;
  historyFile?: string;
  useHistory?: boolean;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResponse {
  success: boolean;
  content?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

