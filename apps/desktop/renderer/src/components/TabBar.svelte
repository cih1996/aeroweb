<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAppById, getAllApps } from '../utils/app-storage';
  import type { AppConfig } from '../types/app-config';

  export let tabs: any[] = [];
  export let activeTabId: string | null = null;

  const dispatch = createEventDispatcher();

  let appConfigs: AppConfig[] = [];
  let contextMenuTabId: string | null = null;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let showContextMenu = false;

  onMount(async () => {
    appConfigs = getAllApps();
  });

  function getAppConfig(appId: string): AppConfig | undefined {
    return appConfigs.find(app => app.id === appId);
  }

  function handleClose(tabId: string, event: MouseEvent) {
    event.stopPropagation();
    dispatch('close', { tabId });
  }

  function handleActivate(tabId: string) {
    dispatch('activate', { tabId });
  }

  async function handleContextMenu(tabId: string, event: MouseEvent) {
    console.log('[TabBar] handleContextMenu called for tabId:', tabId);
    event.preventDefault();
    event.stopPropagation();
    contextMenuTabId = tabId;
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    showContextMenu = true;
    // 临时隐藏 BrowserView，避免遮挡右键菜单
    try {
      console.log('[TabBar] Calling temporarilyHide...');
      await window.electronAPI.view.temporarilyHide();
      console.log('[TabBar] temporarilyHide completed');
    } catch (error) {
      console.error('[TabBar] 隐藏浏览器失败:', error);
    }
  }

  async function handleContextMenuAction(action: string) {
    console.log('[TabBar] handleContextMenuAction called, action:', action, 'tabId:', contextMenuTabId);
    if (contextMenuTabId) {
      dispatch('contextMenuAction', { tabId: contextMenuTabId, action });
    }
    showContextMenu = false;
    contextMenuTabId = null;
    // 注意：不在这里恢复 BrowserView，因为属性模态框打开时也需要隐藏
    // 恢复会在模态框关闭时处理
  }

  async function handleClickOutside() {
    console.log('[TabBar] handleClickOutside called');
    showContextMenu = false;
    contextMenuTabId = null;
    // 恢复显示 BrowserView
    try {
      console.log('[TabBar] Calling restoreHidden...');
      await window.electronAPI.view.restoreHidden();
      console.log('[TabBar] restoreHidden completed');
    } catch (error) {
      console.error('[TabBar] 恢复浏览器失败:', error);
    }
  }
</script>

<div 
  class="tab-bar" 
  role="none"
  on:click|self={handleClickOutside}
>
  {#each tabs as tab (tab.id)}
    {@const appConfig = getAppConfig(tab.appId)}
    <div 
      class="tab {tab.id === activeTabId ? 'active' : ''}"
      role="button"
      tabindex="0"
      on:click={() => handleActivate(tab.id)}
      on:contextmenu={(e) => handleContextMenu(tab.id, e)}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate(tab.id);
        }
      }}
    >
      {#if appConfig?.icon}
        <img 
          src={appConfig.icon} 
          alt={appConfig.name}
          class="tab-icon"
          on:error={(e) => {
            const target = e.currentTarget;
            if (target instanceof HTMLImageElement) {
              target.style.display = 'none';
            }
          }}
        />
      {/if}
      <span class="tab-title">{tab.configName || tab.title || tab.appId}</span>
      <button 
        class="tab-close"
        on:click={(e) => handleClose(tab.id, e)}
      >
        ×
      </button>
    </div>
  {/each}
</div>

{#if showContextMenu && contextMenuTabId}
  <div 
    class="context-menu"
    role="menu"
    tabindex="-1"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
    on:click|stopPropagation
    on:keydown={(e) => {
      if (e.key === 'Escape') {
        handleClickOutside();
      }
    }}
  >
    <button 
      class="context-menu-item"
      role="menuitem"
      on:click={() => handleContextMenuAction('properties')}
    >
      <span>属性</span>
    </button>
  </div>
{/if}

<style>
  .tab-bar {
    display: flex;
    gap: 0;
    padding: 0;
    background: rgba(10, 14, 39, 0.8);
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    overflow-x: auto;
    overflow-y: hidden;
    min-height: 36px;
  }

  .tab-bar::-webkit-scrollbar {
    height: 4px;
  }

  .tab-bar::-webkit-scrollbar-track {
    background: transparent;
  }

  .tab-bar::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 2px;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.05);
    border-right: 1px solid rgba(79, 172, 254, 0.1);
    cursor: pointer;
    min-width: 120px;
    max-width: 240px;
    transition: all 0.2s;
    position: relative;
    color: rgba(255, 255, 255, 0.7);
  }

  .tab-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    object-fit: contain;
  }

  .tab:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }

  .tab.active {
    background: rgba(79, 172, 254, 0.15);
    color: rgba(255, 255, 255, 0.95);
    border-bottom: 2px solid #4facfe;
  }

  .tab.active::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
  }

  .tab-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
  }

  .tab-close {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 2px;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    transition: all 0.2s;
    opacity: 0;
  }

  .tab:hover .tab-close {
    opacity: 1;
  }

  .tab-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .context-menu {
    position: fixed;
    background: rgba(26, 31, 58, 0.95);
    border: 1px solid rgba(79, 172, 254, 0.3);
    border-radius: 8px;
    padding: 4px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 999999;
    min-width: 120px;
    backdrop-filter: blur(10px);
    pointer-events: auto;
  }

  .context-menu-item {
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .context-menu-item:hover {
    background: rgba(79, 172, 254, 0.2);
    color: rgba(255, 255, 255, 0.95);
  }
</style>

