<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
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
      // 加载缓存路径
      if (tab.configId) {
        cachePath = await getConfigCachePath(tab.configId);
      } else if (tab.id) {
        const { getTabCachePath } = await import('../utils/browser-cache-info');
        cachePath = await getTabCachePath(tab.id);
      }

      // 加载内存信息
      if (tab.id) {
        memoryInfo = await window.electronAPI.tab.getMemoryUsage(tab.id);
      }

      // 加载 Cookies
      if (tab.id) {
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
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      // 可以添加提示
    });
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
  <div class="modal-overlay" on:click={handleClose} on:keydown={handleKeydown}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Tab 属性</h2>
        <button class="close-button" on:click={handleClose}>×</button>
      </div>

      {#if tab}
        <div class="tab-info-header">
          <div class="tab-info-name">{tab.configName || tab.title || tab.appId}</div>
          <div class="tab-info-url">{tab.url}</div>
        </div>
      {/if}

      <div class="modal-tabs">
        <button 
          class="modal-tab {activeTab === 'cache' ? 'active' : ''}"
          on:click={() => activeTab = 'cache'}
        >
          缓存路径
        </button>
        <button 
          class="modal-tab {activeTab === 'memory' ? 'active' : ''}"
          on:click={() => activeTab = 'memory'}
        >
          内存使用
        </button>
        <button 
          class="modal-tab {activeTab === 'cookies' ? 'active' : ''}"
          on:click={() => activeTab = 'cookies'}
        >
          Cookies
        </button>
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
              <label>缓存路径</label>
              <div class="info-value">
                <code class="path-text">{cachePath || '未找到'}</code>
                {#if cachePath}
                  <button class="copy-button" on:click={() => copyToClipboard(cachePath)} title="复制">
                    📋
                  </button>
                {/if}
              </div>
            </div>
            <div class="info-item">
              <label>配置 ID</label>
              <div class="info-value">
                <code>{tab?.configId || '无（临时 Tab）'}</code>
              </div>
            </div>
          </div>
        {:else if activeTab === 'memory'}
          <div class="info-section">
            {#if memoryInfo}
              <div class="info-item">
                <label>内存使用</label>
                <div class="info-value">
                  {formatBytes(memoryInfo.workingSetSize || 0)}
                </div>
              </div>
              <div class="info-item">
                <label>峰值内存</label>
                <div class="info-value">
                  {formatBytes(memoryInfo.peakWorkingSetSize || 0)}
                </div>
              </div>
              <div class="info-item">
                <label>私有内存</label>
                <div class="info-value">
                  {formatBytes(memoryInfo.privateBytes || 0)}
                </div>
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
                      <button class="copy-button" on:click={() => copyToClipboard(cookie.value)} title="复制">
                        📋
                      </button>
                    </div>
                    {#if cookie.expirationDate}
                      <div class="cookie-meta">
                        过期时间: {new Date(cookie.expirationDate * 1000).toLocaleString()}
                      </div>
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
        <button class="btn-primary" on:click={handleClose}>关闭</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .modal-content {
    background: linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%);
    border: 1px solid rgba(79, 172, 254, 0.3);
    border-radius: 16px;
    width: 90%;
    max-width: 700px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    padding: 24px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .close-button {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 28px;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .tab-info-header {
    padding: 16px 24px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.1);
    background: rgba(255, 255, 255, 0.02);
  }

  .tab-info-name {
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 4px;
  }

  .tab-info-url {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    word-break: break-all;
  }

  .modal-tabs {
    display: flex;
    padding: 0 24px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    gap: 0;
  }

  .modal-tab {
    padding: 12px 20px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-tab:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(79, 172, 254, 0.05);
  }

  .modal-tab.active {
    color: #4facfe;
    border-bottom-color: #4facfe;
  }

  .modal-body {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
    min-height: 200px;
  }

  .modal-body::-webkit-scrollbar {
    width: 8px;
  }

  .modal-body::-webkit-scrollbar-track {
    background: transparent;
  }

  .modal-body::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 4px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: rgba(255, 255, 255, 0.5);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(79, 172, 254, 0.2);
    border-top-color: #4facfe;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .info-item label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-value {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.9);
  }

  .path-text {
    flex: 1;
    word-break: break-all;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  code {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
  }

  .copy-button {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 4px;
    font-size: 14px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .copy-button:hover {
    color: #4facfe;
    transform: scale(1.1);
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: rgba(255, 255, 255, 0.4);
  }

  .cookies-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cookie-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(79, 172, 254, 0.1);
    border-radius: 8px;
  }

  .cookie-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .cookie-name {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
  }

  .cookie-domain {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .cookie-value {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .cookie-value code {
    flex: 1;
    word-break: break-all;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
  }

  .cookie-meta {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 4px;
  }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    justify-content: flex-end;
  }

  .btn-primary {
    padding: 10px 20px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
    transform: translateY(-1px);
  }
</style>

