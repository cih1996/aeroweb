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
      error = '该名称已存在';
      return;
    }
    error = '';
    dispatch('submit', { name: trimmedName });
    handleClose();
  }

  function handleClose() {
    name = '';
    error = '';
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') handleClose();
    else if (event.key === 'Enter' && event.ctrlKey) handleSubmit();
  }

  $: if (show) {
    setTimeout(() => {
      const input = document.querySelector('.config-modal input') as HTMLInputElement;
      if (input) input.focus();
    }, 100);
  }
</script>

{#if show}
  <div class="modal-overlay" role="dialog" aria-modal="true" on:click={handleClose} on:keydown={handleKeydown}>
    <div class="modal-content" role="document" on:click|stopPropagation on:keydown|stopPropagation>
      <div class="modal-header">
        <h2>创建浏览器配置</h2>
        <button class="close-btn" on:click={handleClose} aria-label="关闭">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
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
            placeholder="如：工作账号、个人账号"
            class:error={error || isNameDuplicate}
            on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
          />
          {#if error}
            <div class="error-message">{error}</div>
          {:else if isNameDuplicate && name.trim()}
            <div class="error-message">该名称已存在</div>
          {/if}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={handleClose}>取消</button>
        <button class="btn btn-primary" on:click={handleSubmit} disabled={!name.trim() || isNameDuplicate}>创建</button>
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
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--bg-elevated);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 440px;
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

  .modal-body {
    padding: var(--spacing-xl);
  }

  .form-group {
    margin-bottom: var(--spacing-lg);
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }

  .required {
    color: var(--color-error);
  }

  .app-info {
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-md);
  }

  .app-name {
    display: block;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .app-url {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  input[type="text"] {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    transition: all 0.15s ease;
    box-sizing: border-box;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--accent-bg);
  }

  input[type="text"].error {
    border-color: var(--color-error);
  }

  .error-message {
    margin-top: var(--spacing-xs);
    font-size: var(--font-size-xs);
    color: var(--color-error);
  }

  .modal-footer {
    padding: var(--spacing-lg) var(--spacing-xl);
    border-top: 1px solid var(--border-secondary);
    display: flex;
    gap: var(--spacing-sm);
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

  .btn-secondary {
    background: var(--bg-hover);
    color: var(--text-secondary);
    border: 1px solid var(--border-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }

  .btn-primary {
    background: var(--accent-primary);
    color: var(--bg-primary);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
