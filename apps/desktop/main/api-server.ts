/**
 * HTTP API Server
 * 提供 REST API 接口供 CLI/MCP 调用
 */
import * as http from 'http';
import { TabManager } from './windows/tab-manager';
import { app, BrowserWindow } from 'electron';
import * as AppStorage from './app-storage';
import * as SessionStorage from './session-storage';

const API_PORT = 9528;

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class ApiServer {
  private server: http.Server | null = null;
  private tabManager: TabManager | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor() {}

  setTabManager(tabManager: TabManager) {
    this.tabManager = tabManager;
  }

  setMainWindow(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  // 通知渲染进程应用列表已更新
  private notifyAppsUpdated() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('apps:updated');
    }
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[ApiServer] Port ${API_PORT} is already in use`);
          reject(err);
        } else {
          console.error('[ApiServer] Server error:', err);
          reject(err);
        }
      });

      this.server.listen(API_PORT, '127.0.0.1', () => {
        console.log(`[ApiServer] HTTP API Server running on http://127.0.0.1:${API_PORT}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[ApiServer] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    try {
      let response: ApiResponse;

      // Route matching
      if (pathname === '/api/status' && method === 'GET') {
        response = await this.handleStatus();
      } else if (pathname === '/api/tabs' && method === 'GET') {
        response = await this.handleListTabs();
      } else if (pathname === '/api/tabs' && method === 'POST') {
        const body = await this.parseBody(req);
        response = await this.handleCreateTab(body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+$/) && method === 'DELETE') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleCloseTab(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/navigate$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleNavigate(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/screenshot$/) && method === 'GET') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleScreenshot(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/snapshot$/) && method === 'GET') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleSnapshot(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/execute$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleExecute(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/console$/) && method === 'GET') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const level = url.searchParams.get('level') || undefined;
        response = await this.handleConsole(tabId, level);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/upload$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleUpload(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/click$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleClick(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/type$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleType(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/wait-element$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleWaitElement(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/wait-text$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleWaitText(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/network\/start$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleNetworkStart(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/network\/stop$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleNetworkStop(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/network$/) && method === 'GET') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const urlFilter = url.searchParams.get('url') || undefined;
        const methodFilter = url.searchParams.get('method') || undefined;
        const statusFilter = url.searchParams.get('status');
        response = await this.handleNetworkGet(tabId, { url: urlFilter, method: methodFilter, status: statusFilter ? parseInt(statusFilter) : undefined });
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/network$/) && method === 'DELETE') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleNetworkClear(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/network\/wait$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleNetworkWait(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/cookies$/) && method === 'GET') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const cookieUrl = url.searchParams.get('url') || undefined;
        const cookieName = url.searchParams.get('name') || undefined;
        response = await this.handleGetCookies(tabId, cookieUrl, cookieName);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/cookies$/) && method === 'POST') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleSetCookie(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/cookies$/) && method === 'DELETE') {
        const tabId = decodeURIComponent(pathname.split('/')[3]);
        const cookieUrl = url.searchParams.get('url') || undefined;
        const cookieName = url.searchParams.get('name');
        if (cookieName) {
          response = await this.handleRemoveCookie(tabId, cookieUrl, cookieName);
        } else {
          response = await this.handleClearCookies(tabId, cookieUrl);
        }
      }
      // 应用管理 API
      else if (pathname === '/api/apps' && method === 'GET') {
        response = await this.handleListApps();
      } else if (pathname === '/api/apps' && method === 'POST') {
        const body = await this.parseBody(req);
        response = await this.handleCreateApp(body);
      } else if (pathname.match(/^\/api\/apps\/[^/]+$/) && method === 'GET') {
        const appId = pathname.split('/')[3];
        response = await this.handleGetApp(appId);
      } else if (pathname.match(/^\/api\/apps\/[^/]+$/) && method === 'DELETE') {
        const appId = pathname.split('/')[3];
        response = await this.handleDeleteApp(appId);
      }
      // Session 管理 API
      else if (pathname === '/api/sessions' && method === 'GET') {
        response = await this.handleListSessions();
      } else if (pathname === '/api/sessions' && method === 'POST') {
        const body = await this.parseBody(req);
        response = await this.handleCreateSession(body);
      } else if (pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'GET') {
        const sessionId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleGetSession(sessionId);
      } else if (pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'PUT') {
        const sessionId = decodeURIComponent(pathname.split('/')[3]);
        const body = await this.parseBody(req);
        response = await this.handleUpdateSession(sessionId, body);
      } else if (pathname.match(/^\/api\/sessions\/[^/]+$/) && method === 'DELETE') {
        const sessionId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleDeleteSession(sessionId);
      } else if (pathname.match(/^\/api\/sessions\/[^/]+\/open$/) && method === 'POST') {
        const sessionId = decodeURIComponent(pathname.split('/')[3]);
        response = await this.handleOpenSession(sessionId);
      } else {
        response = { success: false, error: 'Not found' };
        res.writeHead(404);
        res.end(JSON.stringify(response));
        return;
      }

      res.writeHead(response.success ? 200 : 400);
      res.end(JSON.stringify(response));
    } catch (error: any) {
      const response: ApiResponse = {
        success: false,
        error: error.message || 'Internal server error',
      };
      res.writeHead(500);
      res.end(JSON.stringify(response));
    }
  }

  private parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  // GET /api/status
  private async handleStatus(): Promise<ApiResponse> {
    const tabs = this.tabManager ? await this.tabManager.listTabs() : [];
    return {
      success: true,
      data: {
        version: app.getVersion(),
        name: app.getName(),
        tabCount: tabs.length,
        activeTabId: this.tabManager?.getActiveTabId() || null,
        uptime: process.uptime(),
      },
    };
  }

  // GET /api/tabs
  private async handleListTabs(): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const tabs = await this.tabManager.listTabs();
    return {
      success: true,
      data: tabs.map((tab) => ({
        id: tab.id,
        appId: tab.appId,
        url: tab.url,
        title: tab.title,
        active: tab.active,
        configId: tab.configId,
        configName: tab.configName,
        parentTabId: tab.parentTabId,
        childTabIds: tab.childTabIds,
      })),
    };
  }

  // POST /api/tabs
  private async handleCreateTab(body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { url, appId, configId, configName, name, session: sessionParam } = body;
    if (!url) {
      return { success: false, error: 'url is required' };
    }

    // 缓存/会话 ID 优先级：
    // 1. 显式传入的 configId 或 session 参数
    // 2. 使用 AI 默认缓存 "ai-default"（确保 AI 创建的 tab 复用同一缓存）
    const sessionId = configId || sessionParam || 'ai-default';

    // 解析 URL 获取 host（用于复用判断）
    let targetHost: string;
    try {
      const parsedUrl = new URL(url);
      targetHost = parsedUrl.host; // 包含端口号
    } catch {
      return { success: false, error: 'Invalid URL' };
    }

    // 查找是否有相同 host + session 的已有标签页
    const existingTabs = await this.tabManager.listTabs();
    const matchingTab = existingTabs.find((tab) => {
      // 检查 session/configId 是否匹配
      if (tab.configId !== sessionId) return false;
      // 检查 host 是否匹配
      try {
        const tabHost = new URL(tab.url).host;
        return tabHost === targetHost;
      } catch {
        return false;
      }
    });

    // 如果找到匹配的标签页，复用它（导航到新 URL）
    if (matchingTab) {
      // 导航到新 URL
      await this.tabManager.navigateTab(matchingTab.id, url);
      // 激活该标签页
      await this.tabManager.activateTab(matchingTab.id);
      return {
        success: true,
        data: {
          id: matchingTab.id,
          appId: matchingTab.appId,
          appName: matchingTab.configName,
          url: url,
          title: matchingTab.title,
          session: sessionId,
          reused: true, // 标记为复用
        },
      };
    }

    // 没有匹配的标签页，创建新的
    // 确保应用存在，不存在则自动创建
    const appName = name || configName || appId || 'CLI App';
    const appInfo = AppStorage.ensureApp(appId || '', url, appName);

    // 通知渲染进程应用列表已更新（可能创建了新应用）
    this.notifyAppsUpdated();

    const tabConfigName = configName || appInfo.name;
    const tab = await this.tabManager.createTab(appInfo.id, url, sessionId, tabConfigName);
    return {
      success: true,
      data: {
        id: tab.id,
        appId: appInfo.id,
        appName: appInfo.name,
        url: tab.url,
        title: tab.title,
        session: sessionId,
        reused: false,
      },
    };
  }

  // DELETE /api/tabs/:id
  private async handleCloseTab(tabId: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const result = await this.tabManager.closeTab(tabId);
    return {
      success: result,
      data: result ? { closed: tabId } : undefined,
      error: result ? undefined : 'Tab not found',
    };
  }

  // POST /api/tabs/:id/navigate
  private async handleNavigate(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { url } = body;
    if (!url) {
      return { success: false, error: 'url is required' };
    }
    const result = await this.tabManager.navigateTab(tabId, url);
    return {
      success: result,
      data: result ? { navigated: url } : undefined,
      error: result ? undefined : 'Tab not found',
    };
  }

  // GET /api/tabs/:id/screenshot
  private async handleScreenshot(tabId: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    try {
      // 通过 TabManager 获取 view 并截图
      const screenshot = await (this.tabManager as any).captureScreenshot(tabId);
      if (!screenshot) {
        return { success: false, error: 'Tab not found or screenshot failed' };
      }
      return {
        success: true,
        data: {
          image: screenshot,
          format: 'png',
          encoding: 'base64',
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // GET /api/tabs/:id/snapshot
  private async handleSnapshot(tabId: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    try {
      // 执行 JS 获取页面信息
      const script = `
        (function() {
          const getSnapshot = (el, depth = 0) => {
            if (depth > 5) return null;
            const tag = el.tagName?.toLowerCase() || '';
            const text = el.innerText?.slice(0, 100) || '';
            const children = [];
            if (el.children && depth < 3) {
              for (let i = 0; i < Math.min(el.children.length, 20); i++) {
                const child = getSnapshot(el.children[i], depth + 1);
                if (child) children.push(child);
              }
            }
            return { tag, text: text.trim(), children: children.length ? children : undefined };
          };
          return {
            url: location.href,
            title: document.title,
            body: getSnapshot(document.body),
          };
        })()
      `;
      const result = await this.tabManager.executeScript(tabId, script);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // POST /api/tabs/:id/execute
  private async handleExecute(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { script } = body;
    if (!script) {
      return { success: false, error: 'script is required' };
    }
    try {
      const result = await this.tabManager.executeScript(tabId, script);
      return { success: true, data: { result } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // GET /api/tabs/:id/console
  private async handleConsole(tabId: string, level?: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }

    const logs = this.tabManager.getConsoleLogs(tabId, level);
    return {
      success: true,
      data: logs,
    };
  }

  // POST /api/tabs/:id/upload
  private async handleUpload(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { files } = body;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return { success: false, error: 'files array is required' };
    }
    const result = await this.tabManager.uploadFiles(tabId, files);
    return {
      success: result.success,
      data: result.success ? { count: result.count, message: result.message } : undefined,
      error: result.success ? undefined : result.message,
    };
  }

  // POST /api/tabs/:id/click
  private async handleClick(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { selector } = body;
    if (!selector) {
      return { success: false, error: 'selector is required' };
    }
    const result = await this.tabManager.clickElement(tabId, selector);
    return {
      success: result.success,
      data: result.success ? { message: result.message } : undefined,
      error: result.success ? undefined : result.message,
    };
  }

  // POST /api/tabs/:id/type
  private async handleType(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { selector, text, clear = false } = body;
    if (!selector) {
      return { success: false, error: 'selector is required' };
    }
    if (text === undefined) {
      return { success: false, error: 'text is required' };
    }
    const result = await this.tabManager.typeText(tabId, selector, text, clear);
    return {
      success: result.success,
      data: result.success ? { message: result.message } : undefined,
      error: result.success ? undefined : result.message,
    };
  }

  // POST /api/tabs/:id/wait-element
  private async handleWaitElement(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { selector, timeout = 30000, visible = false } = body;
    if (!selector) {
      return { success: false, error: 'selector is required' };
    }
    const result = await this.tabManager.waitForElement(tabId, selector, timeout, visible);
    return {
      success: result.success,
      data: { message: result.message, elapsed: result.elapsed },
      error: result.success ? undefined : result.message,
    };
  }

  // POST /api/tabs/:id/wait-text
  private async handleWaitText(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { text, timeout = 30000, selector } = body;
    if (!text) {
      return { success: false, error: 'text is required' };
    }
    const result = await this.tabManager.waitForText(tabId, text, timeout, selector);
    return {
      success: result.success,
      data: { message: result.message, elapsed: result.elapsed, matchedText: result.matchedText },
      error: result.success ? undefined : result.message,
    };
  }

  // POST /api/tabs/:id/network/start
  private async handleNetworkStart(tabId: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const result = await this.tabManager.startNetworkMonitoring(tabId);
    return {
      success: result.success,
      data: result.success ? { message: result.message } : undefined,
      error: result.success ? undefined : result.message,
    };
  }

  // POST /api/tabs/:id/network/stop
  private async handleNetworkStop(tabId: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const result = await this.tabManager.stopNetworkMonitoring(tabId);
    return {
      success: result.success,
      data: result.success ? { message: result.message } : undefined,
      error: result.success ? undefined : result.message,
    };
  }

  // GET /api/tabs/:id/network
  private async handleNetworkGet(tabId: string, filter?: { url?: string; method?: string; status?: number }): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const requests = this.tabManager.getNetworkRequests(tabId, filter);
    return {
      success: true,
      data: requests,
    };
  }

  // DELETE /api/tabs/:id/network
  private async handleNetworkClear(tabId: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    this.tabManager.clearNetworkRequests(tabId);
    return {
      success: true,
      data: { message: 'Network requests cleared' },
    };
  }

  // POST /api/tabs/:id/network/wait
  private async handleNetworkWait(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { url: urlPattern, timeout = 30000 } = body;
    if (!urlPattern) {
      return { success: false, error: 'url pattern is required' };
    }
    const result = await this.tabManager.waitForRequest(tabId, urlPattern, timeout);
    return {
      success: result.success,
      data: { message: result.message, elapsed: result.elapsed, request: result.request },
      error: result.success ? undefined : result.message,
    };
  }

  // GET /api/tabs/:id/cookies
  private async handleGetCookies(tabId: string, url?: string, name?: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const result = await this.tabManager.getCookies(tabId, url, name);
    return {
      success: result.success,
      data: result.cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        expirationDate: c.expirationDate,
        sameSite: c.sameSite,
      })),
      error: result.success ? undefined : result.message,
    };
  }

  // POST /api/tabs/:id/cookies
  private async handleSetCookie(tabId: string, body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { name, value, url, domain, path, secure, httpOnly, expirationDate, sameSite } = body;
    if (!name) {
      return { success: false, error: 'name is required' };
    }
    if (value === undefined) {
      return { success: false, error: 'value is required' };
    }
    const result = await this.tabManager.setCookie(tabId, { name, value, url, domain, path, secure, httpOnly, expirationDate, sameSite });
    return {
      success: result.success,
      data: result.success ? { message: result.message } : undefined,
      error: result.success ? undefined : result.message,
    };
  }

  // DELETE /api/tabs/:id/cookies?name=xxx
  private async handleRemoveCookie(tabId: string, url: string | undefined, name: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const result = await this.tabManager.removeCookie(tabId, url, name);
    return {
      success: result.success,
      data: result.success ? { message: result.message } : undefined,
      error: result.success ? undefined : result.message,
    };
  }

  // DELETE /api/tabs/:id/cookies (clear all)
  private async handleClearCookies(tabId: string, url?: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const result = await this.tabManager.clearCookies(tabId, url);
    return {
      success: result.success,
      data: result.success ? { message: result.message, count: result.count } : undefined,
      error: result.success ? undefined : result.message,
    };
  }

  // GET /api/apps
  private async handleListApps(): Promise<ApiResponse> {
    const apps = AppStorage.getAllApps();
    return {
      success: true,
      data: apps.map((app) => ({
        id: app.id,
        name: app.name,
        url: app.url,
        icon: app.icon,
        color: app.color,
        isFavorite: app.isFavorite,
      })),
    };
  }

  // GET /api/apps/:id
  private async handleGetApp(appId: string): Promise<ApiResponse> {
    const app = AppStorage.getAppById(appId);
    if (!app) {
      return { success: false, error: `App '${appId}' not found` };
    }
    return {
      success: true,
      data: {
        id: app.id,
        name: app.name,
        url: app.url,
        icon: app.icon,
        color: app.color,
        isFavorite: app.isFavorite,
      },
    };
  }

  // POST /api/apps
  private async handleCreateApp(body: any): Promise<ApiResponse> {
    const { name, url, icon, color } = body;
    if (!name) {
      return { success: false, error: 'name is required' };
    }
    if (!url) {
      return { success: false, error: 'url is required' };
    }

    // 检查是否已存在同名应用
    const existing = AppStorage.getAppByName(name);
    if (existing) {
      return { success: false, error: `App '${name}' already exists with id '${existing.id}'` };
    }

    const id = AppStorage.generateAppId(name);
    const app = AppStorage.saveApp({
      id,
      name,
      url,
      icon: icon || '',
      color,
      isFavorite: false,
    });

    return {
      success: true,
      data: {
        id: app.id,
        name: app.name,
        url: app.url,
        icon: app.icon,
        color: app.color,
        message: `App '${app.name}' created`,
      },
    };
  }

  // DELETE /api/apps/:id
  private async handleDeleteApp(appId: string): Promise<ApiResponse> {
    const result = AppStorage.deleteApp(appId);
    return {
      success: result,
      data: result ? { deleted: appId } : undefined,
      error: result ? undefined : `App '${appId}' not found`,
    };
  }

  // ==================== Session API ====================

  // GET /api/sessions
  private async handleListSessions(): Promise<ApiResponse> {
    const sessions = SessionStorage.getAllSessions();
    // 标记正在运行的 session
    const runningTabs = this.tabManager ? await this.tabManager.listTabs() : [];
    const runningSessionIds = new Set(runningTabs.map(t => t.configId).filter(Boolean));

    return {
      success: true,
      data: sessions.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        note: s.note,
        partition: s.partition,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        isRunning: runningSessionIds.has(s.id),
      })),
    };
  }

  // GET /api/sessions/:id
  private async handleGetSession(sessionId: string): Promise<ApiResponse> {
    const session = SessionStorage.getSessionById(sessionId);
    if (!session) {
      return { success: false, error: `Session '${sessionId}' not found` };
    }
    return {
      success: true,
      data: session,
    };
  }

  // POST /api/sessions
  private async handleCreateSession(body: any): Promise<ApiResponse> {
    const { name, url, note } = body;
    if (!name) {
      return { success: false, error: 'name is required' };
    }
    if (!url) {
      return { success: false, error: 'url is required' };
    }

    const id = SessionStorage.generateSessionId(name);
    const session = SessionStorage.saveSession({
      id,
      name,
      url,
      note,
      partition: `persist:${id}`,
    });

    return {
      success: true,
      data: {
        ...session,
        message: `Session '${session.name}' created`,
      },
    };
  }

  // PUT /api/sessions/:id
  private async handleUpdateSession(sessionId: string, body: any): Promise<ApiResponse> {
    const existing = SessionStorage.getSessionById(sessionId);
    if (!existing) {
      return { success: false, error: `Session '${sessionId}' not found` };
    }

    const { name, url, note } = body;
    const session = SessionStorage.saveSession({
      ...existing,
      name: name ?? existing.name,
      url: url ?? existing.url,
      note: note ?? existing.note,
    });

    return {
      success: true,
      data: {
        ...session,
        message: `Session '${session.name}' updated`,
      },
    };
  }

  // DELETE /api/sessions/:id
  private async handleDeleteSession(sessionId: string): Promise<ApiResponse> {
    const result = SessionStorage.deleteSession(sessionId);
    return {
      success: result,
      data: result ? { deleted: sessionId } : undefined,
      error: result ? undefined : `Session '${sessionId}' not found`,
    };
  }

  // POST /api/sessions/:id/open
  private async handleOpenSession(sessionId: string): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }

    const session = SessionStorage.getSessionById(sessionId);
    if (!session) {
      return { success: false, error: `Session '${sessionId}' not found` };
    }

    // 更新最后使用时间
    SessionStorage.updateLastUsed(sessionId);

    // 创建 Tab
    const tab = await this.tabManager.createTab(
      session.id,
      session.url,
      session.id,
      session.name
    );

    return {
      success: true,
      data: {
        tabId: tab.id,
        sessionId: session.id,
        sessionName: session.name,
        url: session.url,
      },
    };
  }
}

// 单例
let apiServer: ApiServer | null = null;

export function getApiServer(): ApiServer {
  if (!apiServer) {
    apiServer = new ApiServer();
  }
  return apiServer;
}
