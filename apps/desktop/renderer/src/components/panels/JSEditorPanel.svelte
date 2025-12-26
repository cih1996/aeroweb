<script lang="ts">
  import { onMount } from 'svelte';
  import * as douyinActions from './actions/douyin-actions';
  
  export let tabId: string | null = null;
  export let appId: string = '';

  let result: any = null;
  let error: string | null = null;
  let executing = false;
  let executionTime = 0;
  
  // 发送评论的参数
  let commentText: string = '';
  let commentIndex: string = '-1';

  // 执行抖音方法
  async function executeDouyinMethod(methodName: string, ...args: any[]) {
    if (!tabId) {
      error = '没有活动的标签页';
      return;
    }

    executing = true;
    error = null;
    result = null;
    executionTime = 0;
    const startTime = Date.now();

    try {
      let method: any;
      
      // 根据方法名调用对应的函数
      switch (methodName) {
        case 'douyin_getCurrentAwemeInfo':
          method = douyinActions.getCurrentAwemeInfo;
          break;
        case 'douyin_getVideoInfo':
          method = douyinActions.getVideoInfo;
          break;
        case 'douyin_digg':
          method = douyinActions.digg;
          break;
        case 'douyin_next':
          method = douyinActions.next;
          break;
        case 'douyin_toJingXuan':
          method = douyinActions.toJingXuan;
          break;
        case 'douyin_getComments':
          method = douyinActions.getComments;
          break;
        case 'pasteIntoDraft':
          method = douyinActions.sendComment;
          break;
        case 'douyin_getMyInfo':
          method = douyinActions.getMyInfo;
          break;
        case 'douyin_getCurrentUserInfo':
          method = douyinActions.getCurrentUserInfo;
          break;
        case 'douyin_getCurrentUserInfo2':
          method = douyinActions.getCurrentUserInfo2;
          break;
        default:
          throw new Error(`未知的方法: ${methodName}`);
      }

      result = await method(tabId, ...args);
      executionTime = Date.now() - startTime;
      console.log('[JSEditorPanel] 执行结果:', result);
    } catch (err: any) {
      error = err.message || String(err);
      console.error('[JSEditorPanel] 执行错误:', err);
    } finally {
      executing = false;
    }
  }


  // 执行下载视频
  async function executeDownloadVideo() {
    if (!tabId) {
      error = '没有活动的标签页';
      return;
    }
    executing = true;
    error = null;
    result = null;
    try {
      // 1. 获取当前视频详细信息
      const awemeInfo = await douyinActions.getCurrentAwemeInfo(tabId);

      // 2. 提取下载地址
      let downloadUrl = null;
      if (awemeInfo && awemeInfo.video && awemeInfo.video.download) {
        downloadUrl = awemeInfo.video.download;
      }

      if (!downloadUrl) {
        error = '未能获取视频下载链接';
        console.log("[JSEditorPanel] 未能获取到下载结果",awemeInfo)
        executing = false;
        return;
      }

      // 3. 调用主进程接口进行下载
      await window.electronAPI.tab.downloadUrl(tabId, downloadUrl);

      result = { success: true, msg: '下载已开始', url: downloadUrl };
    } catch (err: any) {
      error = err.message || String(err);
    } finally {
      executing = false;
    }
  }

  function formatResult(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  async function openDevTools() {
    if (!tabId) {
      return;
    }

    try {
      await window.electronAPI.tab.openDevTools(tabId);
    } catch (err: any) {
      error = err.message || String(err);
    }
  }
</script>

<div class="js-editor-panel">
  <div class="panel-header">
    <h3>抖音操作面板</h3>
    <div class="panel-actions">
      <button 
        class="btn-debug" 
        on:click={openDevTools}
        disabled={!tabId}
        title="打开开发者工具"
      >
        调试面板
      </button>
    </div>
  </div>

  <div class="panel-content">
    <div class="buttons-section">
      <div class="button-group">
        <h4>视频操作</h4>
        <div class="buttons-grid">
          <button 
            class="action-btn"
            on:click={() => executeDouyinMethod('douyin_getVideoInfo')}
            disabled={executing || !tabId}
            title="获取当前视频信息"
          >
            获取视频信息
          </button>
          <button 
          class="action-btn"
          on:click={() => executeDouyinMethod('douyin_getCurrentAwemeInfo')}
          disabled={executing || !tabId}
          title="获取当前视频详细信息"
        >
          获取视频详细信息
        </button>


        <button 
        class="action-btn"
        on:click={() => executeDownloadVideo()}
        disabled={executing || !tabId}
        title="下载当前视频"
      >
        下载视频
      </button>


          <button 
            class="action-btn"
            on:click={() => executeDouyinMethod('douyin_digg')}
            disabled={executing || !tabId}
            title="点赞当前视频"
          >
            点赞视频
          </button>
          <button 
            class="action-btn"
            on:click={() => executeDouyinMethod('douyin_next')}
            disabled={executing || !tabId}
            title="下一条视频"
          >
            下一条
          </button>
          <button 
            class="action-btn"
            on:click={() => executeDouyinMethod('douyin_toJingXuan')}
            disabled={executing || !tabId}
            title="前往视频精选区"
          >
            前往精选
          </button>
        </div>
      </div>

      <div class="button-group">
        <h4>评论操作</h4>
        <div class="buttons-grid">
          <button 
            class="action-btn"
            on:click={() => executeDouyinMethod('douyin_getComments', 0)}
            disabled={executing || !tabId}
            title="获取评论区信息"
          >
            获取评论
          </button>
          <button 
            class="action-btn"
            on:click={() => executeDouyinMethod('douyin_getMyInfo')}
            disabled={executing || !tabId}
            title="获取个人资料"
          >
            获取个人资料
          </button>
          <button 
            class="action-btn"
            on:click={() => executeDouyinMethod('douyin_getCurrentUserInfo')}
            disabled={executing || !tabId}
            title="获取当前用户资料"
          >
            获取当前资料
          </button>
          <button 
            class="action-btn"
            on:click={() => executeDouyinMethod('douyin_getCurrentUserInfo2')}
            disabled={executing || !tabId}
            title="获取当前博主资料"
          >
            获取博主资料
          </button>
        </div>
        <div class="input-group">
          <label for="comment-text-input">发送评论</label>
          <div class="input-row">
            <input
              id="comment-text-input"
              type="text"
              class="comment-input"
              bind:value={commentText}
              placeholder="输入评论内容"
              disabled={executing || !tabId}
            />
            <input
              id="comment-index-input"
              type="number"
              class="comment-index-input"
              bind:value={commentIndex}
              placeholder="回复索引(-1=不回复)"
              disabled={executing || !tabId}
            />
            <button 
              class="action-btn"
              on:click={() => executeDouyinMethod('pasteIntoDraft', commentText, parseInt(commentIndex) || -1)}
              disabled={executing || !tabId || !commentText.trim()}
              title="发送评论"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="result-section">
      <div class="section-header">
        <span class="section-title">执行结果</span>
        {#if executionTime > 0}
          <span class="execution-time">{executionTime}ms</span>
        {/if}
      </div>
      {#if executing}
        <div class="loading-state">
          <div class="spinner"></div>
          <span>执行中...</span>
        </div>
      {:else if error}
        <div class="error-result">
          <div class="error-icon">⚠️</div>
          <pre class="error-text">{error}</pre>
        </div>
      {:else if result !== null}
        <div class="success-result">
          <pre class="result-text">{formatResult(result)}</pre>
        </div>
      {:else}
        <div class="empty-result">
          <p>点击按钮执行操作，结果将显示在这里</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .js-editor-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-height: 0; /* 重要：允许 flex 子元素缩小 */
    background: rgba(26, 31, 58, 0.95);
    border-left: 1px solid rgba(79, 172, 254, 0.2);
    overflow: hidden; /* 防止整个面板溢出 */
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

  .panel-actions {
    display: flex;
    gap: 8px;
  }

  .btn-debug {
    padding: 6px 12px;
    background: rgba(79, 172, 254, 0.2);
    border: 1px solid rgba(79, 172, 254, 0.4);
    border-radius: 6px;
    color: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-debug:hover:not(:disabled) {
    background: rgba(79, 172, 254, 0.3);
    border-color: rgba(79, 172, 254, 0.6);
    box-shadow: 0 2px 8px rgba(79, 172, 254, 0.3);
  }

  .btn-debug:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .buttons-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 16px;
    gap: 24px;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .button-group h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .buttons-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .action-btn {
    padding: 10px 16px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .action-btn:hover:not(:disabled) {
    box-shadow: 0 2px 8px rgba(79, 172, 254, 0.4);
    transform: translateY(-1px);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .input-group label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
  }

  .input-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .comment-input {
    flex: 1;
    padding: 8px 12px;
    background: rgba(10, 14, 39, 0.8);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    outline: none;
  }

  .comment-input:focus {
    border-color: rgba(79, 172, 254, 0.5);
    box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.1);
  }

  .comment-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .comment-index-input {
    width: 120px;
    padding: 8px 12px;
    background: rgba(10, 14, 39, 0.8);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    outline: none;
  }

  .comment-index-input:focus {
    border-color: rgba(79, 172, 254, 0.5);
    box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.1);
  }

  .comment-index-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .result-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-top: 1px solid rgba(79, 172, 254, 0.1);
  }

  .section-header {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(79, 172, 254, 0.1);
  }

  .section-header .section-title {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .execution-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .result-section {
    overflow-y: auto;
  }

  .result-section::-webkit-scrollbar {
    width: 8px;
  }

  .result-section::-webkit-scrollbar-track {
    background: transparent;
  }

  .result-section::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 4px;
  }

  .loading-state {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 24px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(79, 172, 254, 0.2);
    border-top-color: #4facfe;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-result {
    padding: 16px;
    display: flex;
    gap: 12px;
  }

  .error-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
    margin: 0;
    padding: 12px;
    background: rgba(255, 59, 48, 0.1);
    border: 1px solid rgba(255, 59, 48, 0.3);
    border-radius: 6px;
    color: #ff3b30;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-x: auto;
  }

  .success-result {
    padding: 16px;
  }

  .result-text {
    margin: 0;
    padding: 12px;
    background: rgba(79, 172, 254, 0.1);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-x: auto;
  }

  .empty-result {
    padding: 24px;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
  }

  .empty-result p {
    margin: 0;
  }
</style>

