/**
 * 应用类型定义
 */
export type AppId = 'whatsapp' | 'telegram' | 'x' | 'tiktok' | string;

// 导出浏览器核心能力接口
export * from './browser-core';

export interface Tab {
  id: string;
  appId: AppId;
  url: string;
  title: string;
  active: boolean;
  createdAt: number;
  configId?: string; // 浏览器配置 ID
  configName?: string; // 用户自定义的配置名称（用于显示）
  parentTabId?: string; // 父标签页 ID（用于子标签页）
  childTabIds?: string[]; // 子标签页 ID 列表
}

export interface Session {
  id: string;
  tabId: string;
  profileId?: string;
  cookies?: string;
  localStorage?: Record<string, string>;
}

export interface Profile {
  id: string;
  name: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

