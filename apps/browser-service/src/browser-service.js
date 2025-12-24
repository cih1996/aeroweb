"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserService = void 0;
const injection_manager_1 = require("./injection/injection-manager");
const session_manager_1 = require("./controller/session-manager");
/**
 * Browser Service - 核心护城河
 * 负责 JS 注入、Web 通信接管、Adapter 体系
 */
class BrowserService {
    injectionManager;
    sessionManager;
    constructor() {
        this.injectionManager = new injection_manager_1.InjectionManager();
        this.sessionManager = new session_manager_1.SessionManager();
    }
    /**
     * 为指定 Tab 注入 JS 脚本
     */
    async injectScript(tabId, webContents) {
        // 等待页面加载完成
        await new Promise((resolve) => {
            if (webContents.isLoading()) {
                webContents.once('did-finish-load', () => resolve());
            }
            else {
                resolve();
            }
        });
        // 注入平台 SDK
        await this.injectionManager.injectPlatformSDK(webContents);
        // 注入 Adapter（根据 URL 判断应用类型）
        const url = webContents.getURL();
        const adapter = this.injectionManager.getAdapterForUrl(url);
        if (adapter) {
            await this.injectionManager.injectAdapter(webContents, adapter);
        }
    }
    /**
     * 执行脚本
     */
    async executeScript(webContents, script) {
        return await webContents.executeJavaScript(script);
    }
    /**
     * 获取 Session Manager
     */
    getSessionManager() {
        return this.sessionManager;
    }
}
exports.BrowserService = BrowserService;
