/**
 * 应用配置类型定义（用户自定义）
 */
export interface AppConfig {
  id: string;
  name: string;
  url: string;
  icon: string; // 图标 base64 或 URL
  color?: string; // 主题色（可选）
  isFavorite: boolean; // 是否收藏
  order: number; // 排序顺序
  createdAt: number; // 创建时间戳
  updatedAt: number; // 更新时间戳
}

/**
 * 分类配置（已废弃，保留兼容性）
 */
export interface CategoryConfig {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface AppsConfig {
  categories?: CategoryConfig[];
  apps: AppConfig[];
}

