<script lang="ts">
  import './styles/theme.css';
  import TitleBar from './components/TitleBar.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import AppGrid from './components/AppGrid.svelte';
  import MyAppsView from './components/MyAppsView.svelte';
  import LoadingOverlay from './components/LoadingOverlay.svelte';
  import TabBar from './components/TabBar.svelte';
  import BrowserConfigModal from './components/BrowserConfigModal.svelte';
  import TabPropertiesModal from './components/TabPropertiesModal.svelte';
  import DownloadPopup from './components/DownloadPopup.svelte';
  import ThemeProvider from './components/ThemeProvider.svelte';
  import type { Theme } from './components/ThemeProvider.svelte';
  import { onMount } from 'svelte';
  import { getAppById } from './utils/app-storage';
  import { saveConfig, getAllConfigs, updateLastUsed } from './utils/browser-config-storage';
  import type { BrowserConfig } from './types/browser-config';

  let tabs: any[] = [];
  let activeTabId: string | null = null;
  let activeView: 'apps' | 'my-apps' | string = 'apps'; // 'apps', 'my-apps' 或 appId
  let isLoading = false;
  let loadingAppName = '';
  
  // 配置模态框相关
  let showConfigModal = false;
  let pendingAppId = '';
  let pendingAppName = '';
  let pendingAppUrl = '';
  let browserConfigs: BrowserConfig[] = [];
  
  // Tab 属性模态框相关
  let showPropertiesModal = false;
  let propertiesTab: any = null;

  // 主题相关
  let themeProvider: ThemeProvider;
  let currentTheme: Theme = 'system';
  let resolvedTheme: 'light' | 'dark' = 'dark';

  // 下载弹窗
  let showDownloadPopup = false;

  // 按应用分组的配置列表
  $: groupedConfigs = browserConfigs.reduce((acc: Record<string, BrowserConfig[]>, config) => {
    if (!acc[config.appId]) {
      acc[config.appId] = [];
    }
    acc[config.appId].push(config);
    return acc;
  }, {});

  // 应用 ID 到名称的映射
  let appNameMap: Record<string, string> = {};
  
  // 异步加载应用名称映射
  $: {
    const appIds = Object.keys(groupedConfigs);
    if (appIds.length > 0) {
      Promise.all(
        appIds.map(async (appId) => {
          const appConfig = await getAppById(appId);
          return { appId, name: appConfig?.name || appId };
        })
      ).then((results) => {
        const newMap: Record<string, string> = {};
        results.forEach(({ appId, name }) => {
          newMap[appId] = name;
        });
        appNameMap = newMap;
      });
    }
  }
  
  // 按应用 ID 分组 tabs（排除 'apps' 和 'my-apps'）
  $: appTabs = activeView !== 'apps' && activeView !== 'my-apps'
    ? tabs.filter(t => t.appId === activeView)
    : [];
  
  // 计算是否有激活的 tab（如果有，显示浏览器内容）
  // 注意：'my-apps' 视图不应该显示浏览器内容，所以明确排除
  $: hasActiveTab = activeView !== 'apps' && activeView !== 'my-apps' && appTabs.some(t => t.active) && !isLoading;

  onMount(async () => {
    await loadTabs();
    browserConfigs = getAllConfigs();
    
    // 监听 Tab 更新事件
    window.electronAPI.on('tab:update', (data: any) => {
      loadTabs();
    });
    
    window.electronAPI.on('tab:activate', (data: any) => {
      activeTabId = data.tabId;
      loadTabs();
    });

    // 监听 Tab 加载完成事件
    window.electronAPI.on('tab:loaded', (data: any) => {
      // 页面加载完成，隐藏加载状态
      if (isLoading && data.tabId) {
        isLoading = false;
      }
      loadTabs();
    });

    // 监听 Tab 错误事件
    window.electronAPI.on('tab:error', (data: any) => {
      console.error('Tab 加载错误:', data);
      isLoading = false;
    });
  });

  async function loadTabs() {
    tabs = await window.electronAPI.tab.list();
    const activeTab = tabs.find(t => t.active);
    if (activeTab) {
      activeTabId = activeTab.id;
    }
  }

  async function createTab(appId: string, configId?: string, configName?: string) {
    // 立即显示加载状态
    isLoading = true;
    
    try {
      // 从配置文件获取应用信息
      const appConfig = await getAppById(appId);
      if (!appConfig) {
        throw new Error(`应用 ${appId} 未找到`);
      }
      
      loadingAppName = configName || appConfig.name;
      const url = appConfig.url;
      
      // 切换到该应用的视图
      activeView = appId;
      
      // 创建 Tab（这会创建 BrowserView 并开始加载 URL）
      await window.electronAPI.tab.create(appId, url, configId, configName);
      await loadTabs();
      
      // 如果使用了已有配置，更新最后使用时间
      if (configId) {
        updateLastUsed(configId);
      }
      
      // 加载状态会在 tab:loaded 事件中自动隐藏
      // 设置超时，防止页面加载失败时一直显示加载状态
      setTimeout(() => {
        if (isLoading) {
          isLoading = false;
        }
      }, 10000); // 10秒超时
    } catch (error) {
      console.error('创建 Tab 失败:', error);
      isLoading = false;
    }
  }

  function handleConfigSubmit(event: CustomEvent) {
    const { name } = event.detail;
    const appId = pendingAppId;
    const appUrl = pendingAppUrl;
    
    // 创建浏览器配置
    const configId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const config: BrowserConfig = {
      id: configId,
      appId,
      name,
      url: appUrl,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
    
    saveConfig(config);
    browserConfigs = getAllConfigs();
    
    // 使用配置创建 tab
    createTab(appId, configId, name);
  }

  function handleOpenConfig(config: BrowserConfig) {
    // 检查该配置是否已经有打开的 tab
    const existingTab = tabs.find(t => t.configId === config.id);
    
    if (existingTab) {
      // 如果已经有打开的 tab，切换到该 tab
      activateTab(existingTab.id);
      updateLastUsed(config.id);
    } else {
      // 如果没有打开的 tab，创建新的 tab 并加载缓存
      updateLastUsed(config.id);
      createTab(config.appId, config.id, config.name);
    }
  }

  function handleBatchRun(event: CustomEvent) {
    // 批量运行配置
    const configs = event.detail.configs;
    if (Array.isArray(configs)) {
      configs.forEach((config: BrowserConfig) => {
        handleOpenConfig(config);
      });
    }
  }

  function handleConfigsDeleted() {
    // 重新加载配置列表
    browserConfigs = getAllConfigs();
  }

  async function handleContextMenuAction(tabId: string, action: string) {
    console.log('[App] handleContextMenuAction called, tabId:', tabId, 'action:', action);
    if (action === 'properties') {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        console.log('[App] Opening properties modal for tab:', tab);
        propertiesTab = tab;
        showPropertiesModal = true;
        // BrowserView 已经在右键菜单时临时隐藏了，这里不需要再次隐藏
      } else {
        console.warn('[App] Tab not found:', tabId);
      }
    }
  }

  async function handlePropertiesModalClose() {
    console.log('[App] handlePropertiesModalClose called');
    showPropertiesModal = false;
    propertiesTab = null;
    // 恢复显示 BrowserView
    try {
      console.log('[App] Calling restoreHidden...');
      await window.electronAPI.view.restoreHidden();
      console.log('[App] restoreHidden completed');
    } catch (error) {
      console.error('[App] 恢复浏览器失败:', error);
    }
  }

  async function activateTab(tabId: string) {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      // 切换到该应用视图
      activeView = tab.appId;
      await window.electronAPI.view.showBrowser(tabId);
      await window.electronAPI.tab.activate(tabId);
      await loadTabs();
    }
  }

  async function closeTab(tabId: string) {
    const tab = tabs.find(t => t.id === tabId);
    const appId = tab?.appId;
    
    await window.electronAPI.tab.close(tabId);
    await loadTabs();
    
    // 如果关闭的是当前激活的 tab，切换到应用中心或该应用的其他 tab
    if (tab && appId) {
      const remainingTabs = tabs.filter(t => t.appId === appId && t.id !== tabId);
      if (remainingTabs.length === 0) {
        // 该应用没有其他 tab 了，切换回应用中心
        activeView = 'apps';
        await window.electronAPI.view.hideBrowser();
      } else {
        // 激活该应用的第一个 tab
        await activateTab(remainingTabs[0].id);
      }
    }
  }

  async function handleViewChange(event: CustomEvent) {
    const newView = event.detail.view;

    if (newView === 'apps' || newView === 'my-apps') {
      await window.electronAPI.view.hideBrowser();
      activeView = newView;
      await loadTabs();
      if (newView === 'my-apps') {
        browserConfigs = getAllConfigs();
      }
    } else {
      activeView = newView;
      await loadTabs();
      // 如果有该应用的激活 tab，显示它
      const activeTab = tabs.find(t => t.appId === newView && t.active);
      if (activeTab) {
        await window.electronAPI.view.showBrowser(activeTab.id);
      } else {
        // 如果没有激活的 tab，激活第一个
        const firstTab = tabs.find(t => t.appId === newView);
        if (firstTab) {
          await activateTab(firstTab.id);
        }
      }
    }
  }

  async function handleAppClick(event: CustomEvent) {
    const appId = event.detail.appId;
    // 在应用中心点击，弹出配置模态框
    const appConfig = await getAppById(appId);
    if (!appConfig) {
      return;
    }
    
    pendingAppId = appId;
    pendingAppName = appConfig.name;
    pendingAppUrl = appConfig.url;
    showConfigModal = true;
  }

  async function handleSidebarAppClick(event: CustomEvent) {
    const appId = event.detail.appId;
    const existingTabs = tabs.filter(t => t.appId === appId);
    if (existingTabs.length > 0) {
      activeView = appId;
      const activeTab = existingTabs.find(t => t.active) || existingTabs[0];
      if (activeTab) {
        activateTab(activeTab.id);
      }
    } else {
      // 如果侧边栏显示的应用实际上没有 tab 了（可能被关闭了），弹出配置模态框
      const appConfig = await getAppById(appId);
      if (appConfig) {
        pendingAppId = appId;
        pendingAppName = appConfig.name;
        pendingAppUrl = appConfig.url;
        showConfigModal = true;
      }
    }
  }

  function handleDownloadToggle() {
    showDownloadPopup = !showDownloadPopup;
  }
</script>

<ThemeProvider
  bind:this={themeProvider}
  bind:theme={currentTheme}
  on:change={(e) => {
    currentTheme = e.detail.theme;
    resolvedTheme = e.detail.resolved;
  }}
  let:toggleTheme
>
<main>
  <TitleBar {currentTheme} {resolvedTheme} on:toggleTheme={toggleTheme} />

  <div class="app-container">
    <Sidebar
      {tabs}
      {activeView}
      on:viewChange={handleViewChange}
      on:appClick={handleSidebarAppClick}
      on:openDownloadList={handleDownloadToggle}
    />

    <div class="main-content">
      {#if activeView !== 'apps' && activeView !== 'my-apps' && appTabs.length > 0}
        <TabBar
          tabs={appTabs}
          activeTabId={activeTabId}
          on:activate={(e) => activateTab(e.detail.tabId)}
          on:close={(e) => closeTab(e.detail.tabId)}
          on:contextMenuAction={(e) => handleContextMenuAction(e.detail.tabId, e.detail.action)}
        />
      {/if}

      {#if isLoading}
        <div class="browser-container">
          <LoadingOverlay appName={loadingAppName} />
        </div>
      {:else if hasActiveTab}
        <div class="browser-container">
          <!-- BrowserView 会通过 Electron 渲染在这里 -->
        </div>
      {:else}
        <div class="content-area">
          {#if activeView === 'apps'}
            <div class="apps-view">
              <div class="view-header">
                <h2>应用中心</h2>
                <p class="subtitle">选择要打开的应用</p>
              </div>
              <AppGrid on:appClick={handleAppClick} />
            </div>
          {:else if activeView === 'my-apps'}
            <MyAppsView 
              configs={browserConfigs}
              on:configClick={(e) => handleOpenConfig(e.detail.config)}
              on:batchRun={handleBatchRun}
              on:configsDeleted={handleConfigsDeleted}
            />
          {/if}
        </div>
      {/if}
    </div>
  </div>
  
  <!-- 配置模态框 -->
  <BrowserConfigModal
    show={showConfigModal}
    appId={pendingAppId}
    appName={pendingAppName}
    appUrl={pendingAppUrl}
    existingConfigs={browserConfigs.filter(c => c.appId === pendingAppId)}
    on:submit={handleConfigSubmit}
    on:close={() => showConfigModal = false}
  />

  <TabPropertiesModal
    show={showPropertiesModal}
    tab={propertiesTab}
    on:close={handlePropertiesModalClose}
  />

  <DownloadPopup
    show={showDownloadPopup}
    on:close={() => showDownloadPopup = false}
  />
</main>
</ThemeProvider>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: var(--font-family);
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    position: relative;
    overflow: hidden;
  }

  .app-container {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .browser-container {
    flex: 1;
    background: var(--bg-primary);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    overflow: hidden;
    z-index: 1;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    z-index: 1;
    margin-left: 0; /* 侧边栏已经在 app-container 中 */
  }

  .apps-view {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .apps-view::-webkit-scrollbar {
    width: 8px;
  }

  .apps-view::-webkit-scrollbar-track {
    background: transparent;
  }

  .apps-view::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: var(--radius-sm);
  }

  .apps-view::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  .view-header {
    padding: var(--spacing-2xl) var(--spacing-2xl) var(--spacing-xl);
    border-bottom: 1px solid var(--border-primary);
  }

  .view-header h2 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-tertiary);
    font-weight: var(--font-weight-normal);
  }
</style>
