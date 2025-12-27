import { BrowserWindow, BrowserView, session, dialog, app } from 'electron';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';
import { BrowserService } from '@qiyi/browser-service';
import type { Tab } from '@qiyi/shared';
import { FileUploadInterceptor } from './file-upload-interceptor';
import { DownloadManager } from './download-manager';

export class TabManager {
  private tabs: Map<string, Tab> = new Map();
  private views: Map<string, BrowserView> = new Map();
  private sessions: Map<string, Electron.Session> = new Map(); // 存储每个 tab 的独立 session
  private activeTabId: string | null = null;
  private mainWindow: BrowserWindow;
  private browserService: BrowserService;
  private hiddenTabId: string | null = null; // 记录临时隐藏的 tab ID
  private rightPanelWidth: number = 400; // 右侧面板宽度
  // 文件上传拦截器
  private fileUploadInterceptors: Map<string, FileUploadInterceptor> = new Map();
  // 下载管理器
  private downloadManager: DownloadManager;

  constructor(mainWindow: BrowserWindow, browserService: BrowserService, downloadManager: DownloadManager) {
    this.mainWindow = mainWindow;
    this.browserService = browserService;
    this.downloadManager = downloadManager;
  }

  async createTab(appId: string, url: string, configId?: string, configName?: string): Promise<Tab> {
    const tabId = `tab_${configId}`;
    const partitionKey = `config_${configId}`;
    const partitionId = `persist:${partitionKey}`;
    const tabSession = session.fromPartition(partitionId);
    
    // 为独立的 session 设置 User-Agent
    const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    tabSession.setUserAgent(chromeUA);
    
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
    
    // 只拦截同一个顶级域名的新窗口打开，改为在当前窗口中跳转
    const getTopLevelDomain = (inputUrl: string) => {
      try {
        const { hostname } = new URL(inputUrl);
        // 提取主域名（如 seller.kuajingmaihuo.com -> kuajingmaihuo.com）
        const parts = hostname.split('.').reverse();
        if (parts.length >= 2) {
          return parts[1] + '.' + parts[0];
        }
        return hostname;
      } catch (e) {
        return '';
      }
    };

    const initialUrl = url;
    const initialTld = getTopLevelDomain(initialUrl);

    view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      const targetTld = getTopLevelDomain(targetUrl);
      if (initialTld && targetTld && initialTld === targetTld) {
        console.log('[TabManager] 拦截同主域新窗口打开请求，URL:', targetUrl);
        setTimeout(() => {
          view.webContents.loadURL(targetUrl).catch((error) => {
            if (error.code !== 'ERR_ABORTED') {
              console.error('[TabManager] 加载新 URL 失败:', error);
            }
          });
        }, 0);
        return { action: 'deny' };
      } else {
        // 不同域名的弹窗允许单独打开
        return { action: 'allow' };
      }
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
    this.updateViewBounds(view);

    // 先创建 tab 对象（用于立即返回）
    const tab: Tab = {
      id: tabId,
      appId,
      url,
      title: appId,
      active: false,
      createdAt: Date.now(),
      configId,
      configName,
    };

    this.tabs.set(tabId, tab);
    this.views.set(tabId, view);

    console.log(tabId)

    // 监听标题变化
    view.webContents.on('page-title-updated', (_, title) => {
      const tab = this.tabs.get(tabId);
      if (tab) {
        tab.title = title;
        this.mainWindow.webContents.send('tab:update', { tabId, updates: { title } });
      }
    });

    // 监听页面加载完成（每次导航后都会触发）
    const handlePageLoad = async () => {
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
    const view = this.views.get(tabId);
    
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

    // 更新视图大小
    this.updateViewBounds(view);

    // 通知渲染进程
    this.mainWindow.webContents.send('tab:activate', { tabId });
    console.log('[TabManager] Tab activated, activeTabId:', this.activeTabId);

    return true;
  }

  async listTabs(): Promise<Tab[]> {
    return Array.from(this.tabs.values());
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
   * 更新单个视图的边界（用于窗口大小变化时调用）
   */
  private updateViewBounds(view: BrowserView) {
    // 检查 mainWindow 是否已被销毁
    if (this.mainWindow.isDestroyed()) {
      return;
    }
    
    // 使用 getContentBounds() 而不是 getBounds()，这样可以获取实际内容区域的大小
    // 避免在最大化时因为窗口边框导致的偏移问题
    const bounds = this.mainWindow.getContentBounds();
    const sidebarWidth = 240; // 侧边栏宽度
    const titleBarHeight = 40; // 标题栏高度
    const tabBarHeight = 36; // TabBar 高度（当有标签时显示）
    
    // 检查是否有激活的 tab，如果有则显示 TabBar
    const hasActiveTab = this.activeTabId !== null;
    const topOffset = titleBarHeight + (hasActiveTab ? tabBarHeight : 0);
    
    // 确保宽度不为负数
    const width = Math.max(0, bounds.width - sidebarWidth - this.rightPanelWidth);
    
    try {
      view.setBounds({
        x: sidebarWidth,
        y: topOffset,
        width: width,
        height: bounds.height - topOffset,
      });
    } catch (error) {
      // 如果 view 已被销毁，忽略错误
      console.warn('[TabManager] 更新视图边界失败（视图可能已被销毁）:', error);
    }
  }

  /**
   * 更新所有视图的边界（窗口大小变化时调用）
   */
  updateViewsBounds() {
    // 检查 mainWindow 是否已被销毁
    if (this.mainWindow.isDestroyed()) {
      return;
    }
    
    // 使用 getContentBounds() 而不是 getBounds()，这样可以获取实际内容区域的大小
    // 避免在最大化时因为窗口边框导致的偏移问题
    const bounds = this.mainWindow.getContentBounds();
    const sidebarWidth = 240;
    const titleBarHeight = 40;
    const tabBarHeight = 36;
    
    // 检查是否有激活的 tab，如果有则显示 TabBar
    const hasActiveTab = this.activeTabId !== null;
    const topOffset = titleBarHeight + (hasActiveTab ? tabBarHeight : 0);
    
    // 确保宽度不为负数
    const width = Math.max(0, bounds.width - sidebarWidth - this.rightPanelWidth);
    
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
   * 设置右侧面板的宽度
   */
  setRightPanelWidth(width: number) {
    this.rightPanelWidth = width;
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
   * 打开指定 Tab 的开发者工具
   */
  openDevTools(tabId: string) {
    const view = this.views.get(tabId);
    if (!view) {
      throw new Error(`Tab ${tabId} not found`);
    }
    console.log('[TabManager] Opening dev tools for tab:', tabId);
    view.webContents.openDevTools({ mode: 'bottom' });
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

}

