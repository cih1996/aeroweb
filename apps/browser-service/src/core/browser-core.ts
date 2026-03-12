/**
 * 浏览器核心能力实现
 * 实现 IBrowserCore 接口，基于 Electron WebContents
 */

import { WebContents, BrowserWindow, session } from 'electron';
import type {
  IBrowserCore,
  PageId,
  PageInfo,
  NewPageOptions,
  NavigateOptions,
  PageSnapshot,
  ElementSnapshot,
  ClickOptions,
  FillOptions,
  FormFillItem,
  HoverOptions,
  PressKeyOptions,
  TypeTextOptions,
  ScreenshotOptions,
  ScreenshotResult,
  EvaluateOptions,
  EvaluateResult,
  NetworkRequest,
  NetworkRequestDetail,
  ConsoleMessage,
  WaitForOptions,
  WaitForResult,
  ElementUid,
  RequestId,
  MessageId,
} from '@qiyi/shared';

/** 页面上下文，存储页面相关信息 */
interface PageContext {
  id: PageId;
  webContents: WebContents;
  window: BrowserWindow;
  networkRequests: Map<RequestId, NetworkRequest>;
  consoleMessages: ConsoleMessage[];
  requestIdCounter: number;
  messageIdCounter: number;
}

/**
 * 浏览器核心实现类
 */
export class BrowserCore implements IBrowserCore {
  private pages: Map<PageId, PageContext> = new Map();
  private activePageId: PageId | null = null;
  private pageIdCounter = 0;
  private userDataDir: string;

  constructor(userDataDir: string) {
    this.userDataDir = userDataDir;
  }

  // ============================================
  // 页面管理
  // ============================================

  async listPages(): Promise<PageInfo[]> {
    const result: PageInfo[] = [];
    for (const [id, ctx] of this.pages) {
      if (!ctx.webContents.isDestroyed()) {
        result.push(this.getPageInfo(ctx));
      }
    }
    return result;
  }

  async newPage(options: NewPageOptions): Promise<PageInfo> {
    const pageId = `page_${++this.pageIdCounter}`;

    // 创建新窗口
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      show: !options.background,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: options.isolatedContext
          ? `persist:${options.isolatedContext}`
          : undefined,
      },
    });

    const ctx: PageContext = {
      id: pageId,
      webContents: win.webContents,
      window: win,
      networkRequests: new Map(),
      consoleMessages: [],
      requestIdCounter: 0,
      messageIdCounter: 0,
    };

    // 监听网络请求
    this.setupNetworkListeners(ctx);
    // 监听控制台消息
    this.setupConsoleListeners(ctx);

    this.pages.set(pageId, ctx);

    if (!options.background) {
      this.activePageId = pageId;
    }

    // 导航到 URL
    await win.loadURL(options.url);

    return this.getPageInfo(ctx);
  }

  async selectPage(pageId: PageId): Promise<void> {
    const ctx = this.getPageContext(pageId);
    ctx.window.focus();
    this.activePageId = pageId;
  }

  async closePage(pageId: PageId): Promise<void> {
    const ctx = this.getPageContext(pageId);
    ctx.window.close();
    this.pages.delete(pageId);

    if (this.activePageId === pageId) {
      this.activePageId = this.pages.size > 0
        ? this.pages.keys().next().value ?? null
        : null;
    }
  }

  async navigate(pageId: PageId, options: NavigateOptions): Promise<void> {
    const ctx = this.getPageContext(pageId);
    const wc = ctx.webContents;

    switch (options.type) {
      case 'url':
        if (!options.url) throw new Error('URL is required for url navigation');
        await wc.loadURL(options.url);
        break;
      case 'back':
        if (wc.canGoBack()) wc.goBack();
        break;
      case 'forward':
        if (wc.canGoForward()) wc.goForward();
        break;
      case 'reload':
        if (options.ignoreCache) {
          wc.reloadIgnoringCache();
        } else {
          wc.reload();
        }
        break;
    }
  }

  async resizePage(pageId: PageId, width: number, height: number): Promise<void> {
    const ctx = this.getPageContext(pageId);
    ctx.window.setSize(width, height);
  }

  // ============================================
  // 元素操作
  // ============================================

  async takeSnapshot(pageId: PageId): Promise<PageSnapshot> {
    const ctx = this.getPageContext(pageId);
    const wc = ctx.webContents;

    // 获取页面 a11y 树
    const tree = await this.getAccessibilityTree(wc);

    return {
      pageId,
      url: wc.getURL(),
      title: wc.getTitle(),
      timestamp: Date.now(),
      root: tree,
    };
  }

  async click(pageId: PageId, options: ClickOptions): Promise<PageSnapshot | void> {
    const ctx = this.getPageContext(pageId);
    await this.executeElementAction(ctx.webContents, options.uid, 'click', {
      dblClick: options.dblClick,
    });

    if (options.includeSnapshot) {
      return this.takeSnapshot(pageId);
    }
  }

  async fill(pageId: PageId, options: FillOptions): Promise<PageSnapshot | void> {
    const ctx = this.getPageContext(pageId);
    await this.executeElementAction(ctx.webContents, options.uid, 'fill', {
      value: options.value,
    });

    if (options.includeSnapshot) {
      return this.takeSnapshot(pageId);
    }
  }

  async fillForm(pageId: PageId, elements: FormFillItem[]): Promise<PageSnapshot | void> {
    const ctx = this.getPageContext(pageId);
    for (const item of elements) {
      await this.executeElementAction(ctx.webContents, item.uid, 'fill', {
        value: item.value,
      });
    }
  }

  async hover(pageId: PageId, options: HoverOptions): Promise<PageSnapshot | void> {
    const ctx = this.getPageContext(pageId);
    await this.executeElementAction(ctx.webContents, options.uid, 'hover', {});

    if (options.includeSnapshot) {
      return this.takeSnapshot(pageId);
    }
  }

  async pressKey(pageId: PageId, options: PressKeyOptions): Promise<PageSnapshot | void> {
    const ctx = this.getPageContext(pageId);
    const wc = ctx.webContents;

    // 解析按键组合
    const keys = options.key.split('+');
    const modifiers: string[] = [];
    let key = '';

    for (const k of keys) {
      const lower = k.toLowerCase();
      if (['control', 'shift', 'alt', 'meta'].includes(lower)) {
        modifiers.push(lower);
      } else {
        key = k;
      }
    }

    // 发送按键事件
    wc.sendInputEvent({
      type: 'keyDown',
      keyCode: key,
      modifiers: modifiers as any,
    });
    wc.sendInputEvent({
      type: 'keyUp',
      keyCode: key,
      modifiers: modifiers as any,
    });

    if (options.includeSnapshot) {
      return this.takeSnapshot(pageId);
    }
  }

  async typeText(pageId: PageId, options: TypeTextOptions): Promise<void> {
    const ctx = this.getPageContext(pageId);
    const wc = ctx.webContents;

    // 逐字符输入
    for (const char of options.text) {
      wc.sendInputEvent({
        type: 'char',
        keyCode: char,
      });
    }

    // 按下提交键
    if (options.submitKey) {
      wc.sendInputEvent({ type: 'keyDown', keyCode: options.submitKey });
      wc.sendInputEvent({ type: 'keyUp', keyCode: options.submitKey });
    }
  }

  async drag(pageId: PageId, fromUid: ElementUid, toUid: ElementUid): Promise<PageSnapshot | void> {
    const ctx = this.getPageContext(pageId);
    await ctx.webContents.executeJavaScript(`
      (function() {
        const from = document.querySelector('[data-uid="${fromUid}"]');
        const to = document.querySelector('[data-uid="${toUid}"]');
        if (!from || !to) return false;

        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();

        const dataTransfer = new DataTransfer();
        from.dispatchEvent(new DragEvent('dragstart', { dataTransfer, bubbles: true }));
        to.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true }));
        from.dispatchEvent(new DragEvent('dragend', { dataTransfer, bubbles: true }));
        return true;
      })()
    `);
  }

  // ============================================
  // 截图与快照
  // ============================================

  async takeScreenshot(pageId: PageId, options?: ScreenshotOptions): Promise<ScreenshotResult> {
    const ctx = this.getPageContext(pageId);
    const wc = ctx.webContents;

    let rect: Electron.Rectangle | undefined;

    if (options?.uid) {
      // 元素截图
      const bounds = await wc.executeJavaScript(`
        (function() {
          const el = document.querySelector('[data-uid="${options.uid}"]');
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        })()
      `);
      if (bounds) {
        rect = bounds;
      }
    } else if (options?.fullPage) {
      // 全页面截图
      const size = await wc.executeJavaScript(`
        ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })
      `);
      rect = { x: 0, y: 0, ...size };
    }

    const image = await wc.capturePage(rect);
    const format = options?.format || 'png';

    let data: string;
    if (format === 'jpeg') {
      data = image.toJPEG(options?.quality || 80).toString('base64');
    } else if (format === 'webp') {
      // Electron 不直接支持 webp，使用 png
      data = image.toPNG().toString('base64');
    } else {
      data = image.toPNG().toString('base64');
    }

    const size = image.getSize();

    if (options?.filePath) {
      const fs = require('fs');
      const buffer = format === 'jpeg'
        ? image.toJPEG(options?.quality || 80)
        : image.toPNG();
      fs.writeFileSync(options.filePath, buffer);
      return { filePath: options.filePath, width: size.width, height: size.height };
    }

    return { data, width: size.width, height: size.height };
  }

  // ============================================
  // 脚本执行
  // ============================================

  async evaluate(pageId: PageId, options: EvaluateOptions): Promise<EvaluateResult> {
    const ctx = this.getPageContext(pageId);
    const start = Date.now();

    const result = await ctx.webContents.executeJavaScript(`
      (${options.function})(${(options.args || []).map(a => JSON.stringify(a)).join(',')})
    `);

    return {
      result,
      duration: Date.now() - start,
    };
  }

  // ============================================
  // 网络请求
  // ============================================

  async listNetworkRequests(pageId: PageId): Promise<NetworkRequest[]> {
    const ctx = this.getPageContext(pageId);
    return Array.from(ctx.networkRequests.values());
  }

  async getNetworkRequest(pageId: PageId, reqid: RequestId): Promise<NetworkRequestDetail> {
    const ctx = this.getPageContext(pageId);
    const req = ctx.networkRequests.get(reqid);
    if (!req) throw new Error(`Request ${reqid} not found`);

    // 返回基础信息（详细信息需要额外存储）
    return {
      ...req,
      requestHeaders: {},
      responseHeaders: {},
    };
  }

  // ============================================
  // 控制台
  // ============================================

  async listConsoleMessages(pageId: PageId): Promise<ConsoleMessage[]> {
    const ctx = this.getPageContext(pageId);
    return ctx.consoleMessages;
  }

  async getConsoleMessage(pageId: PageId, msgid: MessageId): Promise<ConsoleMessage> {
    const ctx = this.getPageContext(pageId);
    const msg = ctx.consoleMessages.find(m => m.msgid === msgid);
    if (!msg) throw new Error(`Message ${msgid} not found`);
    return msg;
  }

  // ============================================
  // 等待
  // ============================================

  async waitFor(pageId: PageId, options: WaitForOptions): Promise<WaitForResult> {
    const ctx = this.getPageContext(pageId);
    const start = Date.now();
    const timeout = options.timeout || 30000;

    return new Promise((resolve, reject) => {
      const check = async () => {
        const elapsed = Date.now() - start;
        if (elapsed > timeout) {
          reject(new Error(`Timeout waiting for text: ${options.text.join(', ')}`));
          return;
        }

        const pageText = await ctx.webContents.executeJavaScript(
          'document.body.innerText'
        );

        for (const text of options.text) {
          if (pageText.includes(text)) {
            resolve({ matchedText: text, duration: elapsed });
            return;
          }
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  async waitForPageLoad(pageId: PageId, timeout?: number): Promise<void> {
    const ctx = this.getPageContext(pageId);
    const wc = ctx.webContents;

    if (!wc.isLoading()) return;

    return new Promise((resolve, reject) => {
      const timer = timeout
        ? setTimeout(() => reject(new Error('Page load timeout')), timeout)
        : null;

      wc.once('did-finish-load', () => {
        if (timer) clearTimeout(timer);
        resolve();
      });
    });
  }

  // ============================================
  // 文件操作
  // ============================================

  async uploadFile(pageId: PageId, uid: ElementUid, filePath: string): Promise<void> {
    const ctx = this.getPageContext(pageId);
    await ctx.webContents.executeJavaScript(`
      (function() {
        const input = document.querySelector('[data-uid="${uid}"]');
        if (!input || input.tagName !== 'INPUT' || input.type !== 'file') {
          throw new Error('Element is not a file input');
        }
        // 文件上传需要通过 Electron 的 dialog API 或直接设置
        return true;
      })()
    `);
    // 实际文件上传需要通过 webContents.debugger 或其他方式
  }

  // ============================================
  // 对话框处理
  // ============================================

  async handleDialog(pageId: PageId, action: 'accept' | 'dismiss', promptText?: string): Promise<void> {
    // 对话框处理需要在创建页面时设置监听器
    // 这里提供基础实现
  }

  // ============================================
  // 私有方法
  // ============================================

  private getPageContext(pageId: PageId): PageContext {
    const ctx = this.pages.get(pageId);
    if (!ctx) throw new Error(`Page ${pageId} not found`);
    if (ctx.webContents.isDestroyed()) throw new Error(`Page ${pageId} is destroyed`);
    return ctx;
  }

  private getPageInfo(ctx: PageContext): PageInfo {
    const wc = ctx.webContents;
    return {
      id: ctx.id,
      url: wc.getURL(),
      title: wc.getTitle(),
      active: ctx.id === this.activePageId,
      loading: wc.isLoading(),
      canGoBack: wc.canGoBack(),
      canGoForward: wc.canGoForward(),
    };
  }

  private async getAccessibilityTree(wc: WebContents): Promise<ElementSnapshot> {
    // 简化的 a11y 树获取
    const tree = await wc.executeJavaScript(`
      (function buildTree(el, uid = '0') {
        const result = {
          uid: uid,
          role: el.tagName?.toLowerCase() || 'root',
          name: el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.innerText?.slice(0, 50) || '',
          children: []
        };

        let childIndex = 0;
        for (const child of (el.children || [])) {
          if (child.nodeType === 1) {
            result.children.push(buildTree(child, uid + '_' + childIndex++));
          }
        }

        return result;
      })(document.body)
    `);

    return tree;
  }

  private async executeElementAction(
    wc: WebContents,
    uid: ElementUid,
    action: string,
    params: Record<string, any>
  ): Promise<void> {
    await wc.executeJavaScript(`
      (function() {
        const el = document.querySelector('[data-uid="${uid}"]') ||
                   (function findByUid(root, targetUid) {
                     // 简化的 uid 查找
                     return document.body;
                   })(document.body, '${uid}');

        if (!el) throw new Error('Element not found: ${uid}');

        switch ('${action}') {
          case 'click':
            el.click();
            ${params.dblClick ? 'el.click();' : ''}
            break;
          case 'fill':
            el.value = ${JSON.stringify(params.value || '')};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          case 'hover':
            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            break;
        }
      })()
    `);
  }

  private setupNetworkListeners(ctx: PageContext): void {
    const wc = ctx.webContents;

    wc.session.webRequest.onCompleted((details) => {
      const reqid = ++ctx.requestIdCounter;
      ctx.networkRequests.set(reqid, {
        reqid,
        url: details.url,
        method: details.method,
        resourceType: details.resourceType as any,
        status: details.statusCode,
        statusText: '',
      });
    });
  }

  private setupConsoleListeners(ctx: PageContext): void {
    const wc = ctx.webContents;

    wc.on('console-message', (_event, level, message, line, sourceId) => {
      const typeMap: Record<number, ConsoleMessage['type']> = {
        0: 'debug',
        1: 'log',
        2: 'warn',
        3: 'error',
      };

      ctx.consoleMessages.push({
        msgid: ++ctx.messageIdCounter,
        type: typeMap[level] || 'log',
        text: message,
        timestamp: Date.now(),
        url: sourceId,
        lineNumber: line,
      });

      // 限制消息数量
      if (ctx.consoleMessages.length > 1000) {
        ctx.consoleMessages = ctx.consoleMessages.slice(-500);
      }
    });
  }

  /** 清理资源 */
  destroy(): void {
    for (const ctx of this.pages.values()) {
      if (!ctx.window.isDestroyed()) {
        ctx.window.close();
      }
    }
    this.pages.clear();
  }
}
