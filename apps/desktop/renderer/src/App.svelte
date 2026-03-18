<script lang="ts">
  import './styles/theme.css';
  import ChromeHeader from './components/ChromeHeader.svelte';
  import AddressBar from './components/AddressBar.svelte';
  import SubTabBar from './components/SubTabBar.svelte';
  import LoadingOverlay from './components/LoadingOverlay.svelte';
  import DownloadPopup from './components/DownloadPopup.svelte';
  import ThemeProvider from './components/ThemeProvider.svelte';
  import type { Theme } from './components/ThemeProvider.svelte';
  import { onMount } from 'svelte';

  interface Session {
    id: string;
    name: string;
    url: string;
    icon?: string;
    color?: string;
    note?: string;
    partition: string;
    lastUsedAt: number;
    isRunning?: boolean;
  }

  interface Tab {
    id: string;
    sessionId: string;
    sessionName: string;
    title: string;
    url: string;
    isLoading?: boolean;
    parentTabId?: string;
    childTabIds?: string[];
  }

  interface SubTab {
    id: string;
    title: string;
    url: string;
    active: boolean;
  }

  let tabs: Tab[] = [];
  let activeTabId: string | null = null;
  let sessions: Session[] = [];
  let isLoading = false;
  let loadingMessage = '';

  // 子标签页相关
  let subTabs: SubTab[] = [];
  let activeRootTabId: string | null = null;

  // 导航状态
  let navState = {
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
    url: '',
  };

  // 新建 Session 表单
  let showCreateForm = false;
  let newSessionName = '';
  let newSessionUrl = 'https://';
  let newSessionNote = '';

  // 主题相关
  let themeProvider: ThemeProvider;
  let currentTheme: Theme = 'system';
  let resolvedTheme: 'light' | 'dark' = 'dark';

  // 下载弹窗
  let showDownloadPopup = false;

  // 平台
  let platform: 'darwin' | 'win32' | 'linux' = 'darwin';

  // 当前激活的 tab
  $: activeTab = tabs.find(t => t.id === activeTabId);
  // 是否显示浏览器（有激活的标签页时显示）
  $: showBrowser = activeTabId !== null;

  // 防抖函数
  function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return ((...args: any[]) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    }) as T;
  }

  // 防抖的 loadTabs（200ms 内多次调用只执行一次）
  const debouncedLoadTabs = debounce(async () => {
    await loadTabs();
  }, 200);

  // 防抖的导航状态更新
  const debouncedUpdateNavState = debounce(async (tabId: string) => {
    await updateNavState(tabId);
  }, 100);

  onMount(async () => {
    // 检测平台
    platform = (navigator.platform.toLowerCase().includes('mac') ? 'darwin' :
                navigator.platform.toLowerCase().includes('win') ? 'win32' : 'linux') as any;

    await loadSessions();
    await loadTabs();

    // 监听 Tab 更新事件（使用防抖）
    window.electronAPI.on('tab:update', async (data: any) => {
      // 只更新单个 tab 的数据，不重新加载全部
      const tabIndex = tabs.findIndex(t => t.id === data.tabId);
      if (tabIndex >= 0 && data.updates) {
        tabs[tabIndex] = { ...tabs[tabIndex], ...data.updates };
        tabs = tabs; // 触发 Svelte 响应
      } else {
        debouncedLoadTabs();
      }
    });

    window.electronAPI.on('tab:activate', async (data: any) => {
      activeTabId = data.tabId;
      if (data.tabId) {
        updateSubTabs(data.tabId);
        debouncedUpdateNavState(data.tabId);
      }
    });

    window.electronAPI.on('tab:loaded', async (data: any) => {
      // 只更新导航状态，不重新加载 tabs
      if (data.tabId === activeTabId) {
        debouncedUpdateNavState(data.tabId);
      }
    });

    window.electronAPI.on('tab:error', (data: any) => {
      console.error('Tab 加载错误:', data);
      isLoading = false;
    });
  });

  async function loadSessions() {
    sessions = await window.electronAPI.session.list();
  }

  async function loadTabs() {
    const rawTabs = await window.electronAPI.tab.list();
    tabs = rawTabs.map((t: any) => ({
      id: t.id,
      sessionId: t.configId || t.appId,
      sessionName: t.configName || t.appName || t.appId,
      title: t.title,
      url: t.url,
      isLoading: false,
      parentTabId: t.parentTabId,
      childTabIds: t.childTabIds || [],
    }));
    const activeTab = rawTabs.find((t: any) => t.active);
    if (activeTab) {
      // 只在没有 activeTabId 或 activeTabId 不在 tabs 中时更新
      if (!activeTabId || !tabs.find(t => t.id === activeTabId)) {
        activeTabId = activeTab.id;
      }
      updateSubTabs(activeTabId || activeTab.id);
    }
  }

  // 更新子标签页列表
  function updateSubTabs(currentTabId: string) {
    const currentTab = tabs.find(t => t.id === currentTabId);
    if (!currentTab) {
      subTabs = [];
      activeRootTabId = null;
      return;
    }

    // 找到根标签页
    let rootTab = currentTab;
    while (rootTab.parentTabId) {
      const parent = tabs.find(t => t.id === rootTab.parentTabId);
      if (parent) {
        rootTab = parent;
      } else {
        break;
      }
    }
    activeRootTabId = rootTab.id;

    // 如果根标签有子标签，构建子标签列表
    if (rootTab.childTabIds && rootTab.childTabIds.length > 0) {
      // 包含根标签本身和所有子标签
      const allTabs = [rootTab, ...rootTab.childTabIds.map(id => tabs.find(t => t.id === id)).filter(Boolean)] as Tab[];
      subTabs = allTabs.map(t => ({
        id: t.id,
        title: t.title || t.sessionName,
        url: t.url,
        active: t.id === currentTabId,
      }));
    } else {
      subTabs = [];
    }
  }

  async function updateNavState(tabId: string) {
    try {
      const state = await window.electronAPI.tab.getNavigationState(tabId);
      if (state) {
        navState = state;
      }
    } catch (e) {
      console.error('获取导航状态失败:', e);
    }
  }

  // 获取网站 favicon URL
  function getFaviconUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    } catch {
      return '';
    }
  }

  // 打开 Session（创建标签页）
  async function openSession(session: Session) {
    isLoading = true;
    loadingMessage = `正在打开 ${session.name}...`;
    showCreateForm = false;

    try {
      const tab = await window.electronAPI.session.open(session.id);
      // 立即设置 activeTabId，确保 showBrowser 为 true
      if (tab && tab.id) {
        activeTabId = tab.id;
      }
      await loadTabs();
      await loadSessions();
      // 加载完成后关闭 loading
      isLoading = false;
    } catch (error) {
      console.error('打开 Session 失败:', error);
      isLoading = false;
    }
  }

  // 创建新 Session
  async function handleCreateSession() {
    if (!newSessionName.trim() || !newSessionUrl.trim()) return;

    try {
      const session = await window.electronAPI.session.create(
        newSessionName.trim(),
        newSessionUrl.trim(),
        newSessionNote.trim() || undefined
      );
      newSessionName = '';
      newSessionUrl = 'https://';
      newSessionNote = '';
      showCreateForm = false;
      await loadSessions();
      await openSession(session);
    } catch (error) {
      console.error('创建 Session 失败:', error);
    }
  }

  // 删除 Session
  async function deleteSession(sessionId: string, event: MouseEvent) {
    event.stopPropagation();
    const session = sessions.find(s => s.id === sessionId);
    if (session && confirm(`确定要删除 "${session.name}" 吗？\n注意：这会清除该会话的所有缓存数据（包括登录状态）`)) {
      try {
        await window.electronAPI.session.delete(sessionId);
        await loadSessions();
        await loadTabs();
      } catch (error) {
        console.error('删除 Session 失败:', error);
      }
    }
  }

  async function activateTab(tabId: string) {
    await window.electronAPI.view.showBrowser(tabId);
    await window.electronAPI.tab.activate(tabId);
    activeTabId = tabId;
    await loadTabs();
    await updateNavState(tabId);
    updateSubTabs(tabId);
  }

  // 激活子标签页
  async function activateSubTab(tabId: string) {
    await activateTab(tabId);
  }

  // 关闭子标签页
  async function closeSubTab(tabId: string) {
    await closeTab(tabId);
  }

  async function closeTab(tabId: string) {
    await window.electronAPI.tab.close(tabId);
    await loadTabs();
    await loadSessions();

    if (tabId === activeTabId) {
      if (tabs.length > 0) {
        await activateTab(tabs[0].id);
      } else {
        activeTabId = null;
        await window.electronAPI.view.hideBrowser();
      }
    }
  }

  // 新建标签页 - 回到欢迎页
  async function handleNewTab() {
    await window.electronAPI.view.hideBrowser();
    activeTabId = null;
    await loadSessions();
  }

  // 导航操作
  async function handleBack() {
    if (activeTabId) {
      await window.electronAPI.tab.goBack(activeTabId);
      await updateNavState(activeTabId);
    }
  }

  async function handleForward() {
    if (activeTabId) {
      await window.electronAPI.tab.goForward(activeTabId);
      await updateNavState(activeTabId);
    }
  }

  async function handleRefresh() {
    if (activeTabId) {
      await window.electronAPI.tab.reload(activeTabId);
    }
  }

  async function handleStop() {
    if (activeTabId) {
      await window.electronAPI.tab.stop(activeTabId);
      await updateNavState(activeTabId);
    }
  }

  async function handleNavigate(event: CustomEvent) {
    if (activeTabId) {
      await window.electronAPI.tab.navigate(activeTabId, event.detail.url);
      await updateNavState(activeTabId);
    }
  }

  async function handleDevTools() {
    if (activeTabId) {
      await window.electronAPI.tab.openDevTools(activeTabId);
    }
  }

  // 窗口控制
  function handleMinimize() {
    window.electronAPI.window.minimize();
  }

  function handleMaximize() {
    window.electronAPI.window.maximize();
  }

  function handleCloseWindow() {
    window.electronAPI.window.close();
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
  <!-- Chrome 风格标题栏 + 标签栏 -->
  <ChromeHeader
    {tabs}
    {activeTabId}
    {platform}
    on:activate={(e) => activateTab(e.detail.tabId)}
    on:close={(e) => closeTab(e.detail.tabId)}
    on:newTab={handleNewTab}
    on:minimize={handleMinimize}
    on:maximize={handleMaximize}
    on:closeWindow={handleCloseWindow}
  />

  <div class="app-container">
    <div class="main-content">
      {#if showBrowser}
        <AddressBar
          url={navState.url}
          title={activeTab?.title || ''}
          canGoBack={navState.canGoBack}
          canGoForward={navState.canGoForward}
          isLoading={navState.isLoading}
          on:back={handleBack}
          on:forward={handleForward}
          on:refresh={handleRefresh}
          on:stop={handleStop}
          on:navigate={handleNavigate}
          on:devtools={handleDevTools}
        />
        <!-- 子标签栏（当有子标签时显示） -->
        {#if subTabs.length > 1}
          <SubTabBar
            {subTabs}
            activeSubTabId={activeTabId}
            on:activate={(e) => activateSubTab(e.detail.tabId)}
            on:close={(e) => closeSubTab(e.detail.tabId)}
          />
        {/if}
        <div class="browser-container">
          <!-- BrowserView 会通过 Electron 渲染在这里 -->
        </div>
      {:else if isLoading}
        <div class="browser-container">
          <LoadingOverlay appName={loadingMessage} />
        </div>
      {:else}
        <!-- 欢迎页 -->
        <div class="welcome-view">
          <div class="welcome-content">
            <div class="welcome-header">
              <h1>AeroWeb</h1>
              <p>每个会话有独立缓存，可以登录多个账号</p>
            </div>

            <!-- 新建会话按钮/表单 -->
            {#if showCreateForm}
              <div class="create-form">
                <div class="form-group">
                  <label for="session-name">会话名称</label>
                  <input
                    id="session-name"
                    type="text"
                    bind:value={newSessionName}
                    placeholder="例如：B站-主号"
                    maxlength="20"
                    on:keydown={(e) => e.key === 'Enter' && handleCreateSession()}
                  />
                </div>
                <div class="form-group">
                  <label for="session-url">网址</label>
                  <input
                    id="session-url"
                    type="url"
                    bind:value={newSessionUrl}
                    placeholder="https://www.bilibili.com"
                    on:keydown={(e) => e.key === 'Enter' && handleCreateSession()}
                  />
                </div>
                <div class="form-group">
                  <label for="session-note">备注（可选）</label>
                  <input
                    id="session-note"
                    type="text"
                    bind:value={newSessionNote}
                    placeholder="例如：用于直播的账号"
                    maxlength="50"
                    on:keydown={(e) => e.key === 'Enter' && handleCreateSession()}
                  />
                </div>
                <div class="form-actions">
                  <button class="btn-secondary" on:click={() => showCreateForm = false}>取消</button>
                  <button class="btn-primary" on:click={handleCreateSession}>创建并打开</button>
                </div>
              </div>
            {:else}
              <button class="create-session-btn" on:click={() => showCreateForm = true}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span>新建会话</span>
              </button>
            {/if}

            <!-- 已保存的会话列表 -->
            {#if sessions.length > 0}
              <div class="sessions-section">
                <h3>已保存的会话</h3>
                <div class="sessions-grid">
                  {#each sessions as session (session.id)}
                    <button
                      class="session-card"
                      class:running={session.isRunning}
                      on:click={() => openSession(session)}
                    >
                      <div class="session-favicon">
                        <img
                          src={getFaviconUrl(session.url)}
                          alt=""
                          on:error={(e) => {
                            const target = e.currentTarget;
                            if (target instanceof HTMLImageElement) {
                              target.style.display = 'none';
                              const placeholder = target.nextElementSibling;
                              if (placeholder instanceof HTMLElement) {
                                placeholder.style.display = 'flex';
                              }
                            }
                          }}
                        />
                        <span class="favicon-placeholder">
                          {session.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div class="session-info">
                        <div class="session-name">{session.name}</div>
                        <div class="session-url">{new URL(session.url).hostname}</div>
                        {#if session.note}
                          <div class="session-note">{session.note}</div>
                        {/if}
                      </div>
                      {#if session.isRunning}
                        <span class="running-indicator"></span>
                      {/if}
                      <button
                        class="delete-btn"
                        on:click={(e) => deleteSession(session.id, e)}
                        title="删除会话"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M3 4H11M5 4V3C5 2.5 5.5 2 6 2H8C8.5 2 9 2.5 9 3V4M6 6V10M8 6V10M4 4L4.5 11C4.5 11.5 5 12 5.5 12H8.5C9 12 9.5 11.5 9.5 11L10 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </button>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>

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

  /* 欢迎页样式 */
  .welcome-view {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    padding: 40px;
  }

  .welcome-content {
    text-align: center;
    max-width: 600px;
    width: 100%;
  }

  .welcome-header {
    margin-bottom: 32px;
  }

  .welcome-header h1 {
    font-size: 48px;
    font-weight: 700;
    margin: 0 0 8px 0;
    background: linear-gradient(135deg, var(--accent-primary), #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .welcome-header p {
    font-size: 16px;
    color: var(--text-tertiary);
    margin: 0;
  }

  /* 创建会话按钮 */
  .create-session-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .create-session-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* 创建表单 */
  .create-form {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: 12px;
    padding: 20px;
    text-align: left;
    max-width: 400px;
    margin: 0 auto;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .form-group input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }

  .form-group input:focus {
    border-color: var(--accent-primary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }

  .btn-primary, .btn-secondary {
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--accent-primary);
    border: none;
    color: var(--bg-primary);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-primary);
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  /* 会话列表 */
  .sessions-section {
    margin-top: 40px;
    text-align: left;
  }

  .sessions-section h3 {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    margin: 0 0 16px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sessions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .session-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .session-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .session-card.running {
    border-color: var(--accent-primary);
  }

  .session-favicon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    position: relative;
  }

  .session-favicon img {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    object-fit: cover;
  }

  .favicon-placeholder {
    display: none;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    background: var(--accent-bg);
    border-radius: 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--accent-primary);
  }

  .session-info {
    flex: 1;
    min-width: 0;
  }

  .session-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-url {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-note {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-style: italic;
  }

  .running-indicator {
    width: 8px;
    height: 8px;
    background: var(--accent-primary);
    border-radius: 50%;
    flex-shrink: 0;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .delete-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
  }

  .session-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-error);
  }
</style>
