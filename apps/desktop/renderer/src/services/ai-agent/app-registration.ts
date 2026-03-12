/**
 * APP 能力注册管理器
 * 负责向 AI Agent 系统注册 APP 能力
 */

import { getAIAgentClient, type AppCapability } from './index';
import { capabilityRegistry } from './capability-registry';

export interface AppRegistrationConfig {
  appName: string;
  capabilities: Array<{
    capability: AppCapability;
    executor: (tabId: string | null, ...params: any[]) => Promise<any>;
  }>;
  timeout?: number;
}

export class AppRegistrationManager {
  private registered: Set<string> = new Set();

  /**
   * 注册 APP 到 AI Agent 系统
   */
  async registerApp(config: AppRegistrationConfig): Promise<void> {
    const { appName, capabilities, timeout = 30 } = config;

    try {
      // 1. 注册到本地能力注册中心
      capabilityRegistry.registerBatch(appName, capabilities);

      // 2. 获取回调 URL（从 electron API 获取）
      const callbackUrl = await this.getCallbackUrl();

      // 3. 向 AI Agent 系统注册
      const client = getAIAgentClient();
      await client.registerApp({
        app_name: appName,
        callback_url: callbackUrl,
        capabilities: capabilities.map((c) => c.capability),
        timeout,
      });

      this.registered.add(appName);
      console.log(`[App Registration] ${appName} 注册成功`);
    } catch (err: any) {
      console.error(`[App Registration] ${appName} 注册失败:`, err);
      throw err;
    }
  }

  /**
   * 获取回调 URL
   */
  private async getCallbackUrl(): Promise<string> {
    try {
      // 从 electron API 获取回调服务器地址
      if (window.electronAPI && window.electronAPI.getCallbackUrl) {
        return await window.electronAPI.getCallbackUrl();
      }
      
      // 默认值
      return 'http://localhost:5022';
    } catch (err) {
      console.warn('[App Registration] 获取回调 URL 失败，使用默认值');
      return 'http://localhost:5022';
    }
  }

  /**
   * 检查 APP 是否已注册
   */
  isRegistered(appName: string): boolean {
    return this.registered.has(appName);
  }

  /**
   * 取消注册 APP
   */
  unregisterApp(appName: string): void {
    capabilityRegistry.unregister(appName);
    this.registered.delete(appName);
    console.log(`[App Registration] ${appName} 已取消注册`);
  }

  /**
   * 获取所有已注册的 APP
   */
  getRegisteredApps(): string[] {
    return Array.from(this.registered);
  }
}

// 导出单例
export const appRegistrationManager = new AppRegistrationManager();

