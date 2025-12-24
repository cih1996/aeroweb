/**
 * 应用配置类型定义
 */
export interface AppConfig {
  id: string;
  name: string;
  url: string;
  icon: string; // 图标文件名（相对于 icons 目录）
  color?: string; // 主题色（可选）
  category?: string; // 分类ID（可选）
}

/**
 * 分类配置
 */
export interface CategoryConfig {
  id: string;
  name: string;
  icon?: string; // 分类图标文件名（相对于 icons 目录）
  color?: string; // 分类主题色（可选）
}

export interface AppsConfig {
  categories?: CategoryConfig[]; // 分类列表（可选）
  apps: AppConfig[];
}

