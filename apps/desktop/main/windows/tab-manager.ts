import { BrowserWindow, BrowserView, session, dialog, app } from 'electron';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';
import { BrowserService } from '@qiyi/browser-service';
import type { Tab } from '@qiyi/shared';
import { FileUploadInterceptor } from './file-upload-interceptor';
import { DownloadManager } from './download-manager';

// 控制台日志条目
interface ConsoleLogEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  source: string;
  line: number;
  timestamp: number;
}

// 网络请求条目
interface NetworkRequestEntry {
  id: string;
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  startTime: number;
  endTime?: number;
  duration?: number;
  size?: number;
  error?: string;
}

export class TabManager {
  private tabs: Map<string, Tab> = new Map();
  private views: Map<string, BrowserView> = new Map();
  private sessions: Map<string, Electron.Session> = new Map(); // 存储每个 tab 的独立 session
  private activeTabId: string | null = null;
  private mainWindow: BrowserWindow;
  private browserService: BrowserService;
  private hiddenTabId: string | null = null; // 记录临时隐藏的 tab ID
  // 文件上传拦截器
  private fileUploadInterceptors: Map<string, FileUploadInterceptor> = new Map();
  // 下载管理器
  private downloadManager: DownloadManager;
  // 控制台日志存储（每个 tab 最多 100 条）
  private consoleLogs: Map<string, ConsoleLogEntry[]> = new Map();
  private readonly MAX_CONSOLE_LOGS = 100;
  // 网络请求存储（每个 tab 最多 200 条）
  private networkRequests: Map<string, NetworkRequestEntry[]> = new Map();
  private readonly MAX_NETWORK_REQUESTS = 200;
  // 网络监控状态
  private networkMonitoringTabs: Set<string> = new Set();

  constructor(mainWindow: BrowserWindow, browserService: BrowserService, downloadManager: DownloadManager) {
    this.mainWindow = mainWindow;
    this.browserService = browserService;
    this.downloadManager = downloadManager;
  }

  async createTab(appId: string, url: string, configId?: string, configName?: string, parentTabId?: string): Promise<Tab> {
    // 如果没有 configId，生成一个唯一的
    const sessionId = configId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 子标签页使用不同的 ID 格式
    const tabId = parentTabId
      ? `subtab_${sessionId}_${Date.now()}`
      : `tab_${sessionId}`;

    // 子标签页继承父标签页的 partition（共享缓存/登录状态）
    let partitionId: string;
    let tabSession: Electron.Session;

    if (parentTabId) {
      const parentSession = this.sessions.get(parentTabId);
      if (parentSession) {
        tabSession = parentSession;
        // 从父标签获取 partition
        const parentTab = this.tabs.get(parentTabId);
        partitionId = `persist:${parentTab?.configId || sessionId}`;
      } else {
        partitionId = `persist:${sessionId}`;
        tabSession = session.fromPartition(partitionId);
      }
    } else {
      partitionId = `persist:${sessionId}`;
      tabSession = session.fromPartition(partitionId);

      // 为独立的 session 设置 User-Agent
      const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
      tabSession.setUserAgent(chromeUA);
    }

    // 存储 session 引用，以便后续清理
    this.sessions.set(tabId, tabSession);

    // 创建 BrowserView，使用独立的 session
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../../preload/index.js'),
        partition: partitionId, // 使用独立的 session partition，实现完全隔离
      },
    });

    // 拦截所有新窗口请求，创建为子标签页
    const currentTabId = tabId;
    view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      console.log('[TabManager] 拦截新窗口打开请求，创建子标签页，URL:', targetUrl);

      // 异步创建子标签页
      setTimeout(async () => {
        try {
          // 获取当前标签的根标签（如果当前是子标签，找到最顶层的父标签）
          const rootTabId = this.getRootTabId(currentTabId);
          const rootTab = this.tabs.get(rootTabId);

          await this.createTab(
            rootTab?.appId || 'popup',
            targetUrl,
            rootTab?.configId, // 继承 configId 以共享缓存
            `弹窗: ${new URL(targetUrl).hostname}`,
            rootTabId // 设置父标签
          );
        } catch (error) {
          console.error('[TabManager] 创建子标签页失败:', error);
        }
      }, 0);

      return { action: 'deny' };
    });

    // 初始化文件上传拦截器
    const interceptor = new FileUploadInterceptor(view.webContents, tabId);
    this.fileUploadInterceptors.set(tabId, interceptor);
    interceptor.setup().catch((error) => {
      console.error('[TabManager] 初始化文件上传拦截器失败:', error);
    });

    // 监听下载事件
    // 不调用 preventDefault()，让 Electron 使用默认行为（弹出保存对话框）
    // 这样可以确保下载能正常进行，用户也可以修改文件名
    tabSession.on('will-download', (event, downloadItem, webContents) => {
      const url = downloadItem.getURL();
      const suggestedFilename = downloadItem.getFilename() || basename(url);
      const mimeType = downloadItem.getMimeType();
      const contentDisposition = downloadItem.getContentDisposition();
      
      // 不调用 preventDefault()，让 Electron 弹出保存对话框（第一版行为）
      // 用户选择路径后，下载会自动开始
      
      // 监听下载进度，在下载真正开始后添加到下载管理器
      // 使用 once 确保只添加一次
      let addedToManager = false;
      
      downloadItem.on('updated', () => {
        if (!addedToManager) {
          try {
            const savePath = downloadItem.getSavePath();
            if (savePath) {
              // 用户已选择保存路径，下载已开始
              this.downloadManager.addDownload(tabId, downloadItem, url);
              addedToManager = true;
            }
          } catch (error) {
            // 如果 downloadItem 已被销毁，忽略错误
          }
        }
      });
      
      // 如果下载项已经有保存路径（可能是之前设置的），立即添加到管理器
      const existingSavePath = downloadItem.getSavePath();
      if (existingSavePath) {
        try {
          this.downloadManager.addDownload(tabId, downloadItem, url);
          addedToManager = true;
        } catch (error) {
          // 如果 downloadItem 已被销毁，等待 updated 事件
        }
      }
    });

    
    // 设置视图位置和大小（为侧边栏和标题栏预留空间）
    // 子标签页需要额外预留子标签栏高度
    this.updateViewBounds(view, parentTabId ? true : false);

    // 先创建 tab 对象（用于立即返回）
    const tab: Tab = {
      id: tabId,
      appId,
      url,
      title: configName || appId,
      active: false,
      createdAt: Date.now(),
      configId,
      configName,
      parentTabId,
      childTabIds: [],
    };

    this.tabs.set(tabId, tab);
    this.views.set(tabId, view);

    // 如果是子标签页，更新父标签的 childTabIds
    if (parentTabId) {
      const parentTab = this.tabs.get(parentTabId);
      if (parentTab) {
        if (!parentTab.childTabIds) {
          parentTab.childTabIds = [];
        }
        parentTab.childTabIds.push(tabId);
        // 通知前端更新
        this.mainWindow.webContents.send('tab:update', {
          tabId: parentTabId,
          updates: { childTabIds: parentTab.childTabIds }
        });
      }
    }

    // 初始化控制台日志存储
    this.consoleLogs.set(tabId, []);

    // 监听控制台消息
    view.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // 检查 tab 是否还存在（防止销毁后触发）
      if (!this.tabs.has(tabId)) return;

      const levelMap: Record<number, ConsoleLogEntry['level']> = {
        0: 'debug',
        1: 'log',
        2: 'warn',
        3: 'error',
      };

      const logEntry: ConsoleLogEntry = {
        level: levelMap[level] || 'log',
        message,
        source: sourceId,
        line,
        timestamp: Date.now(),
      };

      const logs = this.consoleLogs.get(tabId) || [];
      logs.push(logEntry);

      // 保持最多 100 条
      if (logs.length > this.MAX_CONSOLE_LOGS) {
        logs.shift();
      }

      this.consoleLogs.set(tabId, logs);
    });

    // 监听标题变化
    view.webContents.on('page-title-updated', (_, title) => {
      // 检查 tab 是否还存在（防止销毁后触发）
      if (!this.tabs.has(tabId)) return;

      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.title = title;
        this.mainWindow.webContents.send('tab:update', { tabId, updates: { title } });
      }
    });

    // 监听页面加载完成（每次导航后都会触发）
    const handlePageLoad = async () => {
      // 检查 tab 是否还存在（防止销毁后触发）
      if (!this.tabs.has(tabId)) return;
      if (view.webContents.isDestroyed()) return;

      // 通知渲染进程页面加载完成（只在主框架加载时通知）
      if (view.webContents.getURL() && !view.webContents.getURL().startsWith('about:')) {
        this.mainWindow.webContents.send('tab:loaded', { tabId });
      }

      // 注入 JS（通过 Browser Service）
      try {
        await this.browserService.injectScript(tabId, view.webContents);
      } catch (error) {
        console.error('注入脚本失败:', error);
      }

    };

    // 监听主框架加载完成
    view.webContents.on('did-finish-load', handlePageLoad);

    // 监听 iframe 加载完成（确保所有框架都注入脚本）
    view.webContents.on('did-frame-finish-load', handlePageLoad);

    // 监听加载错误
    view.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
      // 检查 tab 是否还存在（防止销毁后触发）
      if (!this.tabs.has(tabId)) return;

      console.error('页面加载失败:', errorCode, errorDescription);
      this.mainWindow.webContents.send('tab:error', { tabId, error: errorDescription });
    });

    // 激活新创建的 Tab（这会显示 BrowserView）
    await this.activateTab(tabId);

    // 加载 URL（异步，不阻塞）
    view.webContents.loadURL(url).catch((error) => {
      console.error('加载 URL 失败:', error);
      this.mainWindow.webContents.send('tab:error', { tabId, error: error.message });
    });

    return tab;
  }

  async closeTab(tabId: string): Promise<boolean> {
    const tab = this.tabs.get(tabId);
    const view = this.views.get(tabId);

    // 如果有子标签页，先关闭所有子标签页
    if (tab?.childTabIds && tab.childTabIds.length > 0) {
      for (const childId of [...tab.childTabIds]) {
        await this.closeTab(childId);
      }
    }

    // 如果是子标签页，从父标签的 childTabIds 中移除
    if (tab?.parentTabId) {
      const parentTab = this.tabs.get(tab.parentTabId);
      if (parentTab?.childTabIds) {
        parentTab.childTabIds = parentTab.childTabIds.filter(id => id !== tabId);
        // 通知前端更新
        this.mainWindow.webContents.send('tab:update', {
          tabId: tab.parentTabId,
          updates: { childTabIds: parentTab.childTabIds }
        });
      }
    }

    // 清理文件上传拦截器
    const interceptor = this.fileUploadInterceptors.get(tabId);
    if (interceptor) {
      interceptor.cleanup();
      this.fileUploadInterceptors.delete(tabId);
    }

    
    if (view) {
      // 如果是当前激活的视图，先移除
      if (this.activeTabId === tabId) {
        this.mainWindow.setBrowserView(null);
        this.activeTabId = null;
      }

      // 显式关闭 webContents，确保彻底关闭页面（停止视频播放、网络请求等）
      try {
        const webContents = view.webContents;

        // 先移除所有事件监听器，防止销毁后触发回调
        webContents.removeAllListeners();

        // 停止所有正在进行的加载
        webContents.stop();

        // 关闭 webContents（这会停止所有 JavaScript 执行、网络请求、视频播放等）
        // 注意：close() 方法会触发 'destroyed' 事件，之后 webContents 将不再可用
        if (!webContents.isDestroyed()) {
          webContents.close();
        }
      } catch (error) {
        console.error(`[TabManager] 关闭 webContents 时出错 (tabId: ${tabId}):`, error);
      }
      
      // 从 Map 中删除引用，让垃圾回收处理 BrowserView
      // 注意：BrowserView 没有 destroy() 方法，当没有引用时会被自动回收
      this.views.delete(tabId);
    }
    
    // 清理 session（可选：如果需要立即清理缓存，可以调用 session.clearCache()）
    const tabSession = this.sessions.get(tabId);
    if (tabSession) {
      // 注意：session partition 是持久化的，关闭 tab 不会自动清理
      // 如果需要清理缓存，可以取消注释下面的代码
      // await tabSession.clearCache();
      // await tabSession.clearStorageData();
      this.sessions.delete(tabId);
    }

    // 清理控制台日志
    this.consoleLogs.delete(tabId);

    // 清理网络请求记录
    this.networkRequests.delete(tabId);
    this.networkMonitoringTabs.delete(tabId);

    this.tabs.delete(tabId);

    // 激活下一个 Tab（如果还有剩余的）
    if (this.activeTabId === null) {
      const remainingTabs = Array.from(this.tabs.values());
      if (remainingTabs.length > 0) {
        await this.activateTab(remainingTabs[0].id);
      }
    }

    return true;
  }

  async activateTab(tabId: string): Promise<boolean> {
    console.log('[TabManager] activateTab called, tabId:', tabId);
    const tab = this.tabs.get(tabId);
    const view = this.views.get(tabId);

    if (!tab || !view) {
      console.error('[TabManager] Tab or view not found for tabId:', tabId);
      return false;
    }

    // 取消激活当前 Tab
    if (this.activeTabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        currentTab.active = false;
      }
    }

    // 激活新 Tab
    tab.active = true;
    this.activeTabId = tabId;
    console.log('[TabManager] Setting BrowserView for tabId:', tabId);
    this.mainWindow.setBrowserView(view);

    // 检查是否需要显示子标签栏
    const rootTabId = this.getRootTabId(tabId);
    const hasSubTabs = this.hasSubTabs(rootTabId);

    // 更新视图大小
    this.updateViewBounds(view, hasSubTabs);

    // 通知渲染进程（包含父子关系信息）
    this.mainWindow.webContents.send('tab:activate', {
      tabId,
      parentTabId: tab.parentTabId,
      rootTabId,
      hasSubTabs,
    });
    console.log('[TabManager] Tab activated, activeTabId:', this.activeTabId);

    return true;
  }

  async listTabs(): Promise<Tab[]> {
    return Array.from(this.tabs.values());
  }

  /**
   * 获取所有 tabs 的 Map（用于检查运行状态）
   */
  getTabs(): Map<string, Tab> {
    return this.tabs;
  }

  /**
   * 导航到指定 Tab
   */
  async navigateTab(tabId: string, url: string): Promise<boolean> {
    const view = this.views.get(tabId);
    if (view) {
      await view.webContents.loadURL(url);
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.url = url;
      }
      return true;
    }
    return false;
  }

  /**
   * 获取当前 Tab 的 URL
   */
  getTabURL(tabId: string): string | null {
    const view = this.views.get(tabId);
    if (view) {
      return view.webContents.getURL();
    }
    return null;
  }

  /**
   * 重新加载指定 Tab
   */
  async reloadTab(tabId: string): Promise<boolean> {
    const view = this.views.get(tabId);
    if (view) {
      view.webContents.reload();
      return true;
    }
    return false;
  }

  /**
   * 后退
   */
  goBack(tabId: string): boolean {
    const view = this.views.get(tabId);
    if (view && view.webContents.canGoBack()) {
      view.webContents.goBack();
      return true;
    }
    return false;
  }

  /**
   * 前进
   */
  goForward(tabId: string): boolean {
    const view = this.views.get(tabId);
    if (view && view.webContents.canGoForward()) {
      view.webContents.goForward();
      return true;
    }
    return false;
  }

  /**
   * 停止加载
   */
  stop(tabId: string): boolean {
    const view = this.views.get(tabId);
    if (view) {
      view.webContents.stop();
      return true;
    }
    return false;
  }

  /**
   * 获取导航状态
   */
  getNavigationState(tabId: string): { canGoBack: boolean; canGoForward: boolean; isLoading: boolean; url: string } | null {
    const view = this.views.get(tabId);
    if (view) {
      return {
        canGoBack: view.webContents.canGoBack(),
        canGoForward: view.webContents.canGoForward(),
        isLoading: view.webContents.isLoading(),
        url: view.webContents.getURL(),
      };
    }
    return null;
  }

  /**
   * 打开开发者工具
   */
  openDevTools(tabId: string): boolean {
    const view = this.views.get(tabId);
    if (view) {
      view.webContents.openDevTools();
      return true;
    }
    return false;
  }

  /**
   * 更新单个视图的边界（用于窗口大小变化时调用）
   * @param hasSubTabs 是否有子标签页（需要显示子标签栏）
   */
  private updateViewBounds(view: BrowserView, hasSubTabs: boolean = false) {
    // 检查 mainWindow 是否已被销毁
    if (this.mainWindow.isDestroyed()) {
      return;
    }

    // 使用 getContentBounds() 而不是 getBounds()，这样可以获取实际内容区域的大小
    // 避免在最大化时因为窗口边框导致的偏移问题
    const bounds = this.mainWindow.getContentBounds();
    const headerHeight = 40; // Chrome 风格标题栏高度（包含标签页）
    const addressBarHeight = 40; // 地址栏高度
    const subTabBarHeight = 32; // 子标签栏高度

    // 检查是否有激活的 tab，如果有则显示地址栏
    const hasActiveTab = this.activeTabId !== null;
    let topOffset = headerHeight + (hasActiveTab ? addressBarHeight : 0);

    // 如果有子标签页，增加子标签栏高度
    if (hasSubTabs) {
      topOffset += subTabBarHeight;
    }

    try {
      view.setBounds({
        x: 0,
        y: topOffset,
        width: bounds.width,
        height: bounds.height - topOffset,
      });
    } catch (error) {
      // 如果 view 已被销毁，忽略错误
      console.warn('[TabManager] 更新视图边界失败（视图可能已被销毁）:', error);
    }
  }

  /**
   * 获取标签页的根标签 ID（如果是子标签，返回最顶层的父标签）
   */
  private getRootTabId(tabId: string): string {
    const tab = this.tabs.get(tabId);
    if (!tab || !tab.parentTabId) {
      return tabId;
    }
    return this.getRootTabId(tab.parentTabId);
  }

  /**
   * 检查标签页是否有子标签
   */
  private hasSubTabs(tabId: string): boolean {
    const tab = this.tabs.get(tabId);
    return !!(tab?.childTabIds && tab.childTabIds.length > 0);
  }

  /**
   * 更新所有视图的边界（窗口大小变化时调用）
   */
  updateViewsBounds() {
    // 检查 mainWindow 是否已被销毁
    if (this.mainWindow.isDestroyed()) {
      return;
    }

    // 只更新当前激活的视图
    if (this.activeTabId) {
      const view = this.views.get(this.activeTabId);
      if (view) {
        const tab = this.tabs.get(this.activeTabId);
        // 检查是否需要显示子标签栏
        const rootTabId = this.getRootTabId(this.activeTabId);
        const hasSubTabs = this.hasSubTabs(rootTabId);
        this.updateViewBounds(view, hasSubTabs);
      }
    }
  }

  /**
   * 更新所有视图的边界（旧版本，保留兼容）
   */
  updateViewsBoundsLegacy() {
    // 检查 mainWindow 是否已被销毁
    if (this.mainWindow.isDestroyed()) {
      return;
    }

    // 使用 getContentBounds() 而不是 getBounds()，这样可以获取实际内容区域的大小
    // 避免在最大化时因为窗口边框导致的偏移问题
    const bounds = this.mainWindow.getContentBounds();
    const sidebarWidth = 60;
    const titleBarHeight = 40;
    const tabBarHeight = 38;

    // 检查是否有激活的 tab，如果有则显示 TabBar
    const hasActiveTab = this.activeTabId !== null;
    const topOffset = titleBarHeight + (hasActiveTab ? tabBarHeight : 0);

    // 确保宽度不为负数
    const width = Math.max(0, bounds.width - sidebarWidth);

    // 遍历 views 时，检查每个 view 是否仍然有效
    const viewsToRemove: string[] = [];
    this.views.forEach((view, tabId) => {
      try {
        // 检查 view 的 webContents 是否已被销毁
        if (view.webContents.isDestroyed()) {
          viewsToRemove.push(tabId);
          return;
        }

        view.setBounds({
          x: sidebarWidth,
          y: topOffset,
          width: width,
          height: bounds.height - topOffset,
        });
      } catch (error) {
        // 如果 view 已被销毁，记录并标记为需要清理
        console.warn(`[TabManager] 更新视图边界失败 (tabId: ${tabId}):`, error);
        viewsToRemove.push(tabId);
      }
    });
    
    // 清理已销毁的 views
    if (viewsToRemove.length > 0) {
      viewsToRemove.forEach((tabId) => {
        console.log(`[TabManager] 清理已销毁的视图 (tabId: ${tabId})`);
        this.views.delete(tabId);
        this.tabs.delete(tabId);
        this.sessions.delete(tabId);
      });
    }
  }

  /**
   * 获取当前激活的 Tab ID
   */
  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * 隐藏所有 BrowserView（切换到应用中心时调用）
   */
  hideAllViews() {
    this.mainWindow.setBrowserView(null);
    // 取消所有 tab 的激活状态
    this.tabs.forEach((tab) => {
      tab.active = false;
    });
    this.activeTabId = null;
    this.hiddenTabId = null;
    // 通知渲染进程
    this.mainWindow.webContents.send('tab:activate', { tabId: null });
  }

  /**
   * 临时隐藏当前 BrowserView（用于显示菜单/模态框）
   * 保存当前状态，以便之后恢复
   */
  temporarilyHideView() {
    if (this.activeTabId) {
      this.hiddenTabId = this.activeTabId;
      this.mainWindow.setBrowserView(null);
    }
  }

  /**
   * 恢复之前临时隐藏的 BrowserView
   */
  restoreHiddenView() {
    if (this.hiddenTabId) {
      const tabId = this.hiddenTabId;
      this.hiddenTabId = null;
      this.activateTab(tabId);
    } 
  }

  /**
   * 显示指定 Tab 的 BrowserView
   */
  showTabView(tabId: string) {
    if (!tabId) {
      return;
    }
    const view = this.views.get(tabId);
    if (view) {
      this.mainWindow.setBrowserView(view);
      this.updateViewBounds(view);
      // 激活这个 tab
      const tab = this.tabs.get(tabId);
      if (tab) {
        // 取消其他 tab 的激活状态
        this.tabs.forEach((t) => {
          if (t.id !== tabId) {
            t.active = false;
          }
        });
        tab.active = true;
        this.activeTabId = tabId;
        this.mainWindow.webContents.send('tab:activate', { tabId });
      }
    }
  }

  /**
   * 获取 Tab 的内存使用情况
   */
  async getTabMemoryUsage(tabId: string): Promise<any> {
    const view = this.views.get(tabId);
    if (!view) {
      return null;
    }

    try {
      const webContents = view.webContents as any;
      if (webContents && typeof webContents.getProcessMemoryInfo === 'function') {
        const memoryInfo = await webContents.getProcessMemoryInfo();
        return {
          workingSetSize: memoryInfo?.workingSetSize || 0,
          peakWorkingSetSize: memoryInfo?.peakWorkingSetSize || 0,
          privateBytes: memoryInfo?.privateBytes || 0,
        };
      } else {
        // 如果方法不存在，返回基本信息
        return {
          workingSetSize: 0,
          peakWorkingSetSize: 0,
          privateBytes: 0,
        };
      }
    } catch (error) {
      console.error('获取内存信息失败:', error);
      return {
        workingSetSize: 0,
        peakWorkingSetSize: 0,
        privateBytes: 0,
      };
    }
  }

  /**
   * 获取 Tab 的 Cookies
   */
  async getTabCookies(tabId: string, url?: string): Promise<any[]> {
    const view = this.views.get(tabId);
    if (!view) {
      return [];
    }

    try {
      const session = view.webContents.session;
      const targetUrl = url || view.webContents.getURL();
      
      if (!targetUrl || targetUrl === 'about:blank') {
        return [];
      }

      const cookies = await session.cookies.get({ url: targetUrl });
      return cookies;
    } catch (error) {
      console.error('获取 Cookies 失败:', error);
      return [];
    }
  }

  /**
   * 在 Tab 中执行 JavaScript 代码
   * 将代码包装在 IIFE 中以避免变量重复声明的问题
   */
  async executeScript(tabId: string, code: string): Promise<any> {
    const view = this.views.get(tabId);
    if (!view) {
      throw new Error('Tab not found');
    }

    try {
      console.log('[TabManager] Executing script for tabId:', tabId);
      const result = await view.webContents.executeJavaScript(code);
      console.log('[TabManager] Script execution result:', result, 'type:', typeof result);
      return result;
    } catch (error: any) {
      console.error('[TabManager] Script execution error:', error);
      throw new Error(error.message || 'Script execution failed');
    }
  }


  /**
   * 手动触发文件上传扫描和注入（被动扫描）
   */
  async triggerFileUploadScan(tabId: string, imagePaths?: string[]): Promise<{ success: boolean; count: number; message: string }> {
    const interceptor = this.fileUploadInterceptors.get(tabId);
    
    if (!interceptor) {
      return {
        success: false,
        count: 0,
        message: '文件上传拦截器未初始化'
      };
    }

    return await interceptor.triggerScan(imagePaths);
  }

  /**
   * 下载指定 URL 的文件
   * 通过页面内的 JavaScript 触发下载，这样可以携带当前页面的 cookies 和 headers
   */
  async downloadUrl(tabId: string, url: string): Promise<boolean> {
    const view = this.views.get(tabId);
    if (!view) {
      throw new Error(`Tab ${tabId} not found`);
    }

      try {
        view.webContents.downloadURL(url);
        return true;
      } catch (fallbackError) {
        throw fallbackError;
      }

  }

  /**
   * 截取指定 Tab 的屏幕截图
   * 使用 CDP Page.captureScreenshot 避免 macOS 屏幕录制权限问题
   * @returns base64 编码的 PNG 图片
   */
  async captureScreenshot(tabId: string): Promise<string | null> {
    const view = this.views.get(tabId);
    if (!view) {
      return null;
    }

    try {
      const dbg = view.webContents.debugger;
      const wasAttached = dbg.isAttached();

      if (!wasAttached) {
        dbg.attach('1.3');
      }

      const { data } = await dbg.sendCommand('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });

      if (!wasAttached) {
        dbg.detach();
      }

      return data; // CDP 返回的已经是 base64
    } catch (error) {
      console.error('[TabManager] Screenshot failed:', error);
      return null;
    }
  }

  /**
   * 获取指定 Tab 的 BrowserView（供 API Server 使用）
   */
  getView(tabId: string) {
    return this.views.get(tabId);
  }

  /**
   * 获取 Tab 的控制台日志
   * @param tabId Tab ID
   * @param level 可选，过滤日志级别
   */
  getConsoleLogs(tabId: string, level?: string): ConsoleLogEntry[] {
    const logs = this.consoleLogs.get(tabId) || [];

    if (level) {
      return logs.filter(log => log.level === level);
    }

    return logs;
  }

  /**
   * 清空 Tab 的控制台日志
   */
  clearConsoleLogs(tabId: string): void {
    this.consoleLogs.set(tabId, []);
  }

  /**
   * 文件上传 API
   * @param tabId Tab ID
   * @param files 文件路径数组
   */
  async uploadFiles(tabId: string, files: string[]): Promise<{ success: boolean; count: number; message: string }> {
    const interceptor = this.fileUploadInterceptors.get(tabId);
    if (!interceptor) {
      return { success: false, count: 0, message: 'Tab not found' };
    }

    // 验证文件路径
    const validFiles = files.filter(f => existsSync(f));
    if (validFiles.length === 0) {
      return { success: false, count: 0, message: 'No valid files provided' };
    }

    return await interceptor.triggerScan(validFiles);
  }

  /**
   * 元素点击 API
   * @param tabId Tab ID
   * @param selector CSS 选择器
   */
  async clickElement(tabId: string, selector: string): Promise<{ success: boolean; message: string }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found' };
    }

    try {
      const result = await view.webContents.executeJavaScript(`
        (function() {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el) return { success: false, message: 'Element not found' };
          el.click();
          return { success: true, message: 'Clicked' };
        })()
      `);
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 元素输入 API
   * @param tabId Tab ID
   * @param selector CSS 选择器
   * @param text 输入文本
   * @param clear 是否先清空
   */
  async typeText(tabId: string, selector: string, text: string, clear: boolean = false): Promise<{ success: boolean; message: string }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found' };
    }

    try {
      const result = await view.webContents.executeJavaScript(`
        (function() {
          const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
          if (!el) return { success: false, message: 'Element not found' };
          el.focus();
          if (${clear}) {
            el.value = '';
          }
          el.value ${clear ? '=' : '+='} '${text.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, message: 'Typed' };
        })()
      `);
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 等待元素出现 API
   * @param tabId Tab ID
   * @param selector CSS 选择器
   * @param timeout 超时时间（毫秒）
   * @param visible 是否要求元素可见
   */
  async waitForElement(tabId: string, selector: string, timeout: number = 30000, visible: boolean = false): Promise<{ success: boolean; message: string; elapsed: number }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found', elapsed: 0 };
    }

    const startTime = Date.now();
    const interval = 100; // 每 100ms 检查一次

    while (Date.now() - startTime < timeout) {
      try {
        const found = await view.webContents.executeJavaScript(`
          (function() {
            const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
            if (!el) return { found: false };
            ${visible ? `
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible = rect.width > 0 && rect.height > 0 &&
                              style.visibility !== 'hidden' &&
                              style.display !== 'none' &&
                              style.opacity !== '0';
            return { found: isVisible };
            ` : 'return { found: true };'}
          })()
        `);

        if (found.found) {
          return { success: true, message: 'Element found', elapsed: Date.now() - startTime };
        }
      } catch (error) {
        // 页面可能正在加载，继续等待
      }

      await new Promise(r => setTimeout(r, interval));
    }

    return { success: false, message: `Timeout waiting for element: ${selector}`, elapsed: timeout };
  }

  /**
   * 等待文本出现 API
   * @param tabId Tab ID
   * @param text 要等待的文本（支持正则）
   * @param timeout 超时时间（毫秒）
   * @param selector 可选，限定搜索范围
   */
  async waitForText(tabId: string, text: string, timeout: number = 30000, selector?: string): Promise<{ success: boolean; message: string; elapsed: number; matchedText?: string }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found', elapsed: 0 };
    }

    const startTime = Date.now();
    const interval = 100;
    const isRegex = text.startsWith('/') && text.lastIndexOf('/') > 0;

    while (Date.now() - startTime < timeout) {
      try {
        const result = await view.webContents.executeJavaScript(`
          (function() {
            const container = ${selector ? `document.querySelector('${selector.replace(/'/g, "\\'")}')` : 'document.body'};
            if (!container) return { found: false };
            const pageText = container.innerText || '';
            ${isRegex ? `
            const regexStr = '${text.slice(1, text.lastIndexOf('/'))}';
            const flags = '${text.slice(text.lastIndexOf('/') + 1)}';
            const regex = new RegExp(regexStr, flags);
            const match = pageText.match(regex);
            return match ? { found: true, matchedText: match[0] } : { found: false };
            ` : `
            const found = pageText.includes('${text.replace(/'/g, "\\'")}');
            return { found, matchedText: found ? '${text.replace(/'/g, "\\'")}' : null };
            `}
          })()
        `);

        if (result.found) {
          return { success: true, message: 'Text found', elapsed: Date.now() - startTime, matchedText: result.matchedText };
        }
      } catch (error) {
        // 页面可能正在加载，继续等待
      }

      await new Promise(r => setTimeout(r, interval));
    }

    return { success: false, message: `Timeout waiting for text: ${text}`, elapsed: timeout };
  }

  /**
   * 启动网络请求监控
   * @param tabId Tab ID
   */
  async startNetworkMonitoring(tabId: string): Promise<{ success: boolean; message: string }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found' };
    }

    if (this.networkMonitoringTabs.has(tabId)) {
      return { success: true, message: 'Already monitoring' };
    }

    try {
      const dbg = view.webContents.debugger;
      if (!dbg.isAttached()) {
        dbg.attach('1.3');
      }

      // 启用网络监控
      await dbg.sendCommand('Network.enable');

      // 初始化存储
      this.networkRequests.set(tabId, []);
      this.networkMonitoringTabs.add(tabId);

      // 监听网络事件
      dbg.on('message', (event, method, params) => {
        if (!this.networkMonitoringTabs.has(tabId)) return;

        const requests = this.networkRequests.get(tabId) || [];

        if (method === 'Network.requestWillBeSent') {
          const entry: NetworkRequestEntry = {
            id: params.requestId,
            url: params.request.url,
            method: params.request.method,
            resourceType: params.type,
            requestHeaders: params.request.headers,
            startTime: Date.now(),
          };
          requests.push(entry);

          // 保持最大数量
          if (requests.length > this.MAX_NETWORK_REQUESTS) {
            requests.shift();
          }
          this.networkRequests.set(tabId, requests);
        } else if (method === 'Network.responseReceived') {
          const entry = requests.find(r => r.id === params.requestId);
          if (entry) {
            entry.status = params.response.status;
            entry.statusText = params.response.statusText;
            entry.responseHeaders = params.response.headers;
          }
        } else if (method === 'Network.loadingFinished') {
          const entry = requests.find(r => r.id === params.requestId);
          if (entry) {
            entry.endTime = Date.now();
            entry.duration = entry.endTime - entry.startTime;
            entry.size = params.encodedDataLength;
          }
        } else if (method === 'Network.loadingFailed') {
          const entry = requests.find(r => r.id === params.requestId);
          if (entry) {
            entry.endTime = Date.now();
            entry.duration = entry.endTime - entry.startTime;
            entry.error = params.errorText;
          }
        }
      });

      return { success: true, message: 'Network monitoring started' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 停止网络请求监控
   * @param tabId Tab ID
   */
  async stopNetworkMonitoring(tabId: string): Promise<{ success: boolean; message: string }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found' };
    }

    if (!this.networkMonitoringTabs.has(tabId)) {
      return { success: true, message: 'Not monitoring' };
    }

    try {
      const dbg = view.webContents.debugger;
      if (dbg.isAttached()) {
        await dbg.sendCommand('Network.disable');
        dbg.detach();
      }

      this.networkMonitoringTabs.delete(tabId);
      return { success: true, message: 'Network monitoring stopped' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 获取网络请求记录
   * @param tabId Tab ID
   * @param filter 可选过滤条件
   */
  getNetworkRequests(tabId: string, filter?: { url?: string; method?: string; status?: number }): NetworkRequestEntry[] {
    let requests = this.networkRequests.get(tabId) || [];

    if (filter) {
      if (filter.url) {
        const urlPattern = filter.url;
        requests = requests.filter(r => r.url.includes(urlPattern));
      }
      if (filter.method) {
        requests = requests.filter(r => r.method.toUpperCase() === filter.method!.toUpperCase());
      }
      if (filter.status !== undefined) {
        requests = requests.filter(r => r.status === filter.status);
      }
    }

    return requests;
  }

  /**
   * 清空网络请求记录
   * @param tabId Tab ID
   */
  clearNetworkRequests(tabId: string): void {
    this.networkRequests.set(tabId, []);
  }

  /**
   * 等待特定网络请求
   * @param tabId Tab ID
   * @param urlPattern URL 匹配模式
   * @param timeout 超时时间
   */
  async waitForRequest(tabId: string, urlPattern: string, timeout: number = 30000): Promise<{ success: boolean; message: string; request?: NetworkRequestEntry; elapsed: number }> {
    if (!this.networkMonitoringTabs.has(tabId)) {
      // 自动启动监控
      await this.startNetworkMonitoring(tabId);
    }

    const startTime = Date.now();
    const interval = 100;

    while (Date.now() - startTime < timeout) {
      const requests = this.networkRequests.get(tabId) || [];
      const match = requests.find(r => r.url.includes(urlPattern) && r.status !== undefined);

      if (match) {
        return { success: true, message: 'Request found', request: match, elapsed: Date.now() - startTime };
      }

      await new Promise(r => setTimeout(r, interval));
    }

    return { success: false, message: `Timeout waiting for request: ${urlPattern}`, elapsed: timeout };
  }

  /**
   * 获取 Cookie
   * @param tabId Tab ID
   * @param url 可选，指定 URL（默认使用当前页面 URL）
   * @param name 可选，指定 Cookie 名称
   */
  async getCookies(tabId: string, url?: string, name?: string): Promise<{ success: boolean; cookies: Electron.Cookie[]; message?: string }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, cookies: [], message: 'Tab not found' };
    }

    try {
      const tabSession = view.webContents.session;
      const targetUrl = url || view.webContents.getURL();

      if (!targetUrl || targetUrl === 'about:blank') {
        return { success: false, cookies: [], message: 'No URL available' };
      }

      const filter: Electron.CookiesGetFilter = { url: targetUrl };
      if (name) {
        filter.name = name;
      }

      const cookies = await tabSession.cookies.get(filter);
      return { success: true, cookies };
    } catch (error: any) {
      return { success: false, cookies: [], message: error.message };
    }
  }

  /**
   * 设置 Cookie
   * @param tabId Tab ID
   * @param cookie Cookie 对象
   */
  async setCookie(tabId: string, cookie: { url?: string; name: string; value: string; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean; expirationDate?: number; sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict' }): Promise<{ success: boolean; message: string }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found' };
    }

    try {
      const tabSession = view.webContents.session;
      const targetUrl = cookie.url || view.webContents.getURL();

      if (!targetUrl || targetUrl === 'about:blank') {
        return { success: false, message: 'No URL available' };
      }

      await tabSession.cookies.set({
        url: targetUrl,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate,
        sameSite: cookie.sameSite,
      });

      return { success: true, message: `Cookie '${cookie.name}' set` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 删除 Cookie
   * @param tabId Tab ID
   * @param url URL
   * @param name Cookie 名称
   */
  async removeCookie(tabId: string, url: string | undefined, name: string): Promise<{ success: boolean; message: string }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found' };
    }

    try {
      const tabSession = view.webContents.session;
      const targetUrl = url || view.webContents.getURL();

      if (!targetUrl || targetUrl === 'about:blank') {
        return { success: false, message: 'No URL available' };
      }

      await tabSession.cookies.remove(targetUrl, name);
      return { success: true, message: `Cookie '${name}' removed` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 清除所有 Cookie
   * @param tabId Tab ID
   * @param url 可选，只清除指定 URL 的 Cookie
   */
  async clearCookies(tabId: string, url?: string): Promise<{ success: boolean; message: string; count: number }> {
    const view = this.views.get(tabId);
    if (!view) {
      return { success: false, message: 'Tab not found', count: 0 };
    }

    try {
      const tabSession = view.webContents.session;
      const targetUrl = url || view.webContents.getURL();

      if (!targetUrl || targetUrl === 'about:blank') {
        return { success: false, message: 'No URL available', count: 0 };
      }

      // 获取所有 Cookie
      const cookies = await tabSession.cookies.get({ url: targetUrl });
      const count = cookies.length;

      // 逐个删除
      for (const cookie of cookies) {
        await tabSession.cookies.remove(targetUrl, cookie.name);
      }

      return { success: true, message: `Cleared ${count} cookies`, count };
    } catch (error: any) {
      return { success: false, message: error.message, count: 0 };
    }
  }

}

