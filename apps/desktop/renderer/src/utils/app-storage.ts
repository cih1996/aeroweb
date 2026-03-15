/**
 * 应用配置存储工具（用户自定义应用）
 * 使用主进程的文件存储，与 CLI/API 共享数据
 */
import type { AppConfig } from '../types/app-config';

// 内存缓存
let appsCache: AppConfig[] | null = null;

/**
 * 获取所有应用配置（异步，从主进程读取）
 */
export async function getAllAppsAsync(): Promise<AppConfig[]> {
  try {
    const apps = await window.electronAPI.app.list();
    appsCache = apps;
    return apps.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('读取应用配置失败:', error);
    return appsCache || [];
  }
}

/**
 * 获取所有应用配置（同步，使用缓存）
 * 注意：首次调用前需要先调用 getAllAppsAsync() 初始化缓存
 */
export function getAllApps(): AppConfig[] {
  if (appsCache === null) {
    console.warn('应用缓存未初始化，请先调用 getAllAppsAsync()');
    return [];
  }
  return appsCache.sort((a, b) => a.order - b.order);
}

/**
 * 刷新缓存
 */
export async function refreshAppsCache(): Promise<AppConfig[]> {
  return getAllAppsAsync();
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
 * 保存应用配置（异步）
 */
export async function saveAppAsync(app: AppConfig): Promise<void> {
  try {
    await window.electronAPI.app.save(app);
    // 刷新缓存
    await refreshAppsCache();
  } catch (error) {
    console.error('保存应用配置失败:', error);
    throw error;
  }
}

/**
 * 保存应用配置（同步版本，更新本地缓存）
 * 注意：实际保存是异步的，但会立即更新本地缓存
 */
export function saveApp(app: AppConfig): void {
  // 立即更新本地缓存
  if (appsCache) {
    const existingIndex = appsCache.findIndex(a => a.id === app.id);
    if (existingIndex >= 0) {
      appsCache[existingIndex] = { ...app, updatedAt: Date.now() };
    } else {
      const maxOrder = appsCache.reduce((max, a) => Math.max(max, a.order), -1);
      appsCache.push({ ...app, order: maxOrder + 1, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  // 异步保存到主进程
  saveAppAsync(app).catch(console.error);
}

/**
 * 删除应用配置
 */
export async function deleteAppAsync(appId: string): Promise<void> {
  try {
    await window.electronAPI.app.delete(appId);
    // 刷新缓存
    await refreshAppsCache();
  } catch (error) {
    console.error('删除应用配置失败:', error);
    throw error;
  }
}

/**
 * 删除应用配置（同步版本）
 */
export function deleteApp(appId: string): void {
  // 立即更新本地缓存
  if (appsCache) {
    appsCache = appsCache.filter(a => a.id !== appId);
  }
  // 异步删除
  deleteAppAsync(appId).catch(console.error);
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
export async function updateAppOrder(apps: AppConfig[]): Promise<void> {
  try {
    // 重新分配 order 并保存每个应用
    for (let i = 0; i < apps.length; i++) {
      const app = { ...apps[i], order: i, updatedAt: Date.now() };
      await window.electronAPI.app.save(app);
    }
    // 刷新缓存
    await refreshAppsCache();
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
