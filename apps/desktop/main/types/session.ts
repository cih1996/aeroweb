/**
 * Session（会话）- 持久化的浏览器实例
 *
 * 每个 Session 有独立的缓存目录，可以实现多账号登录
 * 关闭标签页后 Session 仍然保留，下次可以恢复
 */
export interface Session {
  id: string;              // 唯一标识，如 "bilibili_1", "bilibili_2"
  name: string;            // 显示名称，如 "B站-主号", "B站-小号"
  url: string;             // 默认打开的 URL
  icon?: string;           // 图标（可选，自动从网站获取）
  color?: string;          // 主题色
  note?: string;           // 备注信息
  partition: string;       // 缓存分区名，如 "persist:bilibili_1"
  createdAt: number;       // 创建时间
  lastUsedAt: number;      // 最后使用时间
  isRunning?: boolean;     // 是否正在运行（运行时状态，不持久化）
}

/**
 * Session 存储格式
 */
export interface SessionStorage {
  sessions: Session[];
  version: number;
}
