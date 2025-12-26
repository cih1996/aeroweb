<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import HomeIcon from './icons/HomeIcon.svelte';
  import MyAppsIcon from './icons/MyAppsIcon.svelte';
  import AIIcon from './icons/AIIcon.svelte';
  import { getAppIconUrl, getApps } from '../utils/app-config';
  import type { AppConfig } from '../types/app-config';
  import DownloadIcon from './icons/DownloadIcon.svelte';
  
  export let activeView: 'apps' | 'my-apps' | string = 'apps'; // 'apps', 'my-apps' 或 appId
  export let tabs: any[] = [];

  const dispatch = createEventDispatcher();

  let appConfigs: AppConfig[] = [];

  // 按应用 ID 分组 tabs
  $: appGroups = tabs.reduce((acc, tab) => {
    if (!acc[tab.appId]) {
      acc[tab.appId] = [];
    }
    acc[tab.appId].push(tab);
    return acc;
  }, {} as Record<string, any[]>);

  // 获取已打开的应用列表（去重）
  $: openedAppIds = Object.keys(appGroups);

  onMount(async () => {
    appConfigs = await getApps();
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
  <div class="sidebar-header">
    <div class="logo">
      <img src="./logo.svg" alt="奇易聚合浏览AI+" class="logo-icon" />
    </div>
    <div class="app-title">
      <h1>奇易聚合浏览AI+</h1>
      <span class="version">V1.0.0</span>
    </div>
  </div>

  <nav class="sidebar-nav">
    <button 
      class="nav-item {activeView === 'apps' ? 'active' : ''}"
      on:click={() => handleViewChange('apps')}
    >
      <HomeIcon />
      <span>应用中心</span>
    </button>
    <button 
      class="nav-item {activeView === 'my-apps' ? 'active' : ''}"
      on:click={() => handleViewChange('my-apps')}
    >
      <MyAppsIcon />
      <span>我的应用</span>
    </button>
  </nav>

  {#if openedAppIds.length > 0}
    <div class="opened-apps">
      <div class="opened-apps-header">
        <span class="opened-apps-title">已打开</span>
      </div>
      <div class="opened-apps-list">
        {#each openedAppIds as appId (appId)}
          {@const appConfig = getAppConfig(appId)}
          {@const tabCount = getAppTabCount(appId)}
          <button
            class="app-item {activeView === appId ? 'active' : ''}"
            on:click={() => handleAppClick(appId)}
            title={appConfig?.name || appId}
          >
            {#if appConfig?.icon}
              <img 
                src={getAppIconUrl(appConfig.icon)} 
                alt={appConfig.name}
                class="app-item-icon"
              />
            {:else}
              <div class="app-item-icon-placeholder">
                {appId.charAt(0).toUpperCase()}
              </div>
            {/if}
            {#if tabCount > 1}
              <span class="app-item-badge">{tabCount}</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="sidebar-footer">
    <button class="footer-button download-button" on:click={() => dispatch('openDownloadList')}>
      <DownloadIcon />
      <span>下载列表</span>
    </button>
    <button class="footer-button ai-button" on:click={() => dispatch('openAIConfig')}>
      <AIIcon />
      <span>AI 设置</span>
    </button>
  </div>
</aside>

<style>
  .sidebar {
    width: 240px;
    height: 100%;
    background: linear-gradient(180deg, #0a0e27 0%, #1a1f3a 100%);
    border-right: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .sidebar::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(79, 172, 254, 0.5), transparent);
  }

  .sidebar-header {
    padding: 24px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.1);
  }

  .logo {
    width: 40px;
    height: 40px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .app-title h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .version {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 400;
  }

  .sidebar-nav {
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    text-align: left;
    width: 100%;
  }

  .nav-item:hover {
    background: rgba(79, 172, 254, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .nav-item.active {
    background: linear-gradient(90deg, rgba(79, 172, 254, 0.2) 0%, rgba(79, 172, 254, 0.05) 100%);
    color: #4facfe;
    box-shadow: 0 0 20px rgba(79, 172, 254, 0.2);
  }

  .nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 60%;
    background: linear-gradient(180deg, #4facfe 0%, #00f2fe 100%);
    border-radius: 0 2px 2px 0;
  }

  .opened-apps {
    padding: 16px 12px;
    border-top: 1px solid rgba(79, 172, 254, 0.1);
    border-bottom: 1px solid rgba(79, 172, 254, 0.1);
  }

  .opened-apps-header {
    margin-bottom: 12px;
  }

  .opened-apps-title {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .opened-apps-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .app-item {
    position: relative;
    width: 48px;
    height: 48px;
    padding: 0;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(79, 172, 254, 0.1);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }

  .app-item:hover {
    background: rgba(79, 172, 254, 0.1);
    border-color: rgba(79, 172, 254, 0.3);
    transform: translateY(-2px);
  }

  .app-item.active {
    background: linear-gradient(135deg, rgba(79, 172, 254, 0.2) 0%, rgba(0, 242, 254, 0.2) 100%);
    border-color: rgba(79, 172, 254, 0.4);
    box-shadow: 0 0 20px rgba(79, 172, 254, 0.3);
  }

  .app-item-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .app-item-icon-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    color: white;
  }

  .app-item-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #4facfe;
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(79, 172, 254, 0.4);
  }

  .sidebar-footer {
    padding: 16px 12px;
    border-top: 1px solid rgba(79, 172, 254, 0.1);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .footer-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: linear-gradient(135deg, rgba(79, 172, 254, 0.2) 0%, rgba(0, 242, 254, 0.2) 100%);
    border: 1px solid rgba(79, 172, 254, 0.3);
    border-radius: 8px;
    color: #4facfe;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
  }

  .footer-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: left 0.5s;
  }

  .footer-button:hover::before {
    left: 100%;
  }

  .footer-button:hover {
    box-shadow: 0 0 20px rgba(79, 172, 254, 0.4);
    transform: translateY(-1px);
  }

  .button-icon {
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

 
</style>

