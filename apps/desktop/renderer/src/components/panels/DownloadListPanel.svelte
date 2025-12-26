<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import RefreshIcon from '../icons/RefreshIcon.svelte';
  import DownloadEmptyIcon from '../icons/DownloadEmptyIcon.svelte';
  import ImageFileIcon from '../icons/ImageFileIcon.svelte';
  import PdfFileIcon from '../icons/PdfFileIcon.svelte';
  import DocFileIcon from '../icons/DocFileIcon.svelte';
  import ExcelFileIcon from '../icons/ExcelFileIcon.svelte';
  import ZipFileIcon from '../icons/ZipFileIcon.svelte';
  import VideoFileIcon from '../icons/VideoFileIcon.svelte';
  import AudioFileIcon from '../icons/AudioFileIcon.svelte';
  import ExeFileIcon from '../icons/ExeFileIcon.svelte';
  import DefaultFileIcon from '../icons/DefaultFileIcon.svelte';
  import PauseIcon from '../icons/PauseIcon.svelte';
  import CancelIcon from '../icons/CancelIcon.svelte';
  import PlayIcon from '../icons/PlayIcon.svelte';
  import DeleteIcon from '../icons/DeleteIcon.svelte';

  export const tabId: string | null = null;
  export const appId: string = '';

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
    thumbnail?: string;
    mimeType?: string;
  }

  let downloads: DownloadInfo[] = [];
  let tabs: any[] = [];

  // 格式化文件大小
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  // 格式化速度
  function formatSpeed(bytesPerSecond: number): string {
    return `${formatBytes(bytesPerSecond)}/s`;
  }

  // 计算剩余时间
  function calculateRemainingTime(receivedBytes: number, totalBytes: number, speed: number): string {
    if (speed === 0 || totalBytes === 0) return '--:--';
    const remainingBytes = totalBytes - receivedBytes;
    const remainingSeconds = Math.ceil(remainingBytes / speed);
    if (remainingSeconds < 0 || !isFinite(remainingSeconds)) return '--:--';
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // 计算进度百分比
  function calculateProgress(receivedBytes: number, totalBytes: number): number {
    if (totalBytes === 0) return 0;
    return Math.min(100, (receivedBytes / totalBytes) * 100);
  }

  // 获取文件类型图标组件
  function getFileIconComponent(filename: string, mimeType?: string) {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, any> = {
      'jpg': ImageFileIcon, 'jpeg': ImageFileIcon, 'png': ImageFileIcon, 'gif': ImageFileIcon, 'webp': ImageFileIcon,
      'pdf': PdfFileIcon,
      'doc': DocFileIcon, 'docx': DocFileIcon,
      'xls': ExcelFileIcon, 'xlsx': ExcelFileIcon,
      'zip': ZipFileIcon, 'rar': ZipFileIcon, '7z': ZipFileIcon,
      'mp4': VideoFileIcon, 'avi': VideoFileIcon, 'mov': VideoFileIcon,
      'mp3': AudioFileIcon,
      'exe': ExeFileIcon, 'msi': ExeFileIcon,
      'dmg': DefaultFileIcon,
      'apk': DefaultFileIcon,
    };
    return iconMap[ext] || DefaultFileIcon;
  }

  // 获取Tab名称
  function getTabName(tabId: string): string {
    const tab = tabs.find(t => t.id === tabId);
    return tab?.title || tab?.appId || tabId;
  }

  // 加载下载列表
  async function loadDownloads() {
    try {
      // 始终加载所有下载（不按 tab 过滤）
      downloads = await window.electronAPI.download.list();
    } catch (err) {
      console.error('[DownloadListPanel] 加载下载列表失败:', err);
    }
  }

  // 取消下载
  async function cancelDownload(downloadId: string) {
    try {
      await window.electronAPI.download.cancel(downloadId);
      await loadDownloads();
    } catch (err) {
      console.error('[DownloadListPanel] 取消下载失败:', err);
    }
  }

  // 暂停下载
  async function pauseDownload(downloadId: string) {
    try {
      await window.electronAPI.download.pause(downloadId);
      await loadDownloads();
    } catch (err) {
      console.error('[DownloadListPanel] 暂停下载失败:', err);
    }
  }

  // 恢复下载
  async function resumeDownload(downloadId: string) {
    try {
      await window.electronAPI.download.resume(downloadId);
      await loadDownloads();
    } catch (err) {
      console.error('[DownloadListPanel] 恢复下载失败:', err);
    }
  }

  // 删除下载记录
  async function removeDownload(downloadId: string) {
    try {
      await window.electronAPI.download.remove(downloadId);
      await loadDownloads();
    } catch (err) {
      console.error('[DownloadListPanel] 删除下载失败:', err);
    }
  }

  // 处理下载更新事件
  function handleDownloadUpdate(downloadInfo: DownloadInfo) {
    const index = downloads.findIndex(d => d.id === downloadInfo.id);
    if (index >= 0) {
      downloads[index] = downloadInfo;
      downloads = downloads; // 触发响应式更新
    } else {
      // 新下载，添加到列表
      downloads = [...downloads, downloadInfo];
    }
  }

  // 处理下载删除事件
  function handleDownloadRemoved(data: { downloadId: string }) {
    downloads = downloads.filter(d => d.id !== data.downloadId);
  }

  // 更新Tab列表
  async function updateTabs() {
    try {
      tabs = await window.electronAPI.tab.list();
    } catch (err) {
      console.error('[DownloadListPanel] 更新Tab列表失败:', err);
    }
  }

  onMount(async () => {
    await updateTabs();
    await loadDownloads();

    // 监听下载更新事件
    window.electronAPI.on('download:update', handleDownloadUpdate);
    window.electronAPI.on('download:removed', handleDownloadRemoved);

    // 监听Tab变化
    const handleTabUpdate = () => updateTabs();
    window.electronAPI.on('tab:update', handleTabUpdate);
    window.electronAPI.on('tab:activate', handleTabUpdate);
  });

  onDestroy(() => {
    window.electronAPI.off('download:update', handleDownloadUpdate);
    window.electronAPI.off('download:removed', handleDownloadRemoved);
    window.electronAPI.off('tab:update', () => updateTabs());
    window.electronAPI.off('tab:activate', () => updateTabs());
  });
</script>

<div class="download-list-panel">
  <div class="panel-header">
    <h3>下载列表</h3>
    <button class="btn-refresh" on:click={loadDownloads} title="刷新">
      <RefreshIcon size={16} />
    </button>
  </div>

  <div class="panel-content">
    {#if downloads.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <DownloadEmptyIcon size={48} />
        </div>
        <p>暂无下载任务</p>
      </div>
    {:else}
      <div class="download-list">
        {#each downloads as download (download.id)}
          {@const progress = calculateProgress(download.receivedBytes, download.totalBytes)}
          {@const remainingTime = calculateRemainingTime(download.receivedBytes, download.totalBytes, download.speed)}
          {@const isActive = download.state === 'progressing'}
          {@const isCompleted = download.state === 'completed'}
          {@const isCancelled = download.state === 'cancelled'}
          {@const isInterrupted = download.state === 'interrupted'}

          <div class="download-item" class:completed={isCompleted} class:cancelled={isCancelled || isInterrupted}>
            <div class="download-main">
              <!-- 左侧缩略图 -->
              <div class="download-thumbnail">
                {#if download.thumbnail}
                  <img src={download.thumbnail} alt={download.filename} />
                {:else}
                  {@const IconComponent = getFileIconComponent(download.filename, download.mimeType)}
                  <div class="download-icon">
                    <svelte:component this={IconComponent} size={24} />
                  </div>
                {/if}
              </div>

              <!-- 中间内容 -->
              <div class="download-info">
                <div class="download-header">
                  <div class="download-name-row">
                    <span class="download-filename" title={download.filename}>{download.filename}</span>
                    <div class="download-actions">
                      {#if isActive}
                        <button class="btn-action btn-pause" on:click={() => pauseDownload(download.id)} title="暂停">
                          <PauseIcon size={16} />
                        </button>
                        <button class="btn-action btn-cancel" on:click={() => cancelDownload(download.id)} title="取消">
                          <CancelIcon size={16} />
                        </button>
                      {:else if isInterrupted}
                        <button class="btn-action btn-resume" on:click={() => resumeDownload(download.id)} title="恢复">
                          <PlayIcon size={16} />
                        </button>
                        <button class="btn-action btn-remove" on:click={() => removeDownload(download.id)} title="删除">
                          <DeleteIcon size={16} />
                        </button>
                      {:else}
                        <button class="btn-action btn-remove" on:click={() => removeDownload(download.id)} title="删除">
                          <DeleteIcon size={16} />
                        </button>
                      {/if}
                    </div>
                  </div>
                  <div class="download-url" title={download.url}>{download.url}</div>
                  <div class="download-tab">来自: {getTabName(download.tabId)}</div>
                </div>

                <!-- 下载进度信息 -->
                {#if isActive || isCompleted}
                  <div class="download-progress-info">
                    <span class="progress-text">
                      {formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}
                    </span>
                    {#if isActive}
                      <span class="speed-text">{formatSpeed(download.speed)}</span>
                      <span class="time-text">{remainingTime}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>

            <!-- 下载进度条 -->
            {#if isActive || isCompleted}
              <div class="download-progress-bar">
                <div 
                  class="progress-fill" 
                  style="width: {progress}%"
                  class:completed={isCompleted}
                ></div>
              </div>
            {/if}

            {#if isCancelled || isInterrupted}
              <div class="download-status">
                {isCancelled ? '已取消' : '已中断'}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .download-list-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-height: 0;
    background: rgba(26, 31, 58, 0.95);
    overflow: hidden;
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .btn-refresh {
    padding: 4px 8px;
    background: rgba(79, 172, 254, 0.1);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-refresh:hover {
    background: rgba(79, 172, 254, 0.2);
    border-color: rgba(79, 172, 254, 0.4);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .panel-content::-webkit-scrollbar {
    width: 8px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 4px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .download-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .download-item {
    background: rgba(10, 14, 39, 0.5);
    border: 1px solid rgba(79, 172, 254, 0.1);
    border-radius: 8px;
    padding: 12px;
    transition: all 0.2s;
  }

  .download-item:hover {
    background: rgba(10, 14, 39, 0.7);
    border-color: rgba(79, 172, 254, 0.3);
  }

  .download-item.completed {
    opacity: 0.7;
  }

  .download-item.cancelled {
    opacity: 0.5;
  }

  .download-main {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
  }

  .download-thumbnail {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 4px;
    overflow: hidden;
    background: rgba(79, 172, 254, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .download-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .download-icon {
    font-size: 24px;
  }

  .download-info {
    flex: 1;
    min-width: 0;
  }

  .download-header {
    margin-bottom: 8px;
  }

  .download-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .download-filename {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .download-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .btn-action {
    padding: 4px 8px;
    background: transparent;
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-action:hover {
    background: rgba(79, 172, 254, 0.2);
    border-color: rgba(79, 172, 254, 0.4);
  }

  .btn-pause:hover {
    background: rgba(255, 149, 0, 0.2);
    border-color: rgba(255, 149, 0, 0.4);
  }

  .btn-cancel:hover {
    background: rgba(255, 59, 48, 0.2);
    border-color: rgba(255, 59, 48, 0.4);
  }

  .btn-resume:hover {
    background: rgba(52, 199, 89, 0.2);
    border-color: rgba(52, 199, 89, 0.4);
  }

  .btn-remove:hover {
    background: rgba(255, 59, 48, 0.2);
    border-color: rgba(255, 59, 48, 0.4);
  }

  .download-url {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 4px;
  }

  .download-tab {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
  }

  .download-progress-info {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 4px;
  }

  .progress-text {
    font-weight: 500;
  }

  .speed-text {
    color: rgba(79, 172, 254, 0.8);
  }

  .time-text {
    color: rgba(255, 255, 255, 0.5);
  }

  .download-progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(79, 172, 254, 0.1);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 8px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
    transition: width 0.3s ease;
    border-radius: 2px;
  }

  .progress-fill.completed {
    background: linear-gradient(90deg, #34c759 0%, #30d158 100%);
  }

  .download-status {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    margin-top: 4px;
  }
</style>

