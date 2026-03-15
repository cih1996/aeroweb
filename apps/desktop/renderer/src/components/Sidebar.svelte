<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let activeView: 'home' | 'browser' = 'home';
  export let tabs: any[] = [];

  const dispatch = createEventDispatcher();

  $: tabCount = tabs.length;
</script>

<aside class="sidebar">
  <!-- 新建标签页按钮 -->
  <nav class="nav-section">
    <button
      class="nav-item primary"
      on:click={() => dispatch('newTab')}
      title="新建标签页"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 4V14M4 9H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </nav>

  <!-- 分隔线 -->
  <div class="divider"></div>

  <!-- 标签页数量指示 -->
  {#if tabCount > 0}
    <div class="tab-indicator">
      <div class="tab-count">{tabCount}</div>
      <span class="tab-label">标签页</span>
    </div>
  {:else}
    <div class="empty-state">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M3 9H21" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="6" cy="7" r="1" fill="currentColor"/>
        <circle cx="9" cy="7" r="1" fill="currentColor"/>
      </svg>
      <span>无标签页</span>
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

  .nav-item.primary {
    background: var(--accent-bg);
    color: var(--accent-primary);
  }

  .nav-item.primary:hover {
    background: var(--accent-primary);
    color: var(--bg-primary);
  }

  /* 分隔线 */
  .divider {
    height: 1px;
    background: var(--border-secondary);
    margin: 12px 14px;
  }

  /* 标签页指示 */
  .tab-indicator {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 8px;
    gap: 4px;
  }

  .tab-count {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .tab-label {
    font-size: 10px;
    color: var(--text-muted);
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
