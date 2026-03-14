/**
 * 浏览器服务客户端 - 适配 /api/tabs 路由
 */

import * as http from 'http';

interface ApiRes<T = unknown> { success: boolean; data?: T; error?: string; }

interface TabInfo {
  id: string;
  appId: string;
  url: string;
  title: string;
  active: boolean;
  configId?: string;
  configName?: string;
}

interface ConsoleLog {
  level: string;
  message: string;
  source: string;
  line: number;
  timestamp: number;
}

export class BrowserClient {
  private host = process.env.POLYWEB_HOST || '127.0.0.1';
  private port = parseInt(process.env.POLYWEB_PORT || '9528', 10);

  async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : undefined;
      // 对 path 进行 URL 编码，处理中文等特殊字符
      const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const r = http.request({
        hostname: this.host,
        port: this.port,
        path: `/api${encodedPath}`,
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
      r.on('error', e => reject(new Error(`Connection failed: ${e.message}. Is PolyWebsAI running?`)));
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

  createTab(url: string, appId = 'mcp', configName?: string) {
    return this.req<TabInfo>('POST', '/tabs', { url, appId, configName });
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
}
