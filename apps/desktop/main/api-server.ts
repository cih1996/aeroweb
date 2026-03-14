/**
 * HTTP API Server
 * 提供 REST API 接口供 CLI/MCP 调用
 */
import * as http from 'http';
import { TabManager } from './windows/tab-manager';
import { app } from 'electron';
import * as AppStorage from './app-storage';

const API_PORT = 9528;

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class ApiServer {
  private server: http.Server | null = null;
  private tabManager: TabManager | null = null;

  constructor() {}

  setTabManager(tabManager: TabManager) {
    this.tabManager = tabManager;
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
      })),
    };
  }

  // POST /api/tabs
  private async handleCreateTab(body: any): Promise<ApiResponse> {
    if (!this.tabManager) {
      return { success: false, error: 'TabManager not initialized' };
    }
    const { url, appId, configId, configName, name } = body;
    if (!url) {
      return { success: false, error: 'url is required' };
    }

    // 确保应用存在，不存在则自动创建
    const appName = name || configName || appId || 'CLI App';
    const app = AppStorage.ensureApp(appId || '', url, appName);

    const id = configId || `tab_${app.id}_${Date.now()}`;
    const tab = await this.tabManager.createTab(app.id, url, id, configName || app.name);
    return {
      success: true,
      data: {
        id: tab.id,
        appId: app.id,
        appName: app.name,
        url: tab.url,
        title: tab.title,
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
}

// 单例
let apiServer: ApiServer | null = null;

export function getApiServer(): ApiServer {
  if (!apiServer) {
    apiServer = new ApiServer();
  }
  return apiServer;
}
