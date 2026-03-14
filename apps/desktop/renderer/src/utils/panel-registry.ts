/**
 * 面板注册表
 * 用于管理不同应用的面板配置
 */
import type { PanelConfig, PanelRegistry } from '../types/panel';
import JSEditorPanel from '../components/panels/JSEditorPanel.svelte';
import DownloadListPanel from '../components/panels/DownloadListPanel.svelte';

// 注册所有可用的面板
export const panelRegistry: PanelRegistry = {
  // 通用 JS 执行面板
  'js-editor': {
    id: 'js-editor',
    name: 'JS 执行器',
    component: JSEditorPanel,
    // 不指定 appIds，表示所有应用都可以使用
  },
  // 下载列表面板
  'download-list': {
    id: 'download-list',
    name: '下载列表',
    component: DownloadListPanel,
    // 不指定 appIds，表示所有应用都可以使用
  },
};

/**
 * 根据应用 ID 获取可用的面板列表
 */
export function getPanelsForApp(appId: string): PanelConfig[] {
  return Object.values(panelRegistry).filter(panel => {
    // 如果没有指定 appIds，或者 appIds 包含当前应用，则显示
    return !panel.appIds || panel.appIds.includes(appId);
  });
}

/**
 * 根据面板 ID 获取面板配置
 */
export function getPanelById(panelId: string): PanelConfig | undefined {
  return panelRegistry[panelId];
}
