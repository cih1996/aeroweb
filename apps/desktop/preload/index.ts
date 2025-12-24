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
      ipcRenderer.invoke('tab:triggerFileUploadScan', { tabId, imagePaths })
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
  },

  // Temu 上传面板配置
  temu: {
    saveConfig: (tabId: string, config: any) => 
      ipcRenderer.invoke('temu:saveConfig', { tabId, config }),
    loadConfig: (tabId: string) => 
      ipcRenderer.invoke('temu:loadConfig', { tabId }),
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
      };
      temu: {
        saveConfig: (tabId: string, config: any) => Promise<{ success: boolean; error?: string }>;
        loadConfig: (tabId: string) => Promise<{ success: boolean; config: any | null; error?: string }>;
      };
      network: {
        addRule: (tabId: string, rule: { id: string; pattern: string; enabled: boolean }) => Promise<{ success: boolean }>;
        removeRule: (tabId: string, ruleId: string) => Promise<{ success: boolean }>;
        getRules: (tabId: string) => Promise<Array<{ id: string; pattern: string; enabled: boolean }>>;
        onIntercepted: (callback: (data: { tabId: string; data: { type: 'request' | 'response'; ruleId: string; url: string; method?: string; headers?: Record<string, string>; statusCode?: number; body?: string; timestamp: number } }) => void) => void;
        offIntercepted: (callback: (data: any) => void) => void;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

