/**
 * IPC 通信协议定义
 */

// Tab 相关 IPC 事件
export interface IPCTabEvents {
  'tab:create': { appId: string; url: string };
  'tab:close': { tabId: string };
  'tab:activate': { tabId: string };
  'tab:update': { tabId: string; updates: Partial<{ title: string; url: string }> };
  'tab:list': void;
  'tab:list:response': { tabs: Array<{ id: string; appId: string; title: string; url: string; active: boolean }> };
}

// Browser Service 相关 IPC 事件
export interface IPCBrowserEvents {
  'browser:inject': { tabId: string; script: string };
  'browser:execute': { tabId: string; script: string };
  'browser:navigate': { tabId: string; url: string };
  'browser:reload': { tabId: string };
}

// 消息相关 IPC 事件
export interface IPCMessageEvents {
  'message:received': { tabId: string; appId: string; message: unknown };
  'message:send': { tabId: string; appId: string; message: unknown };
}

export type IPCEventMap = IPCTabEvents & IPCBrowserEvents & IPCMessageEvents;

