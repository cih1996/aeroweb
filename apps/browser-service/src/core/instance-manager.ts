/**
 * 浏览器实例管理器
 * 实现 IBrowserInstanceManager 接口，支持多实例管理
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import type {
  IBrowserInstanceManager,
  IBrowserCore,
  BrowserInstanceConfig,
  BrowserInstanceStatus,
} from '@qiyi/shared';
import { BrowserCore } from './browser-core';

/** 实例上下文 */
interface InstanceContext {
  config: BrowserInstanceConfig;
  core: BrowserCore;
  createdAt: number;
  status: 'running' | 'stopped' | 'error';
  error?: string;
}

/**
 * 浏览器实例管理器实现
 */
export class BrowserInstanceManager implements IBrowserInstanceManager {
  private instances: Map<string, InstanceContext> = new Map();
  private baseUserDataDir: string;

  constructor(baseUserDataDir?: string) {
    this.baseUserDataDir = baseUserDataDir || path.join(app.getPath('userData'), 'instances');
    this.ensureDir(this.baseUserDataDir);
  }

  /**
   * 创建新的浏览器实例
   */
  async createInstance(config: BrowserInstanceConfig): Promise<IBrowserCore> {
    // 检查实例是否已存在
    if (this.instances.has(config.id)) {
      throw new Error(`Instance ${config.id} already exists`);
    }

    // 确保用户数据目录存在
    const userDataDir = config.userDataDir || path.join(this.baseUserDataDir, config.id);
    this.ensureDir(userDataDir);

    try {
      // 创建 BrowserCore 实例
      const core = new BrowserCore(userDataDir);

      const ctx: InstanceContext = {
        config: { ...config, userDataDir },
        core,
        createdAt: Date.now(),
        status: 'running',
      };

      this.instances.set(config.id, ctx);

      console.log(`[InstanceManager] Created instance: ${config.id} (${config.name})`);
      return core;
    } catch (error: any) {
      console.error(`[InstanceManager] Failed to create instance ${config.id}:`, error);
      throw error;
    }
  }

  /**
   * 获取浏览器实例
   */
  getInstance(instanceId: string): IBrowserCore | undefined {
    const ctx = this.instances.get(instanceId);
    return ctx?.core;
  }

  /**
   * 列出所有实例
   */
  async listInstances(): Promise<BrowserInstanceStatus[]> {
    const result: BrowserInstanceStatus[] = [];

    for (const [id, ctx] of this.instances) {
      const pageCount = (await ctx.core.listPages()).length;

      result.push({
        id,
        name: ctx.config.name,
        status: ctx.status,
        pageCount,
        createdAt: ctx.createdAt,
        error: ctx.error,
      });
    }

    return result;
  }

  /**
   * 关闭实例
   */
  async closeInstance(instanceId: string): Promise<void> {
    const ctx = this.instances.get(instanceId);
    if (!ctx) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      ctx.core.destroy();
      ctx.status = 'stopped';
      this.instances.delete(instanceId);
      console.log(`[InstanceManager] Closed instance: ${instanceId}`);
    } catch (error: any) {
      ctx.status = 'error';
      ctx.error = error.message;
      throw error;
    }
  }

  /**
   * 关闭所有实例
   */
  async closeAllInstances(): Promise<void> {
    const ids = Array.from(this.instances.keys());
    for (const id of ids) {
      try {
        await this.closeInstance(id);
      } catch (error) {
        console.error(`[InstanceManager] Failed to close instance ${id}:`, error);
      }
    }
  }

  /**
   * 获取实例配置
   */
  getInstanceConfig(instanceId: string): BrowserInstanceConfig | undefined {
    return this.instances.get(instanceId)?.config;
  }

  /**
   * 列出已保存的实例配置（从磁盘）
   */
  listSavedInstances(): string[] {
    try {
      return fs.readdirSync(this.baseUserDataDir).filter(name => {
        const stat = fs.statSync(path.join(this.baseUserDataDir, name));
        return stat.isDirectory();
      });
    } catch {
      return [];
    }
  }

  /**
   * 删除实例数据（包括缓存）
   */
  async deleteInstanceData(instanceId: string): Promise<void> {
    // 确保实例已关闭
    if (this.instances.has(instanceId)) {
      await this.closeInstance(instanceId);
    }

    const instanceDir = path.join(this.baseUserDataDir, instanceId);
    if (fs.existsSync(instanceDir)) {
      fs.rmSync(instanceDir, { recursive: true, force: true });
      console.log(`[InstanceManager] Deleted instance data: ${instanceId}`);
    }
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/** 全局单例 */
let globalInstanceManager: BrowserInstanceManager | null = null;

/**
 * 获取全局实例管理器
 */
export function getInstanceManager(): BrowserInstanceManager {
  if (!globalInstanceManager) {
    globalInstanceManager = new BrowserInstanceManager();
  }
  return globalInstanceManager;
}

/**
 * 初始化实例管理器
 */
export function initInstanceManager(baseUserDataDir?: string): BrowserInstanceManager {
  globalInstanceManager = new BrowserInstanceManager(baseUserDataDir);
  return globalInstanceManager;
}
