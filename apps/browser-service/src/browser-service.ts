import { WebContents } from 'electron';
import { InjectionManager } from './injection/injection-manager';
import { SessionManager } from './controller/session-manager';

/**
 * Browser Service - 核心护城河
 * 负责 JS 注入、Web 通信接管、Adapter 体系
 */
export class BrowserService {
  private injectionManager: InjectionManager;
  private sessionManager: SessionManager;

  constructor() {
    this.injectionManager = new InjectionManager();
    this.sessionManager = new SessionManager();
  }

  /**
   * 为指定 Tab 注入 JS 脚本
   */
  async injectScript(tabId: string, webContents: WebContents): Promise<void> {
    // 等待页面加载完成
    await new Promise<void>((resolve) => {
      if (webContents.isLoading()) {
        webContents.once('did-finish-load', () => resolve());
      } else {
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
  async executeScript(webContents: WebContents, script: string): Promise<any> {
    return await webContents.executeJavaScript(script);
  }

  /**
   * 获取 Session Manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }
}

