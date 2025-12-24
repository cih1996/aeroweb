"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjectionManager = void 0;
/**
 * JS 注入管理器
 */
class InjectionManager {
    platformSDKScript;
    constructor() {
        // 平台 SDK 脚本（基础能力）
        this.platformSDKScript = `
      (function() {
        if (window.__polyAppsSDK) return;
        
        window.__polyAppsSDK = {
          // 消息通信
          sendMessage: (type, data) => {
            window.postMessage({
              type: '__polyAppsMessage',
              payload: { type, data }
            }, '*');
          },
          
          // DOM 操作
          querySelector: (selector) => {
            return document.querySelector(selector);
          },
          
          // 事件监听
          onMessage: (callback) => {
            window.addEventListener('message', (event) => {
              if (event.data && event.data.type === '__polyAppsMessage') {
                callback(event.data.payload);
              }
            });
          }
        };
        
        console.log('[Poly Apps SDK] Initialized');
      })();
    `;
    }
    /**
     * 注入平台 SDK
     */
    async injectPlatformSDK(webContents) {
        await webContents.executeJavaScript(this.platformSDKScript);
    }
    /**
     * 注入 Adapter
     */
    async injectAdapter(webContents, adapterScript) {
        await webContents.executeJavaScript(adapterScript);
    }
    /**
     * 根据 URL 获取对应的 Adapter 脚本
     */
    getAdapterForUrl(url) {
        // 简单的 URL 匹配逻辑（后续可扩展）
        if (url.includes('web.whatsapp.com')) {
            return this.getWhatsAppAdapter();
        }
        if (url.includes('web.telegram.org')) {
            return this.getTelegramAdapter();
        }
        if (url.includes('x.com') || url.includes('twitter.com')) {
            return this.getXAdapter();
        }
        return null;
    }
    getWhatsAppAdapter() {
        return `
      (function() {
        if (window.__polyAppsWhatsAppAdapter) return;
        
        window.__polyAppsWhatsAppAdapter = {
          init: () => {
            console.log('[Poly Apps] WhatsApp Adapter loaded');
            // TODO: 实现 WhatsApp 消息监听和 DOM 操作
          }
        };
        
        window.__polyAppsWhatsAppAdapter.init();
      })();
    `;
    }
    getTelegramAdapter() {
        return `
      (function() {
        if (window.__polyAppsTelegramAdapter) return;
        
        window.__polyAppsTelegramAdapter = {
          init: () => {
            console.log('[Poly Apps] Telegram Adapter loaded');
            // TODO: 实现 Telegram 消息监听和 DOM 操作
          }
        };
        
        window.__polyAppsTelegramAdapter.init();
      })();
    `;
    }
    getXAdapter() {
        return `
      (function() {
        if (window.__polyAppsXAdapter) return;
        
        window.__polyAppsXAdapter = {
          init: () => {
            console.log('[Poly Apps] X Adapter loaded');
            // TODO: 实现 X 消息监听和 DOM 操作
          }
        };
        
        window.__polyAppsXAdapter.init();
      })();
    `;
    }
}
exports.InjectionManager = InjectionManager;
