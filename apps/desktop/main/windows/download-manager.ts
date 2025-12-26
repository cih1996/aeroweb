import { DownloadItem, Event } from 'electron';
import { basename, extname } from 'path';

export interface DownloadInfo {
  id: string;
  tabId: string;
  url: string;
  filename: string;
  savePath: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  startTime: number;
  speed: number; // bytes per second
  thumbnail?: string; // 缩略图 URL 或 base64
  mimeType?: string;
}

export class DownloadManager {
  private downloads: Map<string, DownloadInfo> = new Map();
  private downloadItems: Map<string, DownloadItem> = new Map();
  private mainWindow: Electron.BrowserWindow;

  constructor(mainWindow: Electron.BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * 添加下载项
   */
  addDownload(tabId: string, downloadItem: DownloadItem, url: string): string {
    // 检查 downloadItem 是否仍然有效
    try {
      const testState = downloadItem.getState();
      // 如果能够获取状态，说明 downloadItem 仍然有效
    } catch (error) {
      throw new Error('DownloadItem used after being destroyed');
    }
    
    const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const savePath = downloadItem.getSavePath() || '';
    
    // 优先使用实际保存路径中的文件名，如果没有保存路径，则使用原始文件名或从 URL 提取
    let filename: string;
    if (savePath) {
      // 从保存路径中提取文件名（用户可能修改了文件名）
      filename = basename(savePath);
    } else {
      // 如果还没有保存路径，使用原始文件名或从 URL 提取
      filename = downloadItem.getFilename() || basename(url);
    }
    
    // 获取下载项状态，如果状态是 cancelled，强制设置为 progressing
    let state = downloadItem.getState();
    
    // 如果状态是 cancelled 但保存路径已设置，说明可能是状态更新延迟，强制设置为 progressing
    if (state === 'cancelled' && savePath) {
      state = 'progressing';
    }
    
    const downloadInfo: DownloadInfo = {
      id: downloadId,
      tabId,
      url,
      filename,
      savePath,
      totalBytes: downloadItem.getTotalBytes(),
      receivedBytes: downloadItem.getReceivedBytes(),
      state: state as DownloadInfo['state'],
      startTime: Date.now(),
      speed: 0,
      mimeType: downloadItem.getMimeType(),
    };

    this.downloads.set(downloadId, downloadInfo);
    this.downloadItems.set(downloadId, downloadItem);

    // 监听下载进度
    downloadItem.on('updated', () => {
      const receivedBytes = downloadItem.getReceivedBytes();
      const totalBytes = downloadItem.getTotalBytes();
      const state = downloadItem.getState();
      const currentSavePath = downloadItem.getSavePath();
      
      // 如果保存路径已更新（用户可能修改了文件名），更新下载信息中的文件名
      if (currentSavePath && downloadInfo.savePath !== currentSavePath) {
        const newFilename = basename(currentSavePath);
        downloadInfo.filename = newFilename;
        downloadInfo.savePath = currentSavePath;
      }
      
      this.updateDownloadProgress(downloadId);
    });

    // 监听下载完成（包括 completed、cancelled、interrupted 状态）
    downloadItem.once('done', (event: Event, state: string) => {
      this.handleDownloadDone(downloadId, state);
    });

    // 通知渲染进程
    this.notifyDownloadUpdate(downloadInfo);

    return downloadId;
  }

  /**
   * 更新下载进度
   */
  private updateDownloadProgress(downloadId: string) {
    const downloadInfo = this.downloads.get(downloadId);
    const downloadItem = this.downloadItems.get(downloadId);
    
    if (!downloadInfo || !downloadItem) {
      return;
    }

    const currentReceived = downloadItem.getReceivedBytes();
    const currentTotal = downloadItem.getTotalBytes();
    const currentTime = Date.now();
    const timeDelta = (currentTime - downloadInfo.startTime) / 1000; // 秒
    
    // 保存旧的 receivedBytes，用于判断是否在下载
    const previousReceived = downloadInfo.receivedBytes;
    const previousTotal = downloadInfo.totalBytes;
    const previousState = downloadInfo.state;

    // 计算速度（每秒字节数）- 使用最近的变化量而不是总量
    if (timeDelta > 0 && currentReceived > 0) {
      downloadInfo.speed = currentReceived / timeDelta;
    }

    // 更新下载信息
    downloadInfo.receivedBytes = currentReceived;
    // 只有在 totalBytes 有效时才更新（大于0）
    if (currentTotal > 0) {
      downloadInfo.totalBytes = currentTotal;
    }
    
    // 获取下载项状态
    let newState = downloadItem.getState();
    
    // 如果状态是 cancelled 但下载实际上还在进行（receivedBytes 在增加），保持 progressing 状态
    if (newState === 'cancelled') {
      // 检查是否真的在下载（bytes 在增加，或者有总大小但还没下载完）
      const isActuallyDownloading = currentReceived > previousReceived || 
                                    (currentTotal > 0 && currentReceived < currentTotal && currentReceived > 0);
      
      if (isActuallyDownloading) {
        newState = 'progressing';
      }
    }
    
    // 如果之前是 progressing 状态，且新状态是 cancelled，但 receivedBytes 还在增加，保持 progressing
    if (downloadInfo.state === 'progressing' && newState === 'cancelled') {
      // 检查是否真的在下载（bytes 在增加）
      if (currentReceived > previousReceived || (currentTotal > 0 && currentReceived < currentTotal && currentReceived > 0)) {
        newState = 'progressing';
      }
    }
    
    downloadInfo.state = newState as DownloadInfo['state'];

    // 通知渲染进程
    this.notifyDownloadUpdate(downloadInfo);
  }

  /**
   * 处理下载完成
   */
  private handleDownloadDone(downloadId: string, state: string) {
    const downloadInfo = this.downloads.get(downloadId);
    const downloadItem = this.downloadItems.get(downloadId);
    
    if (!downloadInfo) {
      return;
    }

    // 如果状态是 cancelled，但下载实际上可能还在进行，检查一下
    if (state === 'cancelled' && downloadItem) {
      const currentReceived = downloadItem.getReceivedBytes();
      const currentTotal = downloadItem.getTotalBytes();
      
      // 如果之前的状态是 progressing，且 totalBytes > 0（说明有下载任务），可能是误报
      // 如果 receivedBytes 是 0 且 totalBytes > 0，说明下载还没开始，不应该立即标记为 cancelled
      // 让 updateDownloadProgress 来处理状态更新，而不是在这里立即更新
      if (downloadInfo.state === 'progressing' && currentTotal > 0 && currentReceived === 0) {
        // 不更新状态，不清理 downloadItem，等待 updated 事件来更新状态
        return;
      }
      
      // 如果 receivedBytes > 0，说明下载已经开始了，如果状态是 cancelled，可能是真的取消了
      // 但也要检查一下是否还在下载
      if (currentReceived > 0 && currentReceived < currentTotal) {
        // 不更新状态，等待 updated 事件来更新状态
        return;
      }
    }

    // 只有在确认下载真的完成或取消时，才更新状态
    downloadInfo.state = state as DownloadInfo['state'];
    
    // 如果下载完成，确保显示100%
    if (state === 'completed' && downloadInfo.totalBytes > 0) {
      downloadInfo.receivedBytes = downloadInfo.totalBytes;
    }

    // 通知渲染进程
    this.notifyDownloadUpdate(downloadInfo);

    // 如果下载完成或取消，清理下载项引用（但保留下载信息）
    if (state === 'completed' || state === 'cancelled') {
      this.downloadItems.delete(downloadId);
    }
  }

  /**
   * 通知渲染进程下载更新
   */
  private notifyDownloadUpdate(downloadInfo: DownloadInfo) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('download:update', downloadInfo);
    }
  }

  /**
   * 取消下载
   */
  cancelDownload(downloadId: string): boolean {
    const downloadItem = this.downloadItems.get(downloadId);
    const downloadInfo = this.downloads.get(downloadId);
    if (downloadItem && downloadInfo && downloadInfo.state === 'progressing') {
      downloadItem.cancel();
      return true;
    }
    return false;
  }

  /**
   * 暂停下载
   */
  pauseDownload(downloadId: string): boolean {
    const downloadItem = this.downloadItems.get(downloadId);
    const downloadInfo = this.downloads.get(downloadId);
    if (downloadItem && downloadInfo && downloadInfo.state === 'progressing') {
      try {
        downloadItem.pause();
        return true;
      } catch (error) {
        console.error('[DownloadManager] 暂停下载失败:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 恢复下载
   */
  resumeDownload(downloadId: string): boolean {
    const downloadItem = this.downloadItems.get(downloadId);
    const downloadInfo = this.downloads.get(downloadId);
    if (downloadItem && downloadInfo && downloadInfo.state === 'interrupted') {
      try {
        downloadItem.resume();
        return true;
      } catch (error) {
        console.error('[DownloadManager] 恢复下载失败:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 删除下载记录
   */
  removeDownload(downloadId: string): boolean {
    const downloadInfo = this.downloads.get(downloadId);
    if (!downloadInfo) return false;

    // 如果正在下载，先取消
    if (downloadInfo.state === 'progressing') {
      this.cancelDownload(downloadId);
    }

    this.downloads.delete(downloadId);
    this.downloadItems.delete(downloadId);

    // 通知渲染进程
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('download:removed', { downloadId });
    }

    return true;
  }

  /**
   * 获取所有下载
   */
  getAllDownloads(): DownloadInfo[] {
    const downloads = Array.from(this.downloads.values());
    
    // 验证并修复状态：如果状态是 cancelled 但下载项还在且正在下载，修复状态
    downloads.forEach(downloadInfo => {
      const downloadItem = this.downloadItems.get(downloadInfo.id);
      if (downloadItem && downloadInfo.state === 'cancelled') {
        const currentReceived = downloadItem.getReceivedBytes();
        const currentTotal = downloadItem.getTotalBytes();
        const itemState = downloadItem.getState();
        
        // 如果下载项状态是 progressing 或者 bytes 在增加，修复状态
        if (itemState === 'progressing' || (currentTotal > 0 && currentReceived < currentTotal && currentReceived > 0)) {
          downloadInfo.state = 'progressing';
        }
      }
    });
    
    return downloads;
  }

  /**
   * 根据 tabId 获取下载列表
   */
  getDownloadsByTabId(tabId: string): DownloadInfo[] {
    return Array.from(this.downloads.values()).filter(d => d.tabId === tabId);
  }

  /**
   * 获取下载信息
   */
  getDownload(downloadId: string): DownloadInfo | undefined {
    return this.downloads.get(downloadId);
  }

  /**
   * 根据文件扩展名获取默认图标
   */
  getDefaultIconForFileType(filename: string): string {
    const ext = extname(filename).toLowerCase();
    const iconMap: Record<string, string> = {
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.png': '🖼️',
      '.gif': '🖼️',
      '.webp': '🖼️',
      '.pdf': '📄',
      '.doc': '📝',
      '.docx': '📝',
      '.xls': '📊',
      '.xlsx': '📊',
      '.zip': '📦',
      '.rar': '📦',
      '.7z': '📦',
      '.mp4': '🎬',
      '.mp3': '🎵',
      '.avi': '🎬',
      '.mov': '🎬',
      '.exe': '⚙️',
      '.msi': '⚙️',
      '.dmg': '💿',
      '.apk': '📱',
    };
    return iconMap[ext] || '📁';
  }
}

