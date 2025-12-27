/**
 * 应用配置存储工具（用户自定义应用）
 */
import type { AppConfig } from '../types/app-config';

const STORAGE_KEY = 'user_apps';

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
    id: 'x',
    name: 'X (Twitter)',
    url: 'https://x.com',
    icon: './apps/icons/x.svg',
    color: '#000000',
    isFavorite: false,
    order: 2,
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
    order: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'bilibili',
    name: '哔哩哔哩',
    url: 'https://www.bilibili.com/',
    icon: './apps/icons/bilibili.svg',
    color: '#FB7299',
    isFavorite: false,
    order: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    icon: './apps/icons/whatsapp.svg',
    color: '#25D366',
    isFavorite: false,
    order: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * 初始化默认应用（仅在首次使用时）
 */
function initDefaultApps(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_APPS));
  }
}

/**
 * 获取所有应用配置
 */
export function getAllApps(): AppConfig[] {
  try {
    initDefaultApps();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const apps: AppConfig[] = JSON.parse(stored);
    // 按 order 排序
    return apps.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('读取应用配置失败:', error);
    return [];
  }
}

/**
 * 获取收藏的应用
 */
export function getFavoriteApps(): AppConfig[] {
  const apps = getAllApps();
  return apps.filter(app => app.isFavorite);
}

/**
 * 获取非收藏的应用
 */
export function getNonFavoriteApps(): AppConfig[] {
  const apps = getAllApps();
  return apps.filter(app => !app.isFavorite);
}

/**
 * 保存应用配置
 */
export function saveApp(app: AppConfig): void {
  try {
    const apps = getAllApps();
    const existingIndex = apps.findIndex(a => a.id === app.id);
    
    if (existingIndex >= 0) {
      // 更新现有应用
      apps[existingIndex] = { ...app, updatedAt: Date.now() };
    } else {
      // 添加新应用
      const maxOrder = apps.reduce((max, a) => Math.max(max, a.order), -1);
      apps.push({ ...app, order: maxOrder + 1, createdAt: Date.now(), updatedAt: Date.now() });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch (error) {
    console.error('保存应用配置失败:', error);
    throw error;
  }
}

/**
 * 删除应用配置
 */
export function deleteApp(appId: string): void {
  try {
    const apps = getAllApps();
    const filtered = apps.filter(a => a.id !== appId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('删除应用配置失败:', error);
    throw error;
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
 * 切换收藏状态
 */
export function toggleFavorite(appId: string): void {
  const app = getAppById(appId);
  if (app) {
    app.isFavorite = !app.isFavorite;
    saveApp(app);
  }
}

/**
 * 更新应用顺序
 */
export function updateAppOrder(apps: AppConfig[]): void {
  try {
    // 重新分配 order
    const updatedApps = apps.map((app, index) => ({
      ...app,
      order: index,
      updatedAt: Date.now(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedApps));
  } catch (error) {
    console.error('更新应用顺序失败:', error);
    throw error;
  }
}

/**
 * 读取图片文件为 base64
 */
export async function readImageAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 保存应用图标到本地缓存
 * @param appId 应用 ID
 * @param base64Data base64 图片数据
 * @returns 保存后的本地路径
 */
export async function saveAppIconToCache(appId: string, base64Data: string): Promise<string> {
  try {
    // 如果不是 base64 数据（可能是已有的路径），直接返回
    if (!base64Data.startsWith('data:image/')) {
      return base64Data;
    }

    const result = await window.electronAPI.fs.saveAppIcon(appId, base64Data);
    
    if (result.success && result.iconPath) {
      // 返回本地文件路径，使用 file:// 协议
      return `file://${result.iconPath}`;
    } else {
      console.error('保存图标失败:', result.error);
      // 如果保存失败，返回原始 base64 数据作为备选
      return base64Data;
    }
  } catch (error) {
    console.error('保存图标到缓存失败:', error);
    // 如果出错，返回原始 base64 数据
    return base64Data;
  }
}

