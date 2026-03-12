/**
 * AI Agent 客户端服务
 * 负责与 Python AI Agent 系统通信
 */

export interface AIAgentConfig {
  agentApiUrl: string; // AI Agent 系统 API 地址
  callbackUrl: string; // 本地回调服务器地址
}

export interface AppCapability {
  name: string;
  type: 'navigation' | 'read' | 'analyze' | 'engage' | 'control';
  description: string;
  params: string[];
}

export interface RegisterAppRequest {
  app_name: string;
  callback_url: string;
  capabilities: AppCapability[];
  timeout?: number;
}

export interface TaskRequest {
  message: string;
  enable_interaction?: boolean;
}

export interface ExecutionLogEntry {
  agent: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface InteractionOption {
  choice_id: string;
  label: string;
  description: string;
}

export interface InteractionData {
  situation: string;
  details: string;
  severity: 'low' | 'medium' | 'high';
  options: InteractionOption[];
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_interaction';
  progress: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  token_stats?: Record<string, any>;
  execution_log?: ExecutionLogEntry[];
  interaction_required?: boolean;
  interaction_data?: InteractionData;
}

export class AIAgentClient {
  private config: AIAgentConfig;

  constructor(config: AIAgentConfig) {
    this.config = config;
  }

  /**
   * 注册 APP 能力
   */
  async registerApp(request: RegisterAppRequest): Promise<any> {
    try {
      const response = await fetch(`${this.config.agentApiUrl}/api/register_app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`注册失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[AI Agent] 注册成功:', result);
      return result;
    } catch (err: any) {
      console.error('[AI Agent] 注册失败:', err);
      throw err;
    }
  }

  /**
   * 创建任务
   */
  async createTask(request: TaskRequest): Promise<string> {
    try {
      const response = await fetch(`${this.config.agentApiUrl}/api/task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`创建任务失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[AI Agent] 任务已创建:', result.task_id);
      return result.task_id;
    } catch (err: any) {
      console.error('[AI Agent] 创建任务失败:', err);
      throw err;
    }
  }

  /**
   * 查询任务状态
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    try {
      const response = await fetch(`${this.config.agentApiUrl}/api/task/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`查询任务失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (err: any) {
      console.error('[AI Agent] 查询任务失败:', err);
      throw err;
    }
  }

  /**
   * 轮询任务状态直到完成
   */
  async waitForTask(
    taskId: string,
    onProgress?: (status: TaskStatus) => void,
    pollInterval: number = 2000
  ): Promise<TaskStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getTaskStatus(taskId);
          
          if (onProgress) {
            onProgress(status);
          }

          if (status.status === 'completed' || status.status === 'failed') {
            resolve(status);
          } else {
            setTimeout(poll, pollInterval);
          }
        } catch (err) {
          reject(err);
        }
      };

      poll();
    });
  }

  /**
   * 列出已注册的 APP
   */
  async listApps(): Promise<any> {
    try {
      const response = await fetch(`${this.config.agentApiUrl}/api/apps`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`列出 APP 失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (err: any) {
      console.error('[AI Agent] 列出 APP 失败:', err);
      throw err;
    }
  }

  /**
   * 提交用户交互选择
   */
  async submitInteraction(taskId: string, choice: any): Promise<void> {
    try {
      const response = await fetch(`${this.config.agentApiUrl}/api/task/${taskId}/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ choice }),
      });

      if (!response.ok) {
        throw new Error(`提交交互失败: ${response.status} ${response.statusText}`);
      }

      console.log('[AI Agent] 用户选择已提交');
    } catch (err: any) {
      console.error('[AI Agent] 提交交互失败:', err);
      throw err;
    }
  }

  /**
   * 发送对话消息（非任务执行）
   */
  async sendConversation(request: {
    message: string;
    conversation_history?: Array<{ role: string; content: string }>;
  }): Promise<{
    response: string;
    memorized: boolean;
    suggestions: string[];
  }> {
    try {
      const response = await fetch(`${this.config.agentApiUrl}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: request.message,
          conversation_history: request.conversation_history || [],
        }),
      });

      if (!response.ok) {
        throw new Error(`对话失败: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[AI Agent] 对话响应:', result);
      return result;
    } catch (err: any) {
      console.error('[AI Agent] 对话失败:', err);
      throw err;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AIAgentConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): AIAgentConfig {
    return { ...this.config };
  }
}

// 默认配置
const DEFAULT_CONFIG: AIAgentConfig = {
  agentApiUrl: 'http://localhost:8000',
  callbackUrl: 'http://localhost:5022',
};

// 单例实例
let clientInstance: AIAgentClient | null = null;

/**
 * 获取 AI Agent 客户端实例
 */
export function getAIAgentClient(config?: Partial<AIAgentConfig>): AIAgentClient {
  if (!clientInstance) {
    clientInstance = new AIAgentClient({ ...DEFAULT_CONFIG, ...config });
  } else if (config) {
    clientInstance.updateConfig(config);
  }
  return clientInstance;
}

/**
 * 从 localStorage 加载配置
 */
export function loadAIAgentConfig(): AIAgentConfig {
  try {
    const saved = localStorage.getItem('ai_agent_config');
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('[AI Agent] 加载配置失败:', err);
  }
  return DEFAULT_CONFIG;
}

/**
 * 保存配置到 localStorage
 */
export function saveAIAgentConfig(config: Partial<AIAgentConfig>) {
  try {
    const current = loadAIAgentConfig();
    const updated = { ...current, ...config };
    localStorage.setItem('ai_agent_config', JSON.stringify(updated));
    
    // 更新客户端实例
    if (clientInstance) {
      clientInstance.updateConfig(updated);
    }
  } catch (err) {
    console.error('[AI Agent] 保存配置失败:', err);
  }
}

