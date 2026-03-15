<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let tabs: any[] = [];
  export let activeTabId: string | null = null;

  const dispatch = createEventDispatcher();

  let contextMenuTabId: string | null = null;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let showContextMenu = false;

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

  function getTabDisplayName(tab: any): string {
    // 优先显示标题，其次是配置名称，最后是 URL 的域名
    if (tab.title && tab.title !== 'about:blank') {
      return tab.title;
    }
    if (tab.configName) {
      return tab.configName;
    }
    if (tab.url) {
      try {
        const url = new URL(tab.url);
        return url.hostname;
      } catch {
        return tab.url;
      }
    }
    return '新标签页';
  }

  function getTabIcon(tab: any): string {
    // 返回首字母作为图标
    const name = getTabDisplayName(tab);
    return name.charAt(0).toUpperCase();
  }
</script>

<div
  class="tab-bar"
  role="tablist"
  tabindex="0"
  on:click|self={handleClickOutside}
  on:keydown={(e) => e.key === 'Escape' && handleClickOutside()}
>
  {#each tabs as tab (tab.id)}
    <button
      class="tab"
      class:active={tab.id === activeTabId}
      role="tab"
      aria-selected={tab.id === activeTabId}
      tabindex={tab.id === activeTabId ? 0 : -1}
      on:click={() => handleActivate(tab.id)}
      on:contextmenu={(e) => handleContextMenu(tab.id, e)}
      title={getTabDisplayName(tab)}
    >
      <span class="tab-indicator"></span>
      <span class="tab-icon-placeholder">
        {getTabIcon(tab)}
      </span>
      <span class="tab-title">{getTabDisplayName(tab)}</span>
      <button
        class="tab-close"
        on:click={(e) => handleClose(tab.id, e)}
        aria-label="关闭标签页"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </button>
  {/each}

  <!-- 新建标签页按钮 -->
  <button
    class="new-tab-btn"
    on:click={() => dispatch('newTab')}
    title="新建标签页"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3V11M3 7H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>
</div>

{#if showContextMenu && contextMenuTabId}
  <div
    class="context-menu"
    role="menu"
    tabindex="-1"
    style="left: {contextMenuX}px; top: {contextMenuY}px;"
    on:click|stopPropagation
    on:keydown={(e) => e.key === 'Escape' && handleClickOutside()}
  >
    <button
      class="context-menu-item"
      role="menuitem"
      on:click={() => handleContextMenuAction('reload')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2.5 7A4.5 4.5 0 1 1 7 11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M2.5 4V7H5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>刷新</span>
    </button>
    <button
      class="context-menu-item"
      role="menuitem"
      on:click={() => handleContextMenuAction('duplicate')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.2"/>
        <path d="M3 10V3.5A.5.5 0 0 1 3.5 3H10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span>复制标签页</span>
    </button>
    <div class="context-menu-divider"></div>
    <button
      class="context-menu-item"
      role="menuitem"
      on:click={() => handleContextMenuAction('closeOthers')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7H12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span>关闭其他标签页</span>
    </button>
    <button
      class="context-menu-item danger"
      role="menuitem"
      on:click={() => handleContextMenuAction('close')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span>关闭</span>
    </button>
  </div>
{/if}

<style>
  .tab-bar {
    display: flex;
    align-items: stretch;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-primary);
    overflow-x: auto;
    overflow-y: hidden;
    height: 38px;
  }

  .tab-bar::-webkit-scrollbar {
    height: 0;
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    background: transparent;
    border: none;
    border-right: 1px solid var(--border-secondary);
    cursor: pointer;
    min-width: 100px;
    max-width: 200px;
    color: var(--text-muted);
    transition: all 0.15s ease;
  }

  .tab:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .tab.active {
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  /* 激活指示器 */
  .tab-indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
    transition: background 0.15s ease;
  }

  .tab.active .tab-indicator {
    background: var(--accent-primary);
  }

  .tab-icon-placeholder {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-bg);
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-primary);
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

  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
  }

  .tab:hover .tab-close {
    opacity: 1;
  }

  .tab-close:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }

  /* 新建标签页按钮 */
  .new-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    min-width: 32px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .new-tab-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  /* 右键菜单 */
  .context-menu {
    position: fixed;
    background: var(--bg-elevated);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 4px;
    box-shadow: var(--shadow-lg);
    z-index: 999999;
    min-width: 160px;
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .context-menu-item:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .context-menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-error);
  }

  .context-menu-divider {
    height: 1px;
    background: var(--border-secondary);
    margin: 4px 0;
  }
</style>
