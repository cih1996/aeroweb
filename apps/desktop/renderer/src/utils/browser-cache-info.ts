/**
 * 浏览器缓存信息工具
 * 用于获取和显示浏览器缓存的存储位置
 */

/**
 * 获取浏览器缓存的存储路径（通过 IPC 从主进程获取）
 */
export async function getBrowserCachePath(): Promise<string> {
  return await window.electronAPI.cache.getUserDataPath();
}

/**
 * 获取特定配置的缓存路径
 */
export async function getConfigCachePath(configId: string): Promise<string> {
  return await window.electronAPI.cache.getPath(configId);
}

/**
 * 获取临时 tab 的缓存路径
 */
export async function getTabCachePath(tabId: string): Promise<string> {
  return await window.electronAPI.cache.getPath(undefined, tabId);
}

/**
 * 获取所有 Partitions 的基础路径
 */
export async function getPartitionsBasePath(): Promise<string> {
  return await window.electronAPI.cache.getPath();
}

