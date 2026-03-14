<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAllApps } from '../utils/app-storage';
  import type { AppConfig } from '../types/app-config';

  export let activeView: 'apps' | 'my-apps' | string = 'apps';
  export let tabs: any[] = [];

  const dispatch = createEventDispatcher();

  let appConfigs: AppConfig[] = [];

  // 按 appId 分组标签页
  $: appGroups = tabs.reduce((acc, tab) => {
    if (!acc[tab.appId]) {
      acc[tab.appId] = [];
    }
    acc[tab.appId].push(tab);
    return acc;
  }, {} as Record<string, any[]>);

  $: openedAppIds = Object.keys(appGroups);

  onMount(async () => {
    appConfigs = getAllApps();
  });

  function handleViewChange(view: 'apps' | 'my-apps') {
    activeView = view;
    dispatch('viewChange', { view });
  }

  function handleAppClick(appId: string) {
    dispatch('appClick', { appId });
  }

  function getAppConfig(appId: string): AppConfig | undefined {
    return appConfigs.find(app => app.id === appId);
  }

  function getAppTabCount(appId: string): number {
    return appGroups[appId]?.length || 0;
  }
</script>

<aside class="sidebar">
  <!-- 顶部导航 -->
  <nav class="nav-section">
    <button
      class="nav-item"
      class:active={activeView === 'apps'}
      on:click={() => handleViewChange('apps')}
      title="应用中心"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
        <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
        <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
        <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </button>
    <button
      class="nav-item"
      class:active={activeView === 'my-apps'}
      on:click={() => handleViewChange('my-apps')}
      title="我的应用"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2L2 6V12L9 16L16 12V6L9 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M2 6L9 10M9 10L16 6M9 10V16" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    </button>
  </nav>

  <!-- 分隔线 -->
  <div class="divider"></div>

  <!-- 已打开的实例/分身 -->
  {#if openedAppIds.length > 0}
    <div class="instances-section">
      <div class="section-title">实例</div>
      <div class="instances-list">
        {#each openedAppIds as appId (appId)}
          {@const appConfig = getAppConfig(appId)}
          {@const tabCount = getAppTabCount(appId)}
          <button
            class="instance-item"
            class:active={activeView === appId}
            on:click={() => handleAppClick(appId)}
            title={appConfig?.name || appId}
          >
            {#if appConfig?.icon}
              <img src={appConfig.icon} alt="" class="instance-icon" />
            {:else}
              <div class="instance-placeholder">
                {(appConfig?.name || appId).charAt(0).toUpperCase()}
              </div>
            {/if}
            {#if tabCount > 1}
              <span class="instance-badge">{tabCount}</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3"/>
        <path d="M12 8V16M8 12H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span>无实例</span>
    </div>
  {/if}

  <!-- 底部操作 -->
  <div class="footer-section">
    <button class="footer-btn" on:click={() => dispatch('openDownloadList')} title="下载管理">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2V10M8 10L5 7M8 10L11 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 12H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width, 60px);
    height: 100%;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-primary);
    display: flex;
    flex-direction: column;
    padding: 12px 0;
  }

  /* 顶部导航 */
  .nav-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0 10px;
  }

  .nav-item {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-item:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .nav-item.active {
    background: var(--accent-bg);
    color: var(--accent-primary);
  }

  /* 分隔线 */
  .divider {
    height: 1px;
    background: var(--border-secondary);
    margin: 12px 14px;
  }

  /* 实例区域 */
  .instances-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0 10px;
  }

  .section-title {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
    margin-bottom: 8px;
  }

  .instances-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    overflow-y: auto;
    padding: 2px 0;
  }

  .instances-list::-webkit-scrollbar {
    width: 0;
  }

  .instance-item {
    position: relative;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    padding: 0;
  }

  .instance-item:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .instance-item.active {
    background: var(--accent-bg);
    border-color: var(--accent-primary);
  }

  .instance-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    border-radius: 4px;
  }

  .instance-placeholder {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-bg);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-primary);
  }

  .instance-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-size: 10px;
    font-weight: 600;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* 空状态 */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-muted);
    font-size: 11px;
    opacity: 0.6;
  }

  /* 底部 */
  .footer-section {
    padding: 0 10px;
    margin-top: auto;
  }

  .footer-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-secondary);
    border-radius: 10px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    margin: 0 auto;
  }

  .footer-btn:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
    color: var(--text-secondary);
  }
</style>
