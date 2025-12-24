/**
 * AI 服务核心类
 * 负责调用 AI API，处理对话、流响应等
 */

import type { AIConfig, Message, ChatOptions, ChatResponse, StreamChunk } from './types';
import { loadPromptFile } from './prompt-loader';
import { loadHistory, saveHistory, clearHistory } from './history-manager';

export class AIService {
  private config: AIConfig;
  private systemPrompt: string | null = null;
  private currentHistoryFile: string | null = null;
  private internalHistory: Message[] = []; // 内部历史对话（不持久化，最多200条）

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: AIConfig): void {
    this.config = config;
  }

  /**
   * 加载提示词文件
   * @param promptFilePath 提示词文件路径
   * @param appId 应用ID，用于动态注入操作方法说明
   */
  async loadPromptFile(promptFilePath: string, appId?: string): Promise<void> {
    this.systemPrompt = await loadPromptFile(promptFilePath, appId);
  }

  /**
   * 设置系统提示词
   */
  setSystemPrompt(prompt: string | null): void {
    this.systemPrompt = prompt;
  }

  /**
   * 获取系统提示词
   */
  getSystemPrompt(): string | null {
    return this.systemPrompt;
  }

  /**
   * 设置历史对话文件
   */
  setHistoryFile(historyFile: string): void {
    this.currentHistoryFile = historyFile;
  }

  /**
   * 获取历史对话
   */
  getHistory(historyFile?: string): Message[] {
    const file = historyFile || this.currentHistoryFile;
    if (!file) {
      return [];
    }
    return loadHistory(file);
  }

  /**
   * 清空历史对话
   */
  clearHistory(historyFile?: string): void {
    const file = historyFile || this.currentHistoryFile;
    if (!file) {
      return;
    }
    clearHistory(file);
  }

  /**
   * 限制内部历史对话数量（最多200条）
   */
  private limitInternalHistory(): void {
    const MAX_HISTORY = 200;
    if (this.internalHistory.length > MAX_HISTORY) {
      // 保留最近的200条，移除最旧的
      this.internalHistory = this.internalHistory.slice(-MAX_HISTORY);
    }
  }

  /**
   * 添加消息到内部历史对话
   */
  private addToInternalHistory(role: 'user' | 'assistant', content: string): void {
    this.internalHistory.push({ role, content });
    this.limitInternalHistory();
  }

  /**
   * 导入历史对话（不含提示词）
   * @param history 历史对话列表
   */
  importHistory(history: Message[]): void {
    // 过滤掉 system 角色的消息（提示词）
    this.internalHistory = history.filter(msg => msg.role !== 'system');
    this.limitInternalHistory();
  }

  /**
   * 导出历史对话（不含提示词）
   * @returns 历史对话列表（不含 system 角色的消息）
   */
  exportHistory(): Message[] {
    // 返回内部历史对话，过滤掉 system 角色的消息
    return this.internalHistory.filter(msg => msg.role !== 'system');
  }

  /**
   * 发送消息（非流式）
   */
  async chat(
    message: string,
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    const {
      promptFile,
      historyFile,
      useHistory = true,
      maxTokens = 2000,
      temperature = 0.7,
    } = options;

    try {
      // 加载提示词（如果指定）
      if (promptFile && !this.systemPrompt) {
        await this.loadPromptFile(promptFile);
      }

      // 设置历史文件
      if (historyFile) {
        this.setHistoryFile(historyFile);
      }

      // 构建消息列表
      const messages: Message[] = [];

      // 添加系统提示词
      if (this.systemPrompt) {
        messages.push({
          role: 'system',
          content: this.systemPrompt,
        });
      }

      // 添加内部历史对话
      if (useHistory) {
        messages.push(...this.internalHistory);
      }

      // 添加当前消息
      messages.push({
        role: 'user',
        content: message,
      });

      // 调用 AI API
      const response = await this.callAIAPI(messages, {
        maxTokens,
        temperature,
        stream: false,
      });

      // 保存到内部历史对话
      if (response.success && useHistory) {
        this.addToInternalHistory('user', message);
        this.addToInternalHistory('assistant', response.content || '');
      }

      return response;
    } catch (error: any) {
      console.error('[AIService] 对话失败:', error);
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * 发送消息（流式）
   */
  async *chatStream(
    message: string,
    options: ChatOptions = {},
    onChunk?: (chunk: StreamChunk) => void
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const {
      promptFile,
      historyFile,
      useHistory = true,
      maxTokens = 2000,
      temperature = 0.7,
    } = options;

    try {
      // 加载提示词（如果指定）
      if (promptFile && !this.systemPrompt) {
        await this.loadPromptFile(promptFile);
      }

      // 设置历史文件
      if (historyFile) {
        this.setHistoryFile(historyFile);
      }

      // 构建消息列表
      const messages: Message[] = [];

      // 添加系统提示词
      if (this.systemPrompt) {
        messages.push({
          role: 'system',
          content: this.systemPrompt,
        });
      }

      // 添加内部历史对话
      if (useHistory) {
        messages.push(...this.internalHistory);
      }

      // 添加当前消息
      messages.push({
        role: 'user',
        content: message,
      });

      // 调用流式 API
      let accumulatedContent = '';
      for await (const chunk of this.callAIAPIStream(messages, {
        maxTokens,
        temperature,
      })) {
        accumulatedContent += chunk.content;
        if (onChunk) {
          onChunk(chunk);
        }
        yield chunk;
      }

      // 保存到内部历史对话
      if (useHistory) {
        // 检查最后一条消息是否已经是当前用户消息（避免重复）
        const lastUserMsg = this.internalHistory[this.internalHistory.length - 2];
        const lastAssistantMsg = this.internalHistory[this.internalHistory.length - 1];
        
        // 如果最后一条助手消息不是当前响应，或者没有助手消息，则保存
        if (!lastAssistantMsg || lastAssistantMsg.content !== accumulatedContent) {
          // 如果最后一条用户消息不是当前消息，先添加用户消息
          if (!lastUserMsg || lastUserMsg.content !== message) {
            this.addToInternalHistory('user', message);
          }
          
          // 添加助手消息
          this.addToInternalHistory('assistant', accumulatedContent);
        }
      }
    } catch (error: any) {
      console.error('[AIService] 流式对话失败:', error);
      yield {
        content: '',
        done: true,
      };
    }
  }

  /**
   * 调用 AI API（非流式）
   */
  private async callAIAPI(
    messages: Message[],
    options: { maxTokens: number; temperature: number; stream: boolean }
  ): Promise<ChatResponse> {
    const { provider, apiKey, baseUrl, model, useProxy, proxyUrl } = this.config;

    // 构建 API URL
    let apiUrl = baseUrl || this.getDefaultBaseUrl(provider);
    if (!apiUrl.endsWith('/chat/completions')) {
      apiUrl = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
    }

    // 构建请求体
    const body: any = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    };

    // 构建请求选项
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    };

    try {
      const response = await fetch(apiUrl, requestOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `API 请求失败: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.choices && data.choices.length > 0) {
        return {
          success: true,
          content: data.choices[0].message.content,
          usage: data.usage,
        };
      } else {
        throw new Error('API 返回数据格式异常');
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * 调用 AI API（流式）
   */
  private async *callAIAPIStream(
    messages: Message[],
    options: { maxTokens: number; temperature: number }
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const { provider, apiKey, baseUrl, model, useProxy, proxyUrl } = this.config;

    // 构建 API URL
    let apiUrl = baseUrl || this.getDefaultBaseUrl(provider);
    if (!apiUrl.endsWith('/chat/completions')) {
      apiUrl = `${apiUrl.replace(/\/$/, '')}/chat/completions`;
    }

    // 构建请求体
    const body: any = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      stream: true,
    };

    // 构建请求选项
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    };

    try {
      const response = await fetch(apiUrl, requestOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `API 请求失败: ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') {
              yield { content: '', done: true };
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.choices && data.choices.length > 0) {
                const delta = data.choices[0].delta;
                const content = delta?.content || '';
                if (content) {
                  yield { content, done: false };
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      yield { content: '', done: true };
    } catch (error: any) {
      console.error('[AIService] 流式 API 调用失败:', error);
      yield { content: '', done: true };
    }
  }

  /**
   * 获取默认 API URL
   */
  private getDefaultBaseUrl(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'deepseek':
        return 'https://api.deepseek.com/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }
}

