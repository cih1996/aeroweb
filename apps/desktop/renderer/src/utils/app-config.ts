/**
 * 应用配置加载工具
 */
import type { AppsConfig, AppConfig, CategoryConfig } from '../types/app-config';

let cachedConfig: AppsConfig | null = null;

/**
 * 加载应用配置
 */
export async function loadAppsConfig(): Promise<AppsConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    // 使用相对路径加载配置文件（生产环境标准）
    const response = await fetch('./apps/apps.json');
    if (!response.ok) {
      throw new Error(`Failed to load apps config: ${response.statusText}`);
    }
    const config: AppsConfig = await response.json();
    
    // 验证配置格式
    if (!config.apps || !Array.isArray(config.apps)) {
      throw new Error('Invalid apps config format');
    }

    cachedConfig = config;
    return config;
  } catch (error) {
    console.error('Error loading apps config:', error);
    // 返回默认配置
    return {
      apps: []
    };
  }
}

/**
 * 获取应用图标 URL
 */
export function getAppIconUrl(iconFileName: string): string {
  // 使用相对路径（生产环境标准）
  return `./apps/icons/${iconFileName}`;
}

/**
 * 获取分类图标 URL
 */
export function getCategoryIconUrl(iconFileName: string): string {
  // 使用相对路径（生产环境标准）
  return `./apps/icons/${iconFileName}`;
}

/**
 * 获取所有应用列表
 */
export async function getApps(): Promise<AppConfig[]> {
  const config = await loadAppsConfig();
  return config.apps;
}

/**
 * 获取所有分类列表
 */
export async function getCategories(): Promise<CategoryConfig[]> {
  const config = await loadAppsConfig();
  return config.categories || [];
}

/**
 * 根据 ID 获取应用配置
 */
export async function getAppById(id: string): Promise<AppConfig | null> {
  const apps = await getApps();
  return apps.find(app => app.id === id) || null;
}

/**
 * 根据 ID 获取分类配置
 */
export async function getCategoryById(id: string): Promise<CategoryConfig | null> {
  const categories = await getCategories();
  return categories.find(cat => cat.id === id) || null;
}

/**
 * 按分类分组应用
 */
export async function getAppsByCategory(): Promise<Record<string, AppConfig[]>> {
  const apps = await getApps();
  const categories = await getCategories();
  
  const grouped: Record<string, AppConfig[]> = {};
  
  // 初始化所有分类
  categories.forEach(cat => {
    grouped[cat.id] = [];
  });
  
  // 未分类的应用
  grouped['uncategorized'] = [];
  
  // 分组应用
  apps.forEach(app => {
    if (app.category && grouped[app.category]) {
      grouped[app.category].push(app);
    } else {
      grouped['uncategorized'].push(app);
    }
  });
  
  // 移除空分类
  Object.keys(grouped).forEach(key => {
    if (grouped[key].length === 0 && key !== 'uncategorized') {
      delete grouped[key];
    }
  });
  
  return grouped;
}

