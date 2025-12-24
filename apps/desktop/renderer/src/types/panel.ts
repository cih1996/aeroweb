/**
 * 面板系统类型定义
 */

export interface PanelConfig {
  id: string;
  name: string;
  component: any; // Svelte 组件
  appIds?: string[]; // 指定哪些应用显示此面板，undefined 表示所有应用
}

export interface PanelRegistry {
  [panelId: string]: PanelConfig;
}

