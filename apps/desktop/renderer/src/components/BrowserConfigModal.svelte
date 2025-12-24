<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BrowserConfig } from '../types/browser-config';

  export let show: boolean = false;
  export let appId: string = '';
  export let appName: string = '';
  export let appUrl: string = '';
  export let existingConfigs: BrowserConfig[] = [];

  const dispatch = createEventDispatcher();

  let name: string = '';
  let error: string = '';

  $: isNameDuplicate = existingConfigs.some(
    config => config.appId === appId && config.name.toLowerCase() === name.toLowerCase().trim()
  );

  function handleSubmit() {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      error = '请输入浏览器名称';
      return;
    }

    if (isNameDuplicate) {
      error = '该名称已存在，请使用其他名称';
      return;
    }

    error = '';
    dispatch('submit', {
      name: trimmedName,
    });
    handleClose();
  }

  function handleClose() {
    name = '';
    error = '';
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    } else if (event.key === 'Enter' && event.ctrlKey) {
      handleSubmit();
    }
  }

  // 当显示时，自动聚焦输入框
  $: if (show) {
    setTimeout(() => {
      const input = document.querySelector('.config-modal input') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 100);
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={handleClose} on:keydown={handleKeydown}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>创建浏览器配置</h2>
        <button class="close-button" on:click={handleClose}>×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>应用</label>
          <div class="app-info">
            <span class="app-name">{appName}</span>
            <span class="app-url">{appUrl}</span>
          </div>
        </div>

        <div class="form-group">
          <label for="browser-name">浏览器名称 <span class="required">*</span></label>
          <input
            id="browser-name"
            type="text"
            bind:value={name}
            placeholder="请输入浏览器名称（如：工作账号、个人账号等）"
            class:error={error || isNameDuplicate}
            on:keydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          {#if error}
            <div class="error-message">{error}</div>
          {:else if isNameDuplicate && name.trim()}
            <div class="error-message">该名称已存在，请使用其他名称</div>
          {/if}
        </div>

        <!-- 未来扩展：代理配置 -->
        <!-- <div class="form-group">
          <label>代理设置（可选）</label>
          <div class="proxy-config">
            ...
          </div>
        </div> -->
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" on:click={handleClose}>取消</button>
        <button class="btn-primary" on:click={handleSubmit} disabled={!name.trim() || isNameDuplicate}>
          创建
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
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%);
    border: 1px solid rgba(79, 172, 254, 0.3);
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
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

  .modal-body {
    padding: 24px;
    flex: 1;
    overflow-y: auto;
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
    color: #ff6b6b;
  }

  .app-info {
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
  }

  .app-name {
    display: block;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 4px;
  }

  .app-url {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  input[type="text"] {
    width: 100%;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: #4facfe;
    box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
  }

  input[type="text"].error {
    border-color: #ff6b6b;
  }

  .error-message {
    margin-top: 6px;
    font-size: 12px;
    color: #ff6b6b;
  }

  .modal-footer {
    padding: 24px;
    border-top: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .btn-secondary,
  .btn-primary {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
  }

  .btn-primary {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

