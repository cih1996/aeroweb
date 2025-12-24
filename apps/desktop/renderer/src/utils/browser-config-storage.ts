/**
 * 浏览器配置存储工具
 */
import type { BrowserConfig } from '../types/browser-config';

const STORAGE_KEY = 'browser_configs';

/**
 * 获取所有浏览器配置
 */
export function getAllConfigs(): BrowserConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('读取浏览器配置失败:', error);
    return [];
  }
}

/**
 * 保存浏览器配置
 */
export function saveConfig(config: BrowserConfig): void {
  try {
    const configs = getAllConfigs();
    const existingIndex = configs.findIndex(c => c.id === config.id);
    
    if (existingIndex >= 0) {
      // 更新现有配置
      configs[existingIndex] = config;
    } else {
      // 添加新配置
      configs.push(config);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('保存浏览器配置失败:', error);
  }
}

/**
 * 删除浏览器配置
 */
export function deleteConfig(configId: string): void {
  try {
    const configs = getAllConfigs();
    const filtered = configs.filter(c => c.id !== configId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('删除浏览器配置失败:', error);
  }
}

/**
 * 根据 ID 获取配置
 */
export function getConfigById(configId: string): BrowserConfig | null {
  const configs = getAllConfigs();
  return configs.find(c => c.id === configId) || null;
}

/**
 * 根据应用 ID 获取配置列表
 */
export function getConfigsByAppId(appId: string): BrowserConfig[] {
  const configs = getAllConfigs();
  return configs.filter(c => c.appId === appId).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/**
 * 更新配置的最后使用时间
 */
export function updateLastUsed(configId: string): void {
  const config = getConfigById(configId);
  if (config) {
    config.lastUsedAt = Date.now();
    saveConfig(config);
  }
}

/**
 * 批量删除配置
 */
export function deleteConfigs(configIds: string[]): void {
  try {
    const configs = getAllConfigs();
    const filtered = configs.filter(c => !configIds.includes(c.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('批量删除浏览器配置失败:', error);
  }
}

