/**
 * 浏览器配置类型定义
 */
export interface BrowserConfig {
  id: string; // 配置唯一 ID
  appId: string; // 应用 ID
  name: string; // 用户自定义名称
  url: string; // 应用 URL
  proxy?: {
    // 代理配置（未来扩展）
    type?: 'http' | 'socks5';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
  createdAt: number; // 创建时间
  lastUsedAt: number; // 最后使用时间
}

