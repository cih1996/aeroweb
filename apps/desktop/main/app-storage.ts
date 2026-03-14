/**
 * 应用配置存储（主进程）
 * 使用 JSON 文件存储，与渲染进程的 localStorage 同步
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  id: string;
  name: string;
  url: string;
  icon: string;
  color?: string;
  isFavorite: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_FILE = 'apps.json';

function getStoragePath(): string {
  return path.join(app.getPath('userData'), STORAGE_FILE);
}

/**
 * 默认应用列表
 */
const DEFAULT_APPS: AppConfig[] = [
  {
    id: 'temu',
    name: 'Temu',
    url: 'https://seller.kuajingmaihuo.com/',
    icon: './apps/icons/temu.ico',
    color: '#FF6B00',
    isFavorite: false,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'telegram',
    name: 'Telegram',
    url: 'https://web.telegram.org',
    icon: './apps/icons/telegram.svg',
    color: '#0088cc',
    isFavorite: false,
    order: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'douyin',
    name: '抖音',
    url: 'https://www.douyin.com',
    icon: './apps/icons/tiktok.svg',
    color: '#000000',
    isFavorite: false,
    order: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * 读取所有应用
 */
export function getAllApps(): AppConfig[] {
  try {
    const filePath = getStoragePath();
    if (!fs.existsSync(filePath)) {
      // 初始化默认应用
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_APPS, null, 2));
      return DEFAULT_APPS;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    const apps: AppConfig[] = JSON.parse(data);
    return apps.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('[AppStorage] 读取应用配置失败:', error);
    return [];
  }
}

/**
 * 根据 ID 获取应用
 */
export function getAppById(appId: string): AppConfig | null {
  const apps = getAllApps();
  return apps.find(a => a.id === appId) || null;
}

/**
 * 根据名称获取应用（模糊匹配）
 */
export function getAppByName(name: string): AppConfig | null {
  const apps = getAllApps();
  const lowerName = name.toLowerCase();
  return apps.find(a => a.name.toLowerCase() === lowerName) || null;
}

/**
 * 保存应用
 */
export function saveApp(appConfig: Partial<AppConfig> & { id: string; name: string; url: string }): AppConfig {
  const apps = getAllApps();
  const existingIndex = apps.findIndex(a => a.id === appConfig.id);

  const now = Date.now();
  let savedApp: AppConfig;

  if (existingIndex >= 0) {
    // 更新现有应用
    savedApp = {
      ...apps[existingIndex],
      ...appConfig,
      updatedAt: now,
    };
    apps[existingIndex] = savedApp;
  } else {
    // 添加新应用
    const maxOrder = apps.reduce((max, a) => Math.max(max, a.order), -1);
    savedApp = {
      id: appConfig.id,
      name: appConfig.name,
      url: appConfig.url,
      icon: appConfig.icon || '',
      color: appConfig.color,
      isFavorite: appConfig.isFavorite ?? false,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    apps.push(savedApp);
  }

  fs.writeFileSync(getStoragePath(), JSON.stringify(apps, null, 2));
  return savedApp;
}

/**
 * 删除应用
 */
export function deleteApp(appId: string): boolean {
  const apps = getAllApps();
  const filtered = apps.filter(a => a.id !== appId);
  if (filtered.length === apps.length) {
    return false; // 未找到
  }
  fs.writeFileSync(getStoragePath(), JSON.stringify(filtered, null, 2));
  return true;
}

/**
 * 生成应用 ID（基于名称）
 */
export function generateAppId(name: string): string {
  // 转换为小写，移除特殊字符，用下划线替换空格
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // 检查是否已存在
  const apps = getAllApps();
  let id = base || 'app';
  let counter = 1;
  while (apps.some(a => a.id === id)) {
    id = `${base}_${counter}`;
    counter++;
  }
  return id;
}

/**
 * 确保应用存在，不存在则创建
 */
export function ensureApp(appId: string, url: string, name?: string): AppConfig {
  let existingApp = getAppById(appId);
  if (existingApp) {
    return existingApp;
  }

  // 尝试通过名称查找
  if (name) {
    existingApp = getAppByName(name);
    if (existingApp) {
      return existingApp;
    }
  }

  // 创建新应用
  const appName = name || appId;
  const newId = generateAppId(appName);
  return saveApp({
    id: newId,
    name: appName,
    url: url,
    icon: '',
    isFavorite: false,
  });
}
