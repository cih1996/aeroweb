/// <reference types="svelte" />

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
    openDevTools: (tabId: string) => Promise<void>;
    triggerFileUploadScan: (tabId: string, imagePaths?: string[]) => Promise<{ success: boolean; count: number; message: string }>;
    downloadUrl: (tabId: string, url: string) => Promise<boolean>;
  };
  fs: {
    selectDirectory: () => Promise<string | null>;
    readImageFiles: (directory: string) => Promise<string[]>;
    readImageAsBase64: (filePath: string) => Promise<string>;
    findFiles: (pattern: string, sortBy?: 'default' | 'ascii' | 'ctime' | 'mtime', recursive?: boolean) => Promise<{ success: boolean; files: string[]; count: number; error?: string }>;
  };
  config: {
    save: (namespace: string, key: string, config: any) => Promise<{ success: boolean; error?: string }>;
    load: (namespace: string, key: string) => Promise<{ success: boolean; config: any | null; error?: string }>;
  };
      network: {
        addRule: (tabId: string, rule: { id: string; pattern: string; enabled: boolean }) => Promise<{ success: boolean }>;
        removeRule: (tabId: string, ruleId: string) => Promise<{ success: boolean }>;
        getRules: (tabId: string) => Promise<Array<{ id: string; pattern: string; enabled: boolean }>>;
        onIntercepted: (callback: (data: { tabId: string; data: { type: 'response'; ruleId: string; url: string; data: any; timestamp: number } }) => void) => void;
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
      browser: {
        navigate: (tabId: string, url: string) => Promise<boolean>;
        reload: (tabId: string) => Promise<boolean>;
        getURL: (tabId: string) => Promise<string | null>;
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
      };
      cache: {
        getPath: (configId?: string, tabId?: string) => Promise<string>;
        getUserDataPath: () => Promise<string>;
      };
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
    };
  }
}

export {};

