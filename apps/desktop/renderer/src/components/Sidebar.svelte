<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import HomeIcon from './icons/HomeIcon.svelte';
  import MyAppsIcon from './icons/MyAppsIcon.svelte';
  import AIIcon from './icons/AIIcon.svelte';
  import { getAllApps } from '../utils/app-storage';
  import type { AppConfig } from '../types/app-config';
  import DownloadIcon from './icons/DownloadIcon.svelte';

  export let activeView: 'apps' | 'my-apps' | string = 'apps';
  export let tabs: any[] = [];

  const dispatch = createEventDispatcher();

  let appConfigs: AppConfig[] = [];

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

  function handleViewChange(view: 'apps' | string) {
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
  <nav class="sidebar-nav">
    <button
      class="nav-item"
      class:active={activeView === 'apps'}
      on:click={() => handleViewChange('apps')}
    >
      <HomeIcon />
      <span>应用中心</span>
    </button>
    <button
      class="nav-item"
      class:active={activeView === 'my-apps'}
      on:click={() => handleViewChange('my-apps')}
    >
      <MyAppsIcon />
      <span>我的应用</span>
    </button>
  </nav>

  {#if openedAppIds.length > 0}
    <div class="opened-apps">
      <div class="section-label">已打开</div>
      <div class="opened-apps-list">
        {#each openedAppIds as appId (appId)}
          {@const appConfig = getAppConfig(appId)}
          {@const tabCount = getAppTabCount(appId)}
          <button
            class="app-item"
            class:active={activeView === appId}
            on:click={() => handleAppClick(appId)}
            title={appConfig?.name || appId}
          >
            {#if appConfig?.icon}
              <img
                src={appConfig.icon}
                alt={appConfig.name}
                class="app-icon"
              />
            {:else}
              <div class="app-icon-placeholder">
                {appId.charAt(0).toUpperCase()}
              </div>
            {/if}
            {#if tabCount > 1}
              <span class="badge">{tabCount}</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="sidebar-footer">
    <button class="footer-btn" on:click={() => dispatch('openDownloadList')}>
      <DownloadIcon />
      <span>下载</span>
    </button>
    <button class="footer-btn" on:click={() => dispatch('openAIConfig')}>
      <AIIcon />
      <span>AI</span>
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: var(--sidebar-width);
    height: 100%;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-primary);
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .sidebar-nav {
    padding: var(--spacing-lg) var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
    text-align: left;
    width: 100%;
  }

  .nav-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .nav-item.active {
    background: var(--accent-bg);
    color: var(--text-primary);
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 60%;
    background: var(--accent-primary);
    border-radius: 0 2px 2px 0;
  }

  .opened-apps {
    flex: 1;
    padding: var(--spacing-lg) var(--spacing-md);
    border-top: 1px solid var(--border-secondary);
    overflow-y: auto;
  }

  .section-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--spacing-md);
    padding: 0 var(--spacing-sm);
  }

  .opened-apps-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    justify-content: center;
  }

  .app-item {
    position: relative;
    width: 48px;
    height: 48px;
    padding: 0;
    background: var(--bg-hover);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-item:hover {
    background: var(--bg-active);
    border-color: var(--border-hover);
    transform: translateY(-2px);
  }

  .app-item.active {
    background: var(--accent-bg);
    border-color: var(--accent-primary);
    box-shadow: var(--shadow-glow);
  }

  .app-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  .app-icon-placeholder {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--accent-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: var(--font-weight-bold);
    font-size: var(--font-size-base);
    color: var(--text-primary);
  }

  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-size: 10px;
    font-weight: var(--font-weight-bold);
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
  }

  .sidebar-footer {
    padding: var(--spacing-md);
    border-top: 1px solid var(--border-secondary);
    display: flex;
    gap: var(--spacing-sm);
  }

  .footer-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-md);
    background: var(--bg-hover);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .footer-btn:hover {
    background: var(--bg-active);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }
</style>
