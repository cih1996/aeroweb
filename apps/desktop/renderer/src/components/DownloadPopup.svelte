<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  export let show = false;

  const dispatch = createEventDispatcher();

  interface DownloadInfo {
    id: string;
    tabId: string;
    url: string;
    filename: string;
    savePath: string;
    totalBytes: number;
    receivedBytes: number;
    state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
    startTime: number;
    speed: number;
  }

  let downloads: DownloadInfo[] = [];

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function formatSpeed(bytesPerSecond: number): string {
    return `${formatBytes(bytesPerSecond)}/s`;
  }

  function calculateProgress(receivedBytes: number, totalBytes: number): number {
    if (totalBytes === 0) return 0;
    return Math.min(100, (receivedBytes / totalBytes) * 100);
  }

  function getFileExt(filename: string): string {
    return filename.split('.').pop()?.toUpperCase() || 'FILE';
  }

  async function loadDownloads() {
    try {
      downloads = await window.electronAPI.download.list();
    } catch (err) {
      console.error('[DownloadPopup] 加载失败:', err);
    }
  }

  async function cancelDownload(downloadId: string) {
    await window.electronAPI.download.cancel(downloadId);
    await loadDownloads();
  }

  async function removeDownload(downloadId: string) {
    await window.electronAPI.download.remove(downloadId);
    await loadDownloads();
  }

  function handleDownloadUpdate(downloadInfo: DownloadInfo) {
    const index = downloads.findIndex(d => d.id === downloadInfo.id);
    if (index >= 0) {
      downloads[index] = downloadInfo;
      downloads = downloads;
    } else {
      downloads = [...downloads, downloadInfo];
    }
  }

  function handleDownloadRemoved(data: { downloadId: string }) {
    downloads = downloads.filter(d => d.id !== data.downloadId);
  }

  function handleClose() {
    dispatch('close');
  }

  onMount(async () => {
    await loadDownloads();
    window.electronAPI.on('download:update', handleDownloadUpdate);
    window.electronAPI.on('download:removed', handleDownloadRemoved);
  });

  onDestroy(() => {
    window.electronAPI.off('download:update', handleDownloadUpdate);
    window.electronAPI.off('download:removed', handleDownloadRemoved);
  });

  // 只显示最近 5 个下载
  $: recentDownloads = downloads.slice(0, 5);
  $: activeCount = downloads.filter(d => d.state === 'progressing').length;
</script>

{#if show}
  <div class="download-popup">
    <div class="popup-header">
      <span class="popup-title">下载</span>
      {#if activeCount > 0}
        <span class="active-badge">{activeCount}</span>
      {/if}
      <button class="close-btn" on:click={handleClose} aria-label="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="popup-content">
      {#if recentDownloads.length === 0}
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 6V20M16 20L10 14M16 20L22 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 24H26" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>暂无下载</span>
        </div>
      {:else}
        {#each recentDownloads as download (download.id)}
          {@const progress = calculateProgress(download.receivedBytes, download.totalBytes)}
          {@const isActive = download.state === 'progressing'}
          {@const isCompleted = download.state === 'completed'}
          <div class="download-item" class:completed={isCompleted}>
            <div class="file-icon">{getFileExt(download.filename)}</div>
            <div class="download-info">
              <div class="filename" title={download.filename}>{download.filename}</div>
              <div class="download-meta">
                {#if isActive}
                  <span>{formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}</span>
                  <span class="speed">{formatSpeed(download.speed)}</span>
                {:else if isCompleted}
                  <span class="completed-text">已完成</span>
                {:else}
                  <span class="status-text">{download.state === 'cancelled' ? '已取消' : '已中断'}</span>
                {/if}
              </div>
              {#if isActive}
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {progress}%"></div>
                </div>
              {/if}
            </div>
            <button
              class="action-btn"
              on:click={() => isActive ? cancelDownload(download.id) : removeDownload(download.id)}
              title={isActive ? '取消' : '移除'}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style>
  .download-popup {
    position: fixed;
    bottom: 60px;
    left: 70px;
    width: 320px;
    max-height: 400px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .popup-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--border-secondary);
  }

  .popup-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    flex: 1;
  }

  .active-badge {
    background: var(--accent-primary);
    color: var(--bg-primary);
    font-size: 10px;
    font-weight: var(--font-weight-bold);
    padding: 2px 6px;
    border-radius: 10px;
  }

  .close-btn {
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

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .popup-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-sm);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-2xl);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .download-item {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    border-radius: var(--radius-md);
    transition: background 0.15s ease;
  }

  .download-item:hover {
    background: var(--bg-hover);
  }

  .download-item.completed {
    opacity: 0.7;
  }

  .file-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-bg);
    border-radius: var(--radius-sm);
    font-size: 9px;
    font-weight: var(--font-weight-bold);
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .download-info {
    flex: 1;
    min-width: 0;
  }

  .filename {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
  }

  .download-meta {
    display: flex;
    gap: var(--spacing-sm);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .speed {
    color: var(--accent-primary);
  }

  .completed-text {
    color: var(--color-success);
  }

  .status-text {
    color: var(--text-muted);
  }

  .progress-bar {
    height: 3px;
    background: var(--border-secondary);
    border-radius: 2px;
    margin-top: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-primary);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .action-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .download-item:hover .action-btn {
    opacity: 1;
  }

  .action-btn:hover {
    background: var(--bg-active);
    color: var(--color-error);
  }
</style>
