/**
 * HTTP API Server
 * 提供 REST API 接口供 CLI/MCP 调用
 */
import * as http from 'http';
import { TabManager } from './windows/tab-manager';
import { app } from 'electron';

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
        const tabId = pathname.split('/')[3];
        response = await this.handleCloseTab(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/navigate$/) && method === 'POST') {
        const tabId = pathname.split('/')[3];
        const body = await this.parseBody(req);
        response = await this.handleNavigate(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/screenshot$/) && method === 'GET') {
        const tabId = pathname.split('/')[3];
        response = await this.handleScreenshot(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/snapshot$/) && method === 'GET') {
        const tabId = pathname.split('/')[3];
        response = await this.handleSnapshot(tabId);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/execute$/) && method === 'POST') {
        const tabId = pathname.split('/')[3];
        const body = await this.parseBody(req);
        response = await this.handleExecute(tabId, body);
      } else if (pathname.match(/^\/api\/tabs\/[^/]+\/console$/) && method === 'GET') {
        const tabId = pathname.split('/')[3];
        const level = url.searchParams.get('level') || undefined;
        response = await this.handleConsole(tabId, level);
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
    const { url, appId = 'api', configId, configName } = body;
    if (!url) {
      return { success: false, error: 'url is required' };
    }
    const id = configId || `api_${Date.now()}`;
    const tab = await this.tabManager.createTab(appId, url, id, configName || 'API Tab');
    return {
      success: true,
      data: {
        id: tab.id,
        appId: tab.appId,
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
}

// 单例
let apiServer: ApiServer | null = null;

export function getApiServer(): ApiServer {
  if (!apiServer) {
    apiServer = new ApiServer();
  }
  return apiServer;
}
