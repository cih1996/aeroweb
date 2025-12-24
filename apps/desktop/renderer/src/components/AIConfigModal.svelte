<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AIConfig } from '../services/ai';
  import { getDefaultConfig, validateConfig, loadAIConfig, loadAllConfigs, saveAIConfig } from '../services/ai';

  export let show: boolean = false;
  export let config: AIConfig = getDefaultConfig();

  const dispatch = createEventDispatcher();

  let formConfig: AIConfig = getDefaultConfig();
  let error: string | null = null;
  let modalContent: HTMLDivElement;
  let isInitialized = false;
  let allConfigs = loadAllConfigs();
  let previousProvider: 'openai' | 'deepseek' | null = null;

  // 当模态框显示时，加载当前服务商的配置
  $: if (show && !isInitialized) {
    // 重新加载所有配置
    allConfigs = loadAllConfigs();
    // 记录当前服务商
    previousProvider = config.provider;
    // 加载当前服务商的配置
    const currentConfig = loadAIConfig(config.provider);
    formConfig = { ...currentConfig };
    error = null;
    isInitialized = true;
    
    // 延迟一下，确保 DOM 更新完成后再聚焦
    setTimeout(() => {
      if (modalContent) {
        const firstInput = modalContent.querySelector('input, select') as HTMLElement;
        if (firstInput) {
          firstInput.focus();
        }
      }
    }, 100);
  }
  
  // 当模态框关闭时，重置初始化状态
  $: if (!show) {
    isInitialized = false;
    previousProvider = null;
  }
  
  // 当切换服务商时，加载对应服务商的配置
  function handleProviderChange() {
    if (!formConfig.provider || !previousProvider) return;
    
    // 如果切换了服务商，先保存之前服务商的配置
    if (previousProvider !== formConfig.provider) {
      // 保存之前服务商的配置（使用之前的 provider 值）
      const previousConfig: AIConfig = {
        ...formConfig,
        provider: previousProvider,
      };
      // 保存到 localStorage
      try {
        saveAIConfig(previousConfig);
        console.log(`[AIConfigModal] 已保存 ${previousProvider} 的配置`);
      } catch (err) {
        console.error('[AIConfigModal] 保存配置失败:', err);
      }
    }
    
    // 更新 previousProvider 为新的服务商
    previousProvider = formConfig.provider;
    
    // 重新加载所有配置（从 localStorage）
    allConfigs = loadAllConfigs();
    
    // 加载新服务商的配置
    const newProviderConfig = allConfigs[formConfig.provider] || getDefaultConfig(formConfig.provider);
    formConfig = { ...newProviderConfig };
    error = null;
  }

  function handleClose() {
    dispatch('close');
  }

  function handleSave() {
    // 验证配置
    const validation = validateConfig(formConfig);
    if (!validation.valid) {
      error = validation.error || '配置验证失败';
      return;
    }

    error = null;
    // 保存当前服务商的配置到 allConfigs
    allConfigs[formConfig.provider] = { ...formConfig };
    dispatch('save', { config: formConfig });
    handleClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!show) return;
    if (event.key === 'Escape') {
      handleClose();
    } else if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      handleSave();
    }
  }
  
  function handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClose();
    }
  }
</script>

<!-- 全局键盘事件处理 -->
<svelte:window on:keydown={handleKeydown} />

{#if show}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div 
    class="modal-overlay" 
    role="dialog"
    aria-modal="true"
    aria-labelledby="ai-config-title"
    on:click={handleClose}
    on:keydown={handleOverlayKeydown}
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div 
      class="modal-content" 
      bind:this={modalContent}
      on:click|stopPropagation
      role="document"
      tabindex="-1"
    >
      <div class="modal-header">
        <h2 id="ai-config-title">AI 配置</h2>
        <button 
          class="close-btn" 
          type="button"
          on:click={handleClose} 
          aria-label="关闭配置窗口"
          title="关闭 (Esc)"
        >
          ✕
        </button>
      </div>

      <div class="modal-body">
        {#if error}
          <div class="error-message">
            ⚠️ {error}
          </div>
        {/if}

        <div class="form-group">
          <label for="provider">AI 服务商</label>
          <select 
            id="provider" 
            bind:value={formConfig.provider}
            on:change={handleProviderChange}
          >
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <div class="form-group">
          <label for="apiKey">API Key <span class="required">*</span></label>
          <input
            id="apiKey"
            type="password"
            bind:value={formConfig.apiKey}
            placeholder="输入 API Key"
          />
        </div>

        <div class="form-group">
          <label for="baseUrl">API Base URL</label>
          <input
            id="baseUrl"
            type="text"
            bind:value={formConfig.baseUrl}
            placeholder="留空使用默认地址"
          />
          <small class="hint">留空将使用服务商的默认地址</small>
        </div>

        <div class="form-group">
          <label for="model">模型名称</label>
          <input
            id="model"
            type="text"
            bind:value={formConfig.model}
            placeholder="例如: gpt-4o-mini"
          />
        </div>

        <div class="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              bind:checked={formConfig.useProxy}
            />
            <span>使用代理</span>
          </label>
        </div>

        {#if formConfig.useProxy}
          <div class="form-group">
            <label for="proxyUrl">代理地址</label>
            <input
              id="proxyUrl"
              type="text"
              bind:value={formConfig.proxyUrl}
              placeholder="例如: http://127.0.0.1:7890"
            />
            <small class="hint">格式: http://host:port 或 https://host:port</small>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" on:click={handleClose}>
          取消
        </button>
        <button class="btn-save" on:click={handleSave}>
          保存 (Ctrl+Enter)
        </button>
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
    z-index: 9999999;
    backdrop-filter: blur(4px);
    pointer-events: auto;
    isolation: isolate;
  }

  .modal-content {
    background: rgba(26, 31, 58, 0.98);
    border: 1px solid rgba(79, 172, 254, 0.3);
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    position: relative;
    z-index: 10000000;
    pointer-events: auto;
    overflow: hidden;
    outline: none;
    isolation: isolate;
  }
  
  .modal-content:focus {
    outline: none;
  }
  
  .modal-content * {
    pointer-events: auto !important;
  }
  
  .modal-content input,
  .modal-content select,
  .modal-content button,
  .modal-content label {
    pointer-events: auto !important;
    cursor: pointer;
  }
  
  .modal-content input[type="text"],
  .modal-content input[type="password"] {
    cursor: text;
  }

  .modal-header {
    padding: 20px 24px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 20px;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
  }

  .error-message {
    padding: 12px 16px;
    background: rgba(255, 59, 48, 0.1);
    border: 1px solid rgba(255, 59, 48, 0.3);
    border-radius: 6px;
    color: #ff3b30;
    font-size: 14px;
    margin-bottom: 20px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  .required {
    color: #ff3b30;
  }

  .form-group input[type="text"],
  .form-group input[type="password"],
  .form-group select {
    width: 100%;
    padding: 10px 12px;
    background: rgba(10, 14, 39, 0.8);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box;
    pointer-events: auto;
    user-select: text;
    -webkit-user-select: text;
  }
  
  .form-group select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 36px;
  }
  
  .form-group input:disabled,
  .form-group select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: rgba(79, 172, 254, 0.5);
    box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.1);
  }

  .form-group input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .hint {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .checkbox-group input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    pointer-events: auto;
    flex-shrink: 0;
  }

  .modal-footer {
    padding: 20px 24px;
    border-top: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .btn-cancel,
  .btn-save {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    pointer-events: auto;
    user-select: none;
  }

  .btn-cancel {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .btn-cancel:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
  }

  .btn-save {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
  }

  .btn-save:hover {
    box-shadow: 0 2px 8px rgba(79, 172, 254, 0.4);
    transform: translateY(-1px);
  }
</style>

