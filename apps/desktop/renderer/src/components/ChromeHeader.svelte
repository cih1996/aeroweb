<script lang="ts">
  import { createEventDispatcher } from 'svelte';

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

  export let tabs: Tab[] = [];
  export let activeTabId: string | null = null;
  export let platform: 'darwin' | 'win32' | 'linux' = 'darwin';

  const dispatch = createEventDispatcher();

  // macOS 的红绿灯按钮需要留出空间
  $: trafficLightPadding = platform === 'darwin' ? 78 : 0;

  // 只显示根标签页（没有 parentTabId 的标签）
  $: rootTabs = tabs.filter(t => !t.parentTabId);

  // 获取当前激活的根标签 ID
  $: activeRootTabId = getActiveRootTabId(activeTabId);

  function getActiveRootTabId(tabId: string | null): string | null {
    if (!tabId) return null;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return null;
    if (!tab.parentTabId) return tabId;
    // 递归查找根标签
    return getActiveRootTabId(tab.parentTabId);
  }

  function handleActivate(tabId: string) {
    dispatch('activate', { tabId });
  }

  function handleClose(tabId: string, event: MouseEvent) {
    event.stopPropagation();
    dispatch('close', { tabId });
  }

  function handleNewTab() {
    dispatch('newTab');
  }

  function handleMinimize() {
    dispatch('minimize');
  }

  function handleMaximize() {
    dispatch('maximize');
  }

  function handleCloseWindow() {
    dispatch('closeWindow');
  }

  function getTabTitle(tab: Tab): string {
    if (tab.title && tab.title !== 'about:blank') {
      return tab.title;
    }
    return tab.sessionName || '新标签页';
  }

  function getTabIcon(tab: Tab): string {
    return (tab.sessionName || tab.title || 'N').charAt(0).toUpperCase();
  }
</script>

<header class="chrome-header" style="--traffic-light-padding: {trafficLightPadding}px">
  <!-- macOS 拖拽区域（红绿灯按钮位置） -->
  {#if platform === 'darwin'}
    <div class="drag-region macos"></div>
  {/if}

  <!-- 标签页区域 -->
  <div class="tabs-container">
    {#each rootTabs as tab (tab.id)}
      <button
        class="tab"
        class:active={tab.id === activeRootTabId}
        class:has-children={tab.childTabIds && tab.childTabIds.length > 0}
        on:click={() => handleActivate(tab.id)}
        title={getTabTitle(tab)}
      >
        <span class="tab-icon">
          {#if tab.isLoading}
            <div class="loading-spinner"></div>
          {:else}
            {getTabIcon(tab)}
          {/if}
        </span>
        <span class="tab-title">{getTabTitle(tab)}</span>
        {#if tab.childTabIds && tab.childTabIds.length > 0}
          <span class="child-count">{tab.childTabIds.length + 1}</span>
        {/if}
        <button
          class="tab-close"
          on:click={(e) => handleClose(tab.id, e)}
          title="关闭"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </button>
    {/each}

    <!-- 新建标签页按钮 -->
    <button class="new-tab-btn" on:click={handleNewTab} title="新建标签页">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <!-- 中间拖拽区域 -->
  <div class="drag-region center"></div>

  <!-- Windows/Linux 窗口控制按钮 -->
  {#if platform !== 'darwin'}
    <div class="window-controls">
      <button class="control-btn" on:click={handleMinimize} title="最小化">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 5H9" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
      <button class="control-btn" on:click={handleMaximize} title="最大化">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="1" y="1" width="8" height="8" stroke="currentColor" stroke-width="1.2" fill="none"/>
        </svg>
      </button>
      <button class="control-btn close" on:click={handleCloseWindow} title="关闭">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
    </div>
  {/if}
</header>

<style>
  .chrome-header {
    display: flex;
    align-items: center;
    height: 40px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-primary);
    -webkit-app-region: drag;
    user-select: none;
  }

  .drag-region {
    -webkit-app-region: drag;
  }

  .drag-region.macos {
    width: var(--traffic-light-padding);
    height: 100%;
    flex-shrink: 0;
  }

  .drag-region.center {
    flex: 1;
    height: 100%;
    min-width: 20px;
  }

  .tabs-container {
    display: flex;
    align-items: stretch;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-app-region: no-drag;
    max-width: calc(100% - 150px);
  }

  .tabs-container::-webkit-scrollbar {
    height: 0;
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    min-width: 80px;
    max-width: 180px;
    height: 100%;
    background: transparent;
    border: none;
    border-right: 1px solid var(--border-secondary);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
    -webkit-app-region: no-drag;
  }

  .tab:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .tab.active {
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .tab.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent-primary);
  }

  .tab-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-bg);
    border-radius: 3px;
    font-size: 9px;
    font-weight: 600;
    color: var(--accent-primary);
  }

  .loading-spinner {
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--border-secondary);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .tab-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 500;
    text-align: left;
  }

  .child-count {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--accent-bg);
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .tab.has-children {
    border-left: 2px solid var(--accent-primary);
  }

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 3px;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: all 0.12s ease;
  }

  .tab:hover .tab-close {
    opacity: 1;
  }

  .tab-close:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }

  .new-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    min-width: 32px;
    height: 100%;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.12s ease;
    -webkit-app-region: no-drag;
  }

  .new-tab-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  /* Windows/Linux 窗口控制按钮 */
  .window-controls {
    display: flex;
    height: 100%;
    -webkit-app-region: no-drag;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 100%;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.1s ease;
  }

  .control-btn:hover {
    background: var(--bg-hover);
  }

  .control-btn.close:hover {
    background: #e81123;
    color: white;
  }
</style>
