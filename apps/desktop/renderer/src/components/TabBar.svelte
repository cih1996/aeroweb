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
    event.preventDefault();
    event.stopPropagation();
    contextMenuTabId = tabId;
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    showContextMenu = true;
    try {
      await window.electronAPI.view.temporarilyHide();
    } catch (error) {
      console.error('[TabBar] 隐藏浏览器失败:', error);
    }
  }

  async function handleContextMenuAction(action: string) {
    if (contextMenuTabId) {
      dispatch('contextMenuAction', { tabId: contextMenuTabId, action });
    }
    showContextMenu = false;
    contextMenuTabId = null;
  }

  async function handleClickOutside() {
    showContextMenu = false;
    contextMenuTabId = null;
    try {
      await window.electronAPI.view.restoreHidden();
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
      class="tab"
      class:active={tab.id === activeTabId}
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
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="1" y1="1" x2="9" y2="9" />
          <line x1="9" y1="1" x2="1" y2="9" />
        </svg>
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
      属性
    </button>
  </div>
{/if}

<style>
  .tab-bar {
    display: flex;
    gap: 0;
    padding: 0;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-primary);
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
    background: var(--scrollbar-thumb);
    border-radius: 2px;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--bg-hover);
    border-right: 1px solid var(--border-secondary);
    cursor: pointer;
    min-width: 120px;
    max-width: 240px;
    transition: all var(--transition-fast);
    position: relative;
    color: var(--text-secondary);
  }

  .tab-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    object-fit: contain;
  }

  .tab:hover {
    background: var(--bg-active);
    color: var(--text-primary);
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

  .tab-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .tab-close {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
    opacity: 0;
  }

  .tab:hover .tab-close {
    opacity: 1;
  }

  .tab-close:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }

  .context-menu {
    position: fixed;
    background: var(--bg-elevated);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    padding: var(--spacing-xs);
    box-shadow: var(--shadow-lg);
    z-index: 999999;
    min-width: 120px;
  }

  .context-menu-item {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .context-menu-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
</style>
