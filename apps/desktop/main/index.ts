import { app, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron';
import { join, dirname, basename, extname } from 'path';
import { TabManager } from './windows/tab-manager';
import { BrowserService } from '@qiyi/browser-service';
import { DownloadManager } from './windows/download-manager';
import { getAICallbackServer } from './ai-callback-server';
import { getApiServer } from './api-server';
import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

let mainWindow: BrowserWindow | null = null;
let tabManager: TabManager | null = null;
let downloadManager: DownloadManager | null = null;
let aiCallbackServer: ReturnType<typeof getAICallbackServer> | null = null;
let apiServer: ReturnType<typeof getApiServer> | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    backgroundColor: '#000000',
    frame: false, // 无边框窗口
    show: false, // 先不显示，等加载完成后再显示
    webPreferences: {
      // 使用 __dirname 获取 preload 路径，在打包后会指向 app.asar/dist/preload/index.js
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    titleBarStyle: 'hiddenInset', // macOS 上使用 hiddenInset 以便红绿灯按钮正确显示
    trafficLightPosition: { x: 16, y: 12 }, // 调整红绿灯按钮位置
  });

  // 开发环境加载 Vite dev server，生产环境加载构建后的文件
  if (process.env.NODE_ENV === 'development') {
    let isLoaded = false; // 防止重复加载
    
    // 等待 Vite 服务器就绪后再加载
    const waitForVite = () => {
      if (isLoaded) return; // 如果已经加载过，不再重复
      
      const http = require('http');
      const req = http.get('http://localhost:3800', (res: any) => {
        res.on('data', () => {}); // 消费响应数据
        res.on('end', () => {
          if (!isLoaded) {
            isLoaded = true;
            // 收到响应说明服务器已启动
            mainWindow!.loadURL('http://localhost:3800');
          }
        });
      });
      
      req.on('error', () => {
        // 服务器未启动，等待后重试
        if (!isLoaded) {
          setTimeout(waitForVite, 500);
        }
      });
      
      req.setTimeout(2000, () => {
        req.destroy();
        if (!isLoaded) {
          setTimeout(waitForVite, 500);
        }
      });
      req.end();
    };

    // 阻止主窗口的导航和刷新（除非是初始加载或 Vite HMR）
    let isInitialLoad = true;
    let currentUrl = '';
    
    mainWindow!.webContents.on('will-navigate', (event, navigationUrl) => {
      // 允许初始加载
      if (isInitialLoad) {
        currentUrl = navigationUrl;
        console.log('[Main] 允许初始加载:', navigationUrl);
        return;
      }
      
      // 允许 Vite HMR（开发环境）
      if (navigationUrl.includes('localhost:3800') && currentUrl.includes('localhost:3800')) {
        currentUrl = navigationUrl;
        console.log('[Main] 允许 Vite HMR 导航:', navigationUrl);
        return;
      }
      
      // 阻止所有其他导航（包括刷新）
      console.log('[Main] 阻止主窗口导航到:', navigationUrl, '(当前URL:', currentUrl, ')');
      event.preventDefault();
    });
    
    // 监听 URL 变化以更新 currentUrl
    mainWindow!.webContents.on('did-navigate', (event, url) => {
      if (isInitialLoad) {
        currentUrl = url;
        isInitialLoad = false;
      }
    });

    // 阻止主窗口打开新窗口
    mainWindow!.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });

    // 页面加载完成后显示窗口（只执行一次）
    mainWindow!.webContents.once('did-finish-load', () => {
      console.log('页面加载完成');
      isInitialLoad = false;
      mainWindow!.show();
      mainWindow!.webContents.openDevTools({ mode: 'detach' });
    });

    // 监听加载错误
    mainWindow!.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('页面加载失败:', errorCode, errorDescription, validatedURL);
      // 显示窗口以便查看错误
      if (!mainWindow!.isVisible()) {
        mainWindow!.show();
        mainWindow!.webContents.openDevTools({ mode: 'detach' });
      }
    });

    // 监听控制台消息（过滤掉 Electron 安全警告）
    mainWindow!.webContents.on('console-message', (event, level, message, line, sourceId) => {
      // 过滤掉 Electron 安全警告（这个警告在开发环境是正常的）
      if (typeof message === 'string' && message.includes('Electron Security Warning')) {
        return;
      }
      if (level >= 2) { 
        console.log(`[Console ${level}]:`, message);
      }
    });

    waitForVite();
  } else {
    // 生产环境：阻止主窗口的导航和刷新
    let isInitialLoad = true;
    let currentUrl = '';
    
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      // 只允许初始加载
      if (isInitialLoad) {
        currentUrl = navigationUrl;
        console.log('[Main] 允许初始加载:', navigationUrl);
        return;
      }
      
      // 阻止所有其他导航（包括刷新）
      console.log('[Main] 阻止主窗口导航到:', navigationUrl);
      event.preventDefault();
    });
    
    mainWindow.webContents.on('did-navigate', (event, url) => {
      if (isInitialLoad) {
        currentUrl = url;
        isInitialLoad = false;
      }
    });

    // 阻止主窗口打开新窗口
    mainWindow.webContents.setWindowOpenHandler(() => {
      return { action: 'deny' };
    });
    
    // 开发环境：__dirname 指向 dist/main
    // 所以需要 ../../renderer/dist/index.html 才能到达 renderer/dist/index.html
    // 生产环境（打包后）：__dirname 指向 app.asar/dist/main，路径同样适用
    const rendererPath = join(__dirname, '../../renderer/dist/index.html');
    console.log('[Main] 生产环境 - __dirname:', __dirname);
    console.log('[Main] 生产环境 - 加载路径:', rendererPath);
    console.log('[Main] 生产环境 - app.getAppPath():', app.getAppPath());
    
    // 使用 loadFile 加载，它会自动处理 asar 内的文件
    mainWindow.loadFile(rendererPath).catch((error) => {
      console.error('[Main] 加载 HTML 文件失败:', error);
      console.error('[Main] 错误详情:', error.message);
      console.error('[Main] 错误堆栈:', error.stack);
      
      // 备用方案：使用 file:// 协议
      const appPath = app.getAppPath();
      const fileUrl = `file://${join(appPath, 'renderer/dist/index.html').replace(/\\/g, '/')}`;
      console.log('[Main] 尝试备用方案 (file://):', fileUrl);
      if (mainWindow) {
        mainWindow.loadURL(fileUrl).catch((fallbackError) => {
          console.error('[Main] 备用方案也失败:', fallbackError);
        });
      }
    });
    
    mainWindow.once('ready-to-show', () => {
      mainWindow!.show();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 监听窗口大小变化，更新 BrowserView 位置
  mainWindow.on('resize', () => {
    // tabManager 会在 app.whenReady 中初始化
    if (tabManager && mainWindow && !mainWindow.isDestroyed()) {
      // 使用 setTimeout 延迟更新，确保窗口大小已经完成变化
      const manager = tabManager; // 保存引用
      const window = mainWindow; // 保存窗口引用
      setTimeout(() => {
        if (manager && window && !window.isDestroyed()) {
          manager.updateViewsBounds();
        }
      }, 0);
    }
  });

  // 监听窗口最大化/还原事件，延迟更新以确保边界计算正确
  mainWindow.on('maximize', () => {
    if (tabManager && mainWindow && !mainWindow.isDestroyed()) {
      const manager = tabManager; // 保存引用
      const window = mainWindow; // 保存窗口引用
      setTimeout(() => {
        if (manager && window && !window.isDestroyed()) {
          manager.updateViewsBounds();
        }
      }, 100);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (tabManager && mainWindow && !mainWindow.isDestroyed()) {
      const manager = tabManager; // 保存引用
      const window = mainWindow; // 保存窗口引用
      setTimeout(() => {
        if (manager && window && !window.isDestroyed()) {
          manager.updateViewsBounds();
        }
      }, 100);
    }
  });

  // 使用全局快捷键拦截刷新（F5, Ctrl+R），确保无论焦点在哪里都能拦截
  // 注意：需要在 app.whenReady 之后注册，在窗口关闭时注销
}

app.whenReady().then(async () => {
  // 初始化 Browser Service
  const browserService = new BrowserService();

  createWindow();

  // 初始化 Download Manager（需要在 createWindow 之后）
  downloadManager = new DownloadManager(mainWindow!);

  // 初始化 Tab Manager（需要在 createWindow 之后）
  tabManager = new TabManager(mainWindow!, browserService, downloadManager);

  // 启动 AI 回调服务器
  try {
    aiCallbackServer = getAICallbackServer();
    aiCallbackServer.setMainWindow(mainWindow!);
    await aiCallbackServer.start();
    console.log('[Main] AI 回调服务器已启动');
  } catch (err) {
    console.error('[Main] AI 回调服务器启动失败:', err);
  }

  // 启动 HTTP API 服务器
  try {
    apiServer = getApiServer();
    apiServer.setTabManager(tabManager!);
    await apiServer.start();
    console.log('[Main] HTTP API 服务器已启动');
  } catch (err) {
    console.error('[Main] HTTP API 服务器启动失败:', err);
  }

  // 注册全局快捷键拦截刷新（F5, Ctrl+R）
  // 这样无论焦点在哪里都能拦截
  const registerRefreshShortcuts = () => {
    // 注册 F5 - 全局快捷键会在所有键盘输入之前拦截
    const f5Registered = globalShortcut.register('F5', () => {
      console.log('[Main] 全局快捷键 F5 被按下');
      // 全局快捷键会自动阻止默认行为，所以不需要额外处理
      if (tabManager) {
        const activeTabId = tabManager.getActiveTabId();
        if (activeTabId) {
          console.log('[Main] 刷新 tab:', activeTabId);
          tabManager.reloadTab(activeTabId).catch((error) => {
            console.error('[Main] 刷新 tab 失败:', error);
          });
        } else {
          console.log('[Main] 没有激活的 tab，忽略刷新');
        }
      }
    });

    // 注册 Ctrl+R (Windows/Linux) 或 Cmd+R (macOS)
    const ctrlRRegistered = globalShortcut.register('CommandOrControl+R', () => {
      console.log('[Main] 全局快捷键 Ctrl+R 被按下');
      // 全局快捷键会自动阻止默认行为
      if (tabManager) {
        const activeTabId = tabManager.getActiveTabId();
        if (activeTabId) {
          console.log('[Main] 刷新 tab:', activeTabId);
          tabManager.reloadTab(activeTabId).catch((error) => {
            console.error('[Main] 刷新 tab 失败:', error);
          });
        } else {
          console.log('[Main] 没有激活的 tab，忽略刷新');
        }
      }
    });

    if (f5Registered && ctrlRRegistered) {
      console.log('[Main] ✅ 全局刷新快捷键已注册 (F5, Ctrl+R)');
    } else {
      console.warn('[Main] ⚠️ 全局刷新快捷键注册失败 - F5:', f5Registered, 'Ctrl+R:', ctrlRRegistered);
    }
  };

  registerRefreshShortcuts();

  // 注册 IPC 处理器
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // 注销所有全局快捷键
  globalShortcut.unregisterAll();
  console.log('[Main] 已注销所有全局快捷键');
  
  // 停止 AI 回调服务器
  if (aiCallbackServer) {
    await aiCallbackServer.stop();
    console.log('[Main] AI 回调服务器已停止');
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前注销全局快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  console.log('[Main] 应用退出，已注销所有全局快捷键');
});

function setupIPC() {
  // Tab 相关 IPC
  ipcMain.handle('tab:create', async (_, { appId, url, configId, configName }: { appId: string; url: string; configId?: string; configName?: string }) => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return await tabManager.createTab(appId, url, configId, configName);
  });

  ipcMain.handle('tab:close', async (_, { tabId }: { tabId: string }) => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return await tabManager.closeTab(tabId);
  });

  ipcMain.handle('tab:activate', async (_, { tabId }: { tabId: string }) => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return await tabManager.activateTab(tabId);
  });

  ipcMain.handle('tab:list', async () => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return await tabManager.listTabs();
  });

  // Browser 相关 IPC
  ipcMain.handle('browser:navigate', async (_, { tabId, url }: { tabId: string; url: string }) => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return await tabManager.navigateTab(tabId, url);
  });

  ipcMain.handle('browser:reload', async (_, { tabId }: { tabId: string }) => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return await tabManager.reloadTab(tabId);
  });

  ipcMain.handle('browser:getURL', async (_, { tabId }: { tabId: string }) => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return tabManager.getTabURL(tabId);
  });

  // 视图控制 IPC
  ipcMain.handle('view:hideBrowser', () => {
    if (tabManager) {
      tabManager.hideAllViews();
    }
  });

  ipcMain.handle('view:showBrowser', async (_, { tabId }: { tabId: string }) => {
    if (tabManager) {
      if (tabId) {
        await tabManager.activateTab(tabId);
      } else {
        // 只显示浏览器区域，不激活特定 tab
        tabManager.showTabView('');
      }
    }
  });

  // 临时隐藏/恢复 BrowserView（用于菜单/模态框）
  ipcMain.handle('view:temporarilyHide', () => {
    console.log('[IPC] view:temporarilyHide called');
    if (tabManager) {
      tabManager.temporarilyHideView();
    } else {
      console.error('[IPC] tabManager is null!');
    }
  });

  ipcMain.handle('view:restoreHidden', () => {
    console.log('[IPC] view:restoreHidden called');
    if (tabManager) {
      tabManager.restoreHiddenView();
    } else {
      console.error('[IPC] tabManager is null!');
    }
  });

  // 窗口控制 IPC
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });

  // AI Agent 相关 IPC
  ipcMain.handle('ai:getCallbackUrl', () => {
    if (aiCallbackServer) {
      return aiCallbackServer.getCallbackUrl();
    }
    return 'http://localhost:5022';
  });

  // 获取浏览器缓存路径
  ipcMain.handle('cache:getPath', (_, { configId, tabId }: { configId?: string; tabId?: string }) => {
    const userDataPath = app.getPath('userData');
    if (configId) {
      return join(userDataPath, 'Partitions', `config_${configId}`);
    } else if (tabId) {
      // 临时 tab 的缓存路径
      return join(userDataPath, 'Partitions', `tab_${tabId}`);
    } else {
      // 返回所有 Partitions 的基础路径
      return join(userDataPath, 'Partitions');
    }
  });

  // 获取 userData 路径
  ipcMain.handle('cache:getUserDataPath', () => {
    return app.getPath('userData');
  });

  // Tab 信息相关 IPC
  ipcMain.handle('tab:getMemoryUsage', async (_, { tabId }: { tabId: string }) => {
    if (tabManager) {
      return await tabManager.getTabMemoryUsage(tabId);
    }
    return null;
  });

  ipcMain.handle('tab:getCookies', async (_, { tabId, url }: { tabId: string; url?: string }) => {
    if (tabManager) {
      return await tabManager.getTabCookies(tabId, url);
    }
    return [];
  });

  ipcMain.handle('tab:executeScript', async (_, { tabId, code }: { tabId: string; code: string }) => {
    if (tabManager) {
      return await tabManager.executeScript(tabId, code);
    }
    throw new Error('TabManager not initialized');
  });

  ipcMain.handle('tab:openDevTools', async (_, { tabId }: { tabId: string }) => {
    if (tabManager) {
      tabManager.openDevTools(tabId);
      return;
    }
    throw new Error('TabManager not initialized');
  });

  // 导航相关 IPC
  ipcMain.handle('tab:goBack', async (_, { tabId }: { tabId: string }) => {
    if (tabManager) {
      return tabManager.goBack(tabId);
    }
    throw new Error('TabManager not initialized');
  });

  ipcMain.handle('tab:goForward', async (_, { tabId }: { tabId: string }) => {
    if (tabManager) {
      return tabManager.goForward(tabId);
    }
    throw new Error('TabManager not initialized');
  });

  ipcMain.handle('tab:reload', async (_, { tabId }: { tabId: string }) => {
    if (tabManager) {
      return tabManager.reloadTab(tabId);
    }
    throw new Error('TabManager not initialized');
  });

  ipcMain.handle('tab:stop', async (_, { tabId }: { tabId: string }) => {
    if (tabManager) {
      return tabManager.stop(tabId);
    }
    throw new Error('TabManager not initialized');
  });

  ipcMain.handle('tab:navigate', async (_, { tabId, url }: { tabId: string; url: string }) => {
    if (tabManager) {
      return tabManager.navigateTab(tabId, url);
    }
    throw new Error('TabManager not initialized');
  });

  ipcMain.handle('tab:getNavigationState', async (_, { tabId }: { tabId: string }) => {
    if (tabManager) {
      return tabManager.getNavigationState(tabId);
    }
    throw new Error('TabManager not initialized');
  });

  ipcMain.handle('tab:downloadUrl', async (_, { tabId, url }: { tabId: string; url: string }) => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return await tabManager.downloadUrl(tabId, url);
  });

  // 文件上传扫描 IPC
  ipcMain.handle('tab:triggerFileUploadScan', async (_, { tabId, imagePaths }: { tabId: string; imagePaths?: string[] }) => {
    if (!tabManager) {
      throw new Error('TabManager not initialized');
    }
    return await tabManager.triggerFileUploadScan(tabId, imagePaths);
  });

  // 下载相关 IPC
  ipcMain.handle('download:list', async () => {
    if (!downloadManager) {
      return [];
    }
    return downloadManager.getAllDownloads();
  });

  ipcMain.handle('download:listByTab', async (_, { tabId }: { tabId: string }) => {
    if (!downloadManager) {
      return [];
    }
    return downloadManager.getDownloadsByTabId(tabId);
  });

  ipcMain.handle('download:cancel', async (_, { downloadId }: { downloadId: string }) => {
    if (!downloadManager) {
      return false;
    }
    return downloadManager.cancelDownload(downloadId);
  });

  ipcMain.handle('download:pause', async (_, { downloadId }: { downloadId: string }) => {
    if (!downloadManager) {
      return false;
    }
    return downloadManager.pauseDownload(downloadId);
  });

  ipcMain.handle('download:resume', async (_, { downloadId }: { downloadId: string }) => {
    if (!downloadManager) {
      return false;
    }
    return downloadManager.resumeDownload(downloadId);
  });

  ipcMain.handle('download:remove', async (_, { downloadId }: { downloadId: string }) => {
    if (!downloadManager) {
      return false;
    }
    return downloadManager.removeDownload(downloadId);
  });

  // 选择目录 IPC
  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择图片目录'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    return result.filePaths[0];
  });

  // 读取目录中的图片文件 IPC
  ipcMain.handle('fs:readImageFiles', async (_, { directory }: { directory: string }) => {
    try {
      const files = await readdir(directory);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      const imageFilesWithCtime: { filePath: string; ctimeMs: number }[] = [];
      
      for (const file of files) {
        const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
        if (imageExtensions.includes(ext)) {
          const filePath = join(directory, file);
          const stats = await stat(filePath);
          if (stats.isFile()) {
            imageFilesWithCtime.push({ filePath, ctimeMs: stats.ctimeMs });
          }
        }
      }
      
      // 按文件创建时间排序, 旧的在前, 新的在后
      imageFilesWithCtime.sort((a, b) => a.ctimeMs - b.ctimeMs);

      // 只返回文件路径数组
      return imageFilesWithCtime.map(item => item.filePath);
    } catch (error: any) {
      throw new Error(`读取目录失败: ${error.message}`);
    }
  });

  // 读取图片文件并转换为 base64 IPC
  ipcMain.handle('fs:readImageAsBase64', async (_, { filePath }: { filePath: string }) => {
    try {
      const fileBuffer = await readFile(filePath);
      const base64 = fileBuffer.toString('base64');
      
      // 根据文件扩展名确定 MIME 类型
      const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.bmp') mimeType = 'image/bmp';
      else if (ext === '.webp') mimeType = 'image/webp';
      
      return `data:${mimeType};base64,${base64}`;
    } catch (error: any) {
      throw new Error(`读取图片失败: ${error.message}`);
    }
  });

  // 保存应用图标到本地 IPC
  ipcMain.handle('fs:saveAppIcon', async (_, { appId, base64Data }: { appId: string; base64Data: string }) => {
    try {
      const userDataPath = app.getPath('userData');
      const iconsDir = join(userDataPath, 'app-icons');
      
      // 确保图标目录存在
      if (!existsSync(iconsDir)) {
        await mkdir(iconsDir, { recursive: true });
      }
      
      // 解析 base64 数据 - 支持 svg+xml 等复杂的 MIME 类型
      const matches = base64Data.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('无效的 base64 图片数据');
      }
      
      let imageType = matches[1];
      const base64Content = matches[2];
      const buffer = Buffer.from(base64Content, 'base64');
      
      // 处理特殊的 MIME 类型
      if (imageType === 'svg+xml') {
        imageType = 'svg';
      } else if (imageType === 'x-icon') {
        imageType = 'ico';
      }
      
      // 生成图标文件名
      const iconFileName = `${appId}.${imageType}`;
      const iconPath = join(iconsDir, iconFileName);
      
      // 保存文件
      await writeFile(iconPath, buffer);
      
      console.log('[IPC] 保存应用图标成功:', iconPath);
      return { success: true, iconPath };
    } catch (error: any) {
      console.error('[IPC] 保存应用图标失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 保存通用配置 IPC
  ipcMain.handle('config:save', async (_, { namespace, key, config }: { namespace: string; key: string; config: any }) => {
    try {
      const userDataPath = app.getPath('userData');
      const configDir = join(userDataPath, 'panel-configs', namespace);
      
      // 确保目录存在
      if (!existsSync(configDir)) {
        await mkdir(configDir, { recursive: true });
      }
      
      const configPath = join(configDir, `${key}.json`);
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log("[IPC] 保存配置成功,存储路径:",configPath)
      return { success: true };
    } catch (error: any) {
      console.error(`[IPC] 保存配置失败 (${namespace}/${key}):`, error);
      return { success: false, error: error.message };
    }
  });

  // 读取通用配置 IPC
  ipcMain.handle('config:load', async (_, { namespace, key }: { namespace: string; key: string }) => {
    try {
      const userDataPath = app.getPath('userData');
      const configPath = join(userDataPath, 'panel-configs', namespace, `${key}.json`);

      if (!existsSync(configPath)) {
        return { success: false, config: null };
      }

      const configData = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      return { success: true, config };
    } catch (error: any) {
      console.error(`[IPC] 读取配置失败 (${namespace}/${key}):`, error);
      return { success: false, config: null, error: error.message };
    }
  });

  // Session 管理 IPC
  ipcMain.handle('session:list', async () => {
    const SessionStorage = await import('./session-storage');
    const sessions = SessionStorage.getAllSessions();
    // 标记正在运行的 session
    if (tabManager) {
      const runningSessionIds = new Set(
        Array.from(tabManager.getTabs().values()).map(t => t.configId).filter(Boolean)
      );
      return sessions.map(s => ({
        ...s,
        isRunning: runningSessionIds.has(s.id),
      }));
    }
    return sessions;
  });

  ipcMain.handle('session:get', async (_, { sessionId }: { sessionId: string }) => {
    const SessionStorage = await import('./session-storage');
    return SessionStorage.getSessionById(sessionId);
  });

  ipcMain.handle('session:create', async (_, { name, url, note }: { name: string; url: string; note?: string }) => {
    const SessionStorage = await import('./session-storage');
    const id = SessionStorage.generateSessionId(name);
    return SessionStorage.saveSession({
      id,
      name,
      url,
      note,
      partition: `persist:${id}`,
    });
  });

  ipcMain.handle('session:delete', async (_, { sessionId }: { sessionId: string }) => {
    const SessionStorage = await import('./session-storage');
    // 先关闭该 session 的所有标签页
    if (tabManager) {
      const tabs = Array.from(tabManager.getTabs().values());
      for (const tab of tabs) {
        if (tab.configId === sessionId) {
          await tabManager.closeTab(tab.id);
        }
      }
    }
    // 删除 session 配置
    const deleted = SessionStorage.deleteSession(sessionId);
    // 可选：删除缓存目录
    // const cachePath = SessionStorage.getSessionCachePath(sessionId);
    // if (existsSync(cachePath)) { rmSync(cachePath, { recursive: true }); }
    return deleted;
  });

  ipcMain.handle('session:open', async (_, { sessionId }: { sessionId: string }) => {
    const SessionStorage = await import('./session-storage');
    const session = SessionStorage.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    // 更新最后使用时间
    SessionStorage.updateLastUsed(sessionId);
    // 创建标签页
    if (tabManager) {
      const tab = await tabManager.createTab(session.id, session.url, session.id, session.name);
      return tab;
    }
    throw new Error('TabManager not initialized');
  });

  // 应用管理 IPC（与 CLI/API 共享数据）
  ipcMain.handle('app:list', async () => {
    const AppStorage = await import('./app-storage');
    return AppStorage.getAllApps();
  });

  ipcMain.handle('app:get', async (_, { appId }: { appId: string }) => {
    const AppStorage = await import('./app-storage');
    return AppStorage.getAppById(appId);
  });

  ipcMain.handle('app:save', async (_, { app: appConfig }: { app: any }) => {
    const AppStorage = await import('./app-storage');
    return AppStorage.saveApp(appConfig);
  });

  ipcMain.handle('app:delete', async (_, { appId }: { appId: string }) => {
    const AppStorage = await import('./app-storage');
    return AppStorage.deleteApp(appId);
  });

}

