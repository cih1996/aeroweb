/**
 * 能力注册中心
 * 管理 APP 能力的注册和执行
 */

import type { AppCapability } from './index';

export interface CapabilityExecutor {
  (tabId: string | null, ...params: any[]): Promise<any>;
}

export interface RegisteredCapability extends AppCapability {
  executor: CapabilityExecutor;
}

class CapabilityRegistry {
  private capabilities: Map<string, Map<string, RegisteredCapability>> = new Map();

  /**
   * 注册能力
   */
  register(
    appName: string,
    capability: AppCapability,
    executor: CapabilityExecutor
  ): void {
    if (!this.capabilities.has(appName)) {
      this.capabilities.set(appName, new Map());
    }

    const appCapabilities = this.capabilities.get(appName)!;
    appCapabilities.set(capability.name, {
      ...capability,
      executor,
    });

    console.log(`[Capability Registry] 已注册: ${appName}.${capability.name}`);
  }

  /**
   * 批量注册能力
   */
  registerBatch(
    appName: string,
    capabilities: Array<{ capability: AppCapability; executor: CapabilityExecutor }>
  ): void {
    capabilities.forEach(({ capability, executor }) => {
      this.register(appName, capability, executor);
    });
  }

  /**
   * 执行能力
   */
  async execute(
    appName: string,
    action: string,
    tabId: string | null,
    params: any[]
  ): Promise<any> {
    const appCapabilities = this.capabilities.get(appName);
    if (!appCapabilities) {
      throw new Error(`未找到 APP: ${appName}`);
    }

    const capability = appCapabilities.get(action);
    if (!capability) {
      throw new Error(`未找到能力: ${appName}.${action}`);
    }

    console.log(`[Capability Registry] 执行: ${appName}.${action}`, params);

    try {
      const result = await capability.executor(tabId, ...params);
      return result;
    } catch (err: any) {
      console.error(`[Capability Registry] 执行失败: ${appName}.${action}`, err);
      throw err;
    }
  }

  /**
   * 获取 APP 的所有能力
   */
  getCapabilities(appName: string): AppCapability[] {
    const appCapabilities = this.capabilities.get(appName);
    if (!appCapabilities) {
      return [];
    }

    return Array.from(appCapabilities.values()).map(({ executor, ...cap }) => cap);
  }

  /**
   * 获取所有已注册的 APP
   */
  getRegisteredApps(): string[] {
    return Array.from(this.capabilities.keys());
  }

  /**
   * 检查能力是否存在
   */
  hasCapability(appName: string, action: string): boolean {
    const appCapabilities = this.capabilities.get(appName);
    return appCapabilities ? appCapabilities.has(action) : false;
  }

  /**
   * 取消注册 APP
   */
  unregister(appName: string): void {
    this.capabilities.delete(appName);
    console.log(`[Capability Registry] 已取消注册: ${appName}`);
  }

  /**
   * 清空所有注册
   */
  clear(): void {
    this.capabilities.clear();
    console.log('[Capability Registry] 已清空所有注册');
  }
}

// 导出单例
export const capabilityRegistry = new CapabilityRegistry();

