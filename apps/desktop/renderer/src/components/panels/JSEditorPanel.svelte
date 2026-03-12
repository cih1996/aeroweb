<script lang="ts">
  export let tabId: string | null = null;
  export let appId: string = '';

  let code: string = '// 在此输入 JavaScript 代码\nreturn document.title;';
  let result: any = null;
  let error: string | null = null;
  let executing = false;
  let executionTime = 0;

  // 执行 JavaScript 代码
  async function executeCode() {
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
      // 通过 electronAPI 在标签页中执行代码
      const execResult = await window.electronAPI.tab.executeScript(tabId, code);
      result = execResult;
      executionTime = Date.now() - startTime;
      console.log('[JSEditorPanel] 执行结果:', result);
    } catch (err: any) {
      error = err.message || String(err);
      console.error('[JSEditorPanel] 执行错误:', err);
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
    if (!tabId) return;
    try {
      await window.electronAPI.tab.openDevTools(tabId);
    } catch (err: any) {
      error = err.message || String(err);
    }
  }

  function clearCode() {
    code = '';
    result = null;
    error = null;
  }
</script>

<div class="js-editor-panel">
  <div class="panel-header">
    <h3>JS 执行器</h3>
    <div class="panel-actions">
      <button
        class="btn-secondary"
        on:click={clearCode}
        title="清空代码"
      >
        清空
      </button>
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
    <div class="editor-section">
      <textarea
        class="code-editor"
        bind:value={code}
        placeholder="// 输入 JavaScript 代码..."
        disabled={executing}
        spellcheck="false"
      ></textarea>
      <div class="editor-actions">
        <button
          class="action-btn execute-btn"
          on:click={executeCode}
          disabled={executing || !tabId || !code.trim()}
        >
          {#if executing}
            执行中...
          {:else}
            ▶ 执行
          {/if}
        </button>
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
          <p>输入代码并点击执行，结果将显示在这里</p>
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
    min-height: 0;
    background: rgba(26, 31, 58, 0.95);
    border-left: 1px solid rgba(79, 172, 254, 0.2);
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

  .panel-actions {
    display: flex;
    gap: 8px;
  }

  .btn-secondary,
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

  .btn-secondary:hover,
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

  .editor-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    gap: 12px;
    min-height: 200px;
  }

  .code-editor {
    flex: 1;
    padding: 12px;
    background: rgba(10, 14, 39, 0.8);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.9);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: none;
    outline: none;
  }

  .code-editor:focus {
    border-color: rgba(79, 172, 254, 0.5);
    box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.1);
  }

  .code-editor::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .editor-actions {
    display: flex;
    justify-content: flex-end;
  }

  .action-btn {
    padding: 10px 24px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    box-shadow: 0 2px 12px rgba(79, 172, 254, 0.5);
    transform: translateY(-1px);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .result-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-top: 1px solid rgba(79, 172, 254, 0.1);
    overflow-y: auto;
  }

  .section-header {
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(79, 172, 254, 0.1);
  }

  .section-title {
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
