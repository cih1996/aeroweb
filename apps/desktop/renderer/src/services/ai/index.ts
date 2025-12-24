/**
 * AI 服务模块导出
 */

export { AIService } from './ai-service';
export { 
  loadAIConfig, 
  saveAIConfig, 
  validateConfig, 
  getDefaultConfig,
  getCurrentProvider,
  setCurrentProvider,
  loadAllConfigs
} from './config';
export { loadPromptFile, listPromptFiles } from './prompt-loader';
export { loadHistory, saveHistory, clearHistory, getHistoryCount } from './history-manager';
export { generateActionDocs, generateDouyinActionDocs } from './action-docs';
export type { AIConfig, Message, ChatOptions, ChatResponse, StreamChunk } from './types';

