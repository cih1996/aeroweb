import * as http from 'http';

interface ApiRes<T = unknown> { success: boolean; data?: T; error?: string; }

interface TabInfo {
  id: string;
  appId: string;
  appName?: string;
  url: string;
  title: string;
  active: boolean;
  configId?: string;
  configName?: string;
  parentTabId?: string;
  childTabIds?: string[];
}

interface AppInfo {
  id: string;
  name: string;
  url: string;
  icon: string;
  color?: string;
  isFavorite: boolean;
}

interface SessionInfo {
  id: string;
  name: string;
  url: string;
  note?: string;
  partition: string;
  createdAt: number;
  lastUsedAt: number;
  isRunning?: boolean;
}

interface ConsoleLog {
  level: string;
  message: string;
  source: string;
  line: number;
  timestamp: number;
}

// 缓存服务状态，避免每次请求都检查
let serviceChecked = false;
let serviceReady = false;

class BrowserClient {
  private host = process.env.POLYWEB_HOST || '127.0.0.1';
  private port = parseInt(process.env.POLYWEB_PORT || '9528', 10);

  /**
   * 确保服务正在运行
   */
  private async ensureService(): Promise<void> {
    // 如果已经检查过且服务就绪，跳过
    if (serviceChecked && serviceReady) {
      return;
    }

    // 动态导入避免循环依赖
    const { ensureRunning } = await import('../commands/service');
    serviceReady = await ensureRunning();
    serviceChecked = true;

    if (!serviceReady) {
      throw new Error('AeroWeb 服务未运行，请先执行 polyweb start');
    }
  }

  async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    // 先确保服务运行
    await this.ensureService();

    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : undefined;
      // 分离 path 和 query string，只对 path 部分进行编码
      const [pathPart, queryPart] = path.split('?');
      const encodedPath = pathPart.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const fullPath = queryPart ? `${encodedPath}?${queryPart}` : encodedPath;
      const r = http.request({
        hostname: this.host,
        port: this.port,
        path: `/api${fullPath}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      }, res => {
        let result = '';
        res.on('data', c => result += c);
        res.on('end', () => {
          try {
            const j: ApiRes<T> = JSON.parse(result);
            j.success ? resolve(j.data as T) : reject(new Error(j.error || 'Error'));
          } catch {
            reject(new Error(`Invalid response: ${result}`));
          }
        });
      });
      r.on('error', e => {
        // 连接失败时重置状态，下次重新检查
        serviceChecked = false;
        serviceReady = false;
        reject(new Error(`Connection failed: ${e.message}`));
      });
      if (data) r.write(data);
      r.end();
    });
  }

  // 状态
  status() {
    return this.req<{ version: string; tabCount: number; activeTabId: string | null }>('GET', '/status');
  }

  // Tab 管理
  listTabs() {
    return this.req<TabInfo[]>('GET', '/tabs');
  }

  createTab(url: string, name?: string, appId?: string, session?: string) {
    return this.req<TabInfo>('POST', '/tabs', { url, name, appId, session });
  }

  closeTab(tabId: string) {
    return this.req<{ closed: string }>('DELETE', `/tabs/${tabId}`);
  }

  // 导航
  navigate(tabId: string, url: string) {
    return this.req<{ navigated: string }>('POST', `/tabs/${tabId}/navigate`, { url });
  }

  // 截图
  screenshot(tabId: string) {
    return this.req<{ image: string; format: string; encoding: string }>('GET', `/tabs/${tabId}/screenshot`);
  }

  // 快照
  snapshot(tabId: string) {
    return this.req<{ url: string; title: string; body: any }>('GET', `/tabs/${tabId}/snapshot`);
  }

  // 执行脚本
  execute(tabId: string, script: string) {
    return this.req<{ result: any }>('POST', `/tabs/${tabId}/execute`, { script });
  }

  // 控制台日志
  console(tabId: string, level?: string) {
    const query = level ? `?level=${level}` : '';
    return this.req<ConsoleLog[]>('GET', `/tabs/${tabId}/console${query}`);
  }

  // 文件上传
  upload(tabId: string, files: string[]) {
    return this.req<{ count: number; message: string }>('POST', `/tabs/${tabId}/upload`, { files });
  }

  // 点击元素
  click(tabId: string, selector: string) {
    return this.req<{ message: string }>('POST', `/tabs/${tabId}/click`, { selector });
  }

  // 输入文本
  type(tabId: string, selector: string, text: string, clear?: boolean) {
    return this.req<{ message: string }>('POST', `/tabs/${tabId}/type`, { selector, text, clear });
  }

  // 等待元素
  waitElement(tabId: string, selector: string, timeout?: number, visible?: boolean) {
    return this.req<{ message: string; elapsed: number }>('POST', `/tabs/${tabId}/wait-element`, { selector, timeout, visible });
  }

  // 等待文本
  waitText(tabId: string, text: string, timeout?: number, selector?: string) {
    return this.req<{ message: string; elapsed: number; matchedText?: string }>('POST', `/tabs/${tabId}/wait-text`, { text, timeout, selector });
  }

  // 网络监控 - 启动
  networkStart(tabId: string) {
    return this.req<{ message: string }>('POST', `/tabs/${tabId}/network/start`);
  }

  // 网络监控 - 停止
  networkStop(tabId: string) {
    return this.req<{ message: string }>('POST', `/tabs/${tabId}/network/stop`);
  }

  // 网络监控 - 获取请求
  networkGet(tabId: string, filter?: { url?: string; method?: string; status?: number }) {
    const params = new URLSearchParams();
    if (filter?.url) params.set('url', filter.url);
    if (filter?.method) params.set('method', filter.method);
    if (filter?.status !== undefined) params.set('status', String(filter.status));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.req<any[]>('GET', `/tabs/${tabId}/network${query}`);
  }

  // 网络监控 - 清空
  networkClear(tabId: string) {
    return this.req<{ message: string }>('DELETE', `/tabs/${tabId}/network`);
  }

  // 网络监控 - 等待请求
  networkWait(tabId: string, urlPattern: string, timeout?: number) {
    return this.req<{ message: string; elapsed: number; request?: any }>('POST', `/tabs/${tabId}/network/wait`, { url: urlPattern, timeout });
  }

  // Cookie - 获取
  getCookies(tabId: string, url?: string, name?: string) {
    const params = new URLSearchParams();
    if (url) params.set('url', url);
    if (name) params.set('name', name);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.req<any[]>('GET', `/tabs/${tabId}/cookies${query}`);
  }

  // Cookie - 设置
  setCookie(tabId: string, cookie: { name: string; value: string; url?: string; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean; expirationDate?: number; sameSite?: string }) {
    return this.req<{ message: string }>('POST', `/tabs/${tabId}/cookies`, cookie);
  }

  // Cookie - 删除单个
  removeCookie(tabId: string, name: string, url?: string) {
    const params = new URLSearchParams();
    params.set('name', name);
    if (url) params.set('url', url);
    return this.req<{ message: string }>('DELETE', `/tabs/${tabId}/cookies?${params.toString()}`);
  }

  // Cookie - 清空所有
  clearCookies(tabId: string, url?: string) {
    const query = url ? `?url=${encodeURIComponent(url)}` : '';
    return this.req<{ message: string; count: number }>('DELETE', `/tabs/${tabId}/cookies${query}`);
  }

  // 应用管理
  listApps() {
    return this.req<AppInfo[]>('GET', '/apps');
  }

  getApp(appId: string) {
    return this.req<AppInfo>('GET', `/apps/${appId}`);
  }

  createApp(name: string, url: string, icon?: string, color?: string) {
    return this.req<AppInfo & { message: string }>('POST', '/apps', { name, url, icon, color });
  }

  deleteApp(appId: string) {
    return this.req<{ deleted: string }>('DELETE', `/apps/${appId}`);
  }

  // Session 管理
  listSessions() {
    return this.req<SessionInfo[]>('GET', '/sessions');
  }

  getSession(sessionId: string) {
    return this.req<SessionInfo>('GET', `/sessions/${sessionId}`);
  }

  createSession(name: string, url: string, note?: string) {
    return this.req<SessionInfo & { message: string }>('POST', '/sessions', { name, url, note });
  }

  updateSession(sessionId: string, data: { name?: string; url?: string; note?: string }) {
    return this.req<SessionInfo & { message: string }>('PUT', `/sessions/${sessionId}`, data);
  }

  deleteSession(sessionId: string) {
    return this.req<{ deleted: string }>('DELETE', `/sessions/${sessionId}`);
  }

  openSession(sessionId: string) {
    return this.req<{ tabId: string; sessionId: string; sessionName: string; url: string }>('POST', `/sessions/${sessionId}/open`);
  }
}

export const client = new BrowserClient();
