<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getConfigCachePath } from '../utils/browser-cache-info';

  export let show: boolean = false;
  export let tab: any = null;

  const dispatch = createEventDispatcher();

  let activeTab: 'cache' | 'memory' | 'cookies' = 'cache';
  let cachePath = '';
  let memoryInfo: any = null;
  let cookies: any[] = [];
  let loading = false;

  async function loadTabInfo() {
    if (!tab) return;
    loading = true;
    try {
      if (tab.configId) {
        cachePath = await getConfigCachePath(tab.configId);
      } else if (tab.id) {
        const { getTabCachePath } = await import('../utils/browser-cache-info');
        cachePath = await getTabCachePath(tab.id);
      }
      if (tab.id) {
        memoryInfo = await window.electronAPI.tab.getMemoryUsage(tab.id);
        cookies = await window.electronAPI.tab.getCookies(tab.id);
      }
    } catch (error) {
      console.error('加载 Tab 信息失败:', error);
    } finally {
      loading = false;
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') handleClose();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
</script>

{#if show}
  <div class="modal-overlay" role="dialog" aria-modal="true" on:click={handleClose} on:keydown={handleKeydown}>
    <div class="modal-content" role="document" on:click|stopPropagation on:keydown|stopPropagation>
      <div class="modal-header">
        <h2>Tab 属性</h2>
        <button class="close-btn" on:click={handleClose} aria-label="关闭">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      {#if tab}
        <div class="tab-info-header">
          <div class="tab-info-name">{tab.configName || tab.title || tab.appId}</div>
          <div class="tab-info-url">{tab.url}</div>
        </div>
      {/if}

      <div class="modal-tabs">
        <button class="modal-tab" class:active={activeTab === 'cache'} on:click={() => activeTab = 'cache'}>缓存路径</button>
        <button class="modal-tab" class:active={activeTab === 'memory'} on:click={() => activeTab = 'memory'}>内存使用</button>
        <button class="modal-tab" class:active={activeTab === 'cookies'} on:click={() => activeTab = 'cookies'}>Cookies</button>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>加载中...</p>
          </div>
        {:else if activeTab === 'cache'}
          <div class="info-section">
            <div class="info-item">
              <span class="info-label">缓存路径</span>
              <div class="info-value">
                <code>{cachePath || '未找到'}</code>
                {#if cachePath}
                  <button class="copy-btn" on:click={() => copyToClipboard(cachePath)} title="复制">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
                      <path d="M2 10V3C2 2.44772 2.44772 2 3 2H10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                    </svg>
                  </button>
                {/if}
              </div>
            </div>
            <div class="info-item">
              <span class="info-label">配置 ID</span>
              <div class="info-value">
                <code>{tab?.configId || '无（临时 Tab）'}</code>
              </div>
            </div>
          </div>
        {:else if activeTab === 'memory'}
          <div class="info-section">
            {#if memoryInfo}
              <div class="info-item">
                <span class="info-label">内存使用</span>
                <div class="info-value">{formatBytes(memoryInfo.workingSetSize || 0)}</div>
              </div>
              <div class="info-item">
                <span class="info-label">峰值内存</span>
                <div class="info-value">{formatBytes(memoryInfo.peakWorkingSetSize || 0)}</div>
              </div>
              <div class="info-item">
                <span class="info-label">私有内存</span>
                <div class="info-value">{formatBytes(memoryInfo.privateBytes || 0)}</div>
              </div>
            {:else}
              <div class="empty-state">暂无内存信息</div>
            {/if}
          </div>
        {:else if activeTab === 'cookies'}
          <div class="info-section">
            {#if cookies.length > 0}
              <div class="cookies-list">
                {#each cookies as cookie (cookie.name + cookie.domain)}
                  <div class="cookie-item">
                    <div class="cookie-header">
                      <span class="cookie-name">{cookie.name}</span>
                      <span class="cookie-domain">{cookie.domain}</span>
                    </div>
                    <div class="cookie-value">
                      <code>{cookie.value}</code>
                      <button class="copy-btn" on:click={() => copyToClipboard(cookie.value)} title="复制">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
                          <path d="M2 10V3C2 2.44772 2.44772 2 3 2H10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                        </svg>
                      </button>
                    </div>
                    {#if cookie.expirationDate}
                      <div class="cookie-meta">过期: {new Date(cookie.expirationDate * 1000).toLocaleString()}</div>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-state">暂无 Cookies</div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" on:click={handleClose}>关闭</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--bg-elevated);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    padding: var(--spacing-xl);
    border-bottom: 1px solid var(--border-secondary);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .tab-info-header {
    padding: var(--spacing-md) var(--spacing-xl);
    border-bottom: 1px solid var(--border-secondary);
    background: var(--bg-tertiary);
  }

  .tab-info-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .tab-info-url {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    word-break: break-all;
  }

  .modal-tabs {
    display: flex;
    padding: 0 var(--spacing-xl);
    border-bottom: 1px solid var(--border-secondary);
  }

  .modal-tab {
    padding: var(--spacing-md) var(--spacing-lg);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .modal-tab:hover {
    color: var(--text-secondary);
    background: var(--bg-hover);
  }

  .modal-tab.active {
    color: var(--accent-primary);
    border-bottom-color: var(--accent-primary);
  }

  .modal-body {
    flex: 1;
    padding: var(--spacing-xl);
    overflow-y: auto;
    min-height: 150px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
    color: var(--text-muted);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--border-secondary);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-md);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .info-label {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-value {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }

  .info-value code {
    flex: 1;
    word-break: break-all;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
  }

  .copy-btn {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-btn:hover {
    background: var(--bg-hover);
    color: var(--accent-primary);
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-muted);
  }

  .cookies-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .cookie-item {
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-md);
  }

  .cookie-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-sm);
  }

  .cookie-name {
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }

  .cookie-domain {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .cookie-value {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .cookie-value code {
    flex: 1;
    word-break: break-all;
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .cookie-meta {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-top: var(--spacing-xs);
  }

  .modal-footer {
    padding: var(--spacing-lg) var(--spacing-xl);
    border-top: 1px solid var(--border-secondary);
    display: flex;
    justify-content: flex-end;
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .btn-primary {
    background: var(--accent-primary);
    color: var(--bg-primary);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }
</style>
