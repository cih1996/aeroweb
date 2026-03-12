/**
 * 动作执行器
 * 处理来自 AI Agent 系统的回调请求
 */

import { capabilityRegistry } from './capability-registry';

export interface ExecuteActionRequest {
  action: string;
  params: any[];
}

export interface ExecuteActionResponse {
  success: boolean;
  data: Record<string, any>;
  message: string;
}

export class ActionExecutor {
  private currentAppName: string | null = null;
  private currentTabId: string | null = null;

  /**
   * 设置当前 APP 名称
   */
  setCurrentApp(appName: string) {
    this.currentAppName = appName;
  }

  /**
   * 设置当前 Tab ID
   */
  setCurrentTabId(tabId: string | null) {
    this.currentTabId = tabId;
  }

  /**
   * 执行动作
   */
  async execute(request: ExecuteActionRequest): Promise<ExecuteActionResponse> {
    const { action, params } = request;

    if (!this.currentAppName) {
      return {
        success: false,
        data: {},
        message: '未设置当前 APP',
      };
    }

    try {
      console.log(`[Action Executor] 执行: ${this.currentAppName}.${action}`, params);

      const result = await capabilityRegistry.execute(
        this.currentAppName,
        action,
        this.currentTabId,
        params
      );

      return {
        success: true,
        data: result || {},
        message: '执行成功',
      };
    } catch (err: any) {
      console.error(`[Action Executor] 执行失败: ${this.currentAppName}.${action}`, err);
      return {
        success: false,
        data: {},
        message: err.message || String(err),
      };
    }
  }
}

// 导出单例
export const actionExecutor = new ActionExecutor();

/**
 * 初始化动作执行器
 * 监听来自 main 进程的回调请求
 */
export function initActionExecutor() {
  // 监听来自回调服务器的执行请求
  window.addEventListener('ai-execute-action', async (event: any) => {
    const { action, params } = event.detail;

    try {
      const result = await actionExecutor.execute({ action, params });

      // 发送结果回 main 进程
      const resultEvent = new CustomEvent('ai-execute-result', {
        detail: result,
      });
      window.dispatchEvent(resultEvent);
    } catch (err: any) {
      // 发送错误回 main 进程
      const resultEvent = new CustomEvent('ai-execute-result', {
        detail: {
          success: false,
          data: {},
          message: err.message || String(err),
        },
      });
      window.dispatchEvent(resultEvent);
    }
  });

  console.log('[Action Executor] 已初始化');
}

