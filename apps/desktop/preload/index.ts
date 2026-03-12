import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload 脚本 - 作为 UI 和主进程之间的唯一桥梁
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Tab 操作
  tab: {
    create: (appId: string, url: string, configId?: string, configName?: string) => 
      ipcRenderer.invoke('tab:create', { appId, url, configId, configName }),
    close: (tabId: string) => 
      ipcRenderer.invoke('tab:close', { tabId }),
    activate: (tabId: string) => 
      ipcRenderer.invoke('tab:activate', { tabId }),
    list: () => 
      ipcRenderer.invoke('tab:list'),
    getMemoryUsage: (tabId: string) => 
      ipcRenderer.invoke('tab:getMemoryUsage', { tabId }),
    getCookies: (tabId: string, url?: string) => 
      ipcRenderer.invoke('tab:getCookies', { tabId, url }),
    executeScript: (tabId: string, code: string) => 
      ipcRenderer.invoke('tab:executeScript', { tabId, code }),
    openDevTools: (tabId: string) => 
      ipcRenderer.invoke('tab:openDevTools', { tabId }),
    triggerFileUploadScan: (tabId: string, imagePaths?: string[]) => 
      ipcRenderer.invoke('tab:triggerFileUploadScan', { tabId, imagePaths }),
    downloadUrl: (tabId: string, url: string) => 
      ipcRenderer.invoke('tab:downloadUrl', { tabId, url })
  },

  // 文件系统操作
  fs: {
    selectDirectory: () => 
      ipcRenderer.invoke('dialog:selectDirectory'),
    readImageFiles: (directory: string) => 
      ipcRenderer.invoke('fs:readImageFiles', { directory }),
    readImageAsBase64: (filePath: string) => 
      ipcRenderer.invoke('fs:readImageAsBase64', { filePath }),
    findFiles: (pattern: string, sortBy?: 'default' | 'ascii' | 'ctime' | 'mtime', recursive?: boolean) => 
      ipcRenderer.invoke('fs:findFiles', { pattern, sortBy, recursive }),
    saveAppIcon: (appId: string, base64Data: string) =>
      ipcRenderer.invoke('fs:saveAppIcon', { appId, base64Data }),
  },

  // 通用配置管理
  config: {
    save: (namespace: string, key: string, config: any) => 
      ipcRenderer.invoke('config:save', { namespace, key, config }),
    load: (namespace: string, key: string) => 
      ipcRenderer.invoke('config:load', { namespace, key }),
  },

  // Browser 操作
  browser: {
    navigate: (tabId: string, url: string) => 
      ipcRenderer.invoke('browser:navigate', { tabId, url }),
    reload: (tabId: string) => 
      ipcRenderer.invoke('browser:reload', { tabId }),
    getURL: (tabId: string) => 
      ipcRenderer.invoke('browser:getURL', { tabId }),
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // 视图控制
  view: {
    hideBrowser: () => ipcRenderer.invoke('view:hideBrowser'),
    showBrowser: (tabId: string) => ipcRenderer.invoke('view:showBrowser', { tabId }),
    temporarilyHide: () => ipcRenderer.invoke('view:temporarilyHide'),
    restoreHidden: () => ipcRenderer.invoke('view:restoreHidden'),
    updateBounds: (options: { rightPanelWidth: number }) => 
      ipcRenderer.invoke('view:updateBounds', options),
  },

  // 缓存路径
  cache: {
    getPath: (configId?: string, tabId?: string) => 
      ipcRenderer.invoke('cache:getPath', { configId, tabId }),
    getUserDataPath: () => 
      ipcRenderer.invoke('cache:getUserDataPath'),
  },

  // 网络拦截
      network: {
        addRule: (tabId: string, rule: any) => 
      ipcRenderer.invoke('network:addRule', { tabId, rule }),
    removeRule: (tabId: string, ruleId: string) => 
      ipcRenderer.invoke('network:removeRule', { tabId, ruleId }),
    getRules: (tabId: string) => 
      ipcRenderer.invoke('network:getRules', { tabId }),
    onIntercepted: (callback: (data: any) => void) => {
      ipcRenderer.on('network:intercepted', (_, data) => callback(data));
    },
    offIntercepted: (callback: (data: any) => void) => {
      ipcRenderer.removeListener('network:intercepted', callback);
    },
  },
  download: {
    list: () => ipcRenderer.invoke('download:list'),
    listByTab: (tabId: string) => ipcRenderer.invoke('download:listByTab', { tabId }),
    cancel: (downloadId: string) => ipcRenderer.invoke('download:cancel', { downloadId }),
    pause: (downloadId: string) => ipcRenderer.invoke('download:pause', { downloadId }),
    resume: (downloadId: string) => ipcRenderer.invoke('download:resume', { downloadId }),
    remove: (downloadId: string) => ipcRenderer.invoke('download:remove', { downloadId }),
  },

  // AI Agent 相关
  getCallbackUrl: () => 
    ipcRenderer.invoke('ai:getCallbackUrl'),

  // 事件监听
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

// 类型声明（供 TypeScript 使用）
declare global {
  interface Window {
    electronAPI: {
      tab: {
        create: (appId: string, url: string, configId?: string, configName?: string) => Promise<any>;
        close: (tabId: string) => Promise<boolean>;
        activate: (tabId: string) => Promise<boolean>;
        list: () => Promise<any[]>;
        getMemoryUsage: (tabId: string) => Promise<any>;
        getCookies: (tabId: string, url?: string) => Promise<any[]>;
        executeScript: (tabId: string, code: string) => Promise<any>;
        downloadUrl: (tabId: string, url: string) => Promise<boolean>;
      };
      browser: {
        navigate: (tabId: string, url: string) => Promise<boolean>;
        reload: (tabId: string) => Promise<boolean>;
      };
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
      };
      view: {
        hideBrowser: () => Promise<void>;
        showBrowser: (tabId: string) => Promise<void>;
        temporarilyHide: () => Promise<void>;
        restoreHidden: () => Promise<void>;
        updateBounds: (options: { rightPanelWidth: number }) => Promise<void>;
      };
      cache: {
        getPath: (configId?: string, tabId?: string) => Promise<string>;
        getUserDataPath: () => Promise<string>;
      };
      fs: {
        selectDirectory: () => Promise<string | null>;
        readImageFiles: (directory: string) => Promise<string[]>;
        readImageAsBase64: (filePath: string) => Promise<string>;
        saveAppIcon: (appId: string, base64Data: string) => Promise<{ success: boolean; iconPath?: string; error?: string }>;
      };
      config: {
        save: (namespace: string, key: string, config: any) => Promise<{ success: boolean; error?: string }>;
        load: (namespace: string, key: string) => Promise<{ success: boolean; config: any | null; error?: string }>;
      };
      network: {
        addRule: (tabId: string, rule: { id: string; pattern: string; enabled: boolean }) => Promise<{ success: boolean }>;
        removeRule: (tabId: string, ruleId: string) => Promise<{ success: boolean }>;
        getRules: (tabId: string) => Promise<Array<{ id: string; pattern: string; enabled: boolean }>>;
        onIntercepted: (callback: (data: { tabId: string; data: { type: 'request' | 'response'; ruleId: string; url: string; method?: string; headers?: Record<string, string>; statusCode?: number; body?: string; timestamp: number } }) => void) => void;
        offIntercepted: (callback: (data: any) => void) => void;
      };
      download: {
        list: () => Promise<Array<{ id: string; tabId: string; url: string; filename: string; savePath: string; totalBytes: number; receivedBytes: number; state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'; startTime: number; speed: number; thumbnail?: string; mimeType?: string }>>;
        listByTab: (tabId: string) => Promise<Array<{ id: string; tabId: string; url: string; filename: string; savePath: string; totalBytes: number; receivedBytes: number; state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'; startTime: number; speed: number; thumbnail?: string; mimeType?: string }>>;
        cancel: (downloadId: string) => Promise<boolean>;
        pause: (downloadId: string) => Promise<boolean>;
        resume: (downloadId: string) => Promise<boolean>;
        remove: (downloadId: string) => Promise<boolean>;
      };
      getCallbackUrl: () => Promise<string>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

