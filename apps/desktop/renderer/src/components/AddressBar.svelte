<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let url: string = '';
  export let title: string = '';
  export let canGoBack: boolean = false;
  export let canGoForward: boolean = false;
  export let isLoading: boolean = false;

  const dispatch = createEventDispatcher();

  let inputUrl = url;
  let isEditing = false;

  $: if (!isEditing) {
    inputUrl = url;
  }

  function handleBack() {
    dispatch('back');
  }

  function handleForward() {
    dispatch('forward');
  }

  function handleRefresh() {
    if (isLoading) {
      dispatch('stop');
    } else {
      dispatch('refresh');
    }
  }

  function handleDevTools() {
    dispatch('devtools');
  }

  function handleUrlSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      let targetUrl = inputUrl.trim();
      if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        // 如果看起来像域名，添加 https://
        if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
          targetUrl = 'https://' + targetUrl;
        } else {
          // 否则当作搜索
          targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
        }
      }
      dispatch('navigate', { url: targetUrl });
      isEditing = false;
      (event.target as HTMLInputElement).blur();
    }
  }

  function handleFocus() {
    isEditing = true;
  }

  function handleBlur() {
    isEditing = false;
    inputUrl = url;
  }
</script>

<div class="address-bar">
  <div class="nav-buttons">
    <button
      class="nav-btn"
      class:disabled={!canGoBack}
      on:click={handleBack}
      title="后退"
      disabled={!canGoBack}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button
      class="nav-btn"
      class:disabled={!canGoForward}
      on:click={handleForward}
      title="前进"
      disabled={!canGoForward}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button
      class="nav-btn"
      on:click={handleRefresh}
      title={isLoading ? '停止' : '刷新'}
    >
      {#if isLoading}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      {:else}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M8 2.5V5.5H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      {/if}
    </button>
  </div>

  <div class="url-container">
    <input
      type="text"
      class="url-input"
      bind:value={inputUrl}
      on:keydown={handleUrlSubmit}
      on:focus={handleFocus}
      on:blur={handleBlur}
      placeholder="输入网址或搜索"
    />
  </div>

  <div class="tool-buttons">
    <button
      class="nav-btn"
      on:click={handleDevTools}
      title="开发者工具"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5.5 6L3 8.5L5.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10.5 6L13 8.5L10.5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 4L7 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .address-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-primary);
    height: 40px;
    box-sizing: border-box;
  }

  .nav-buttons, .tool-buttons {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .nav-btn:active:not(:disabled) {
    background: var(--bg-active);
  }

  .nav-btn.disabled, .nav-btn:disabled {
    color: var(--text-muted);
    cursor: not-allowed;
    opacity: 0.5;
  }

  .url-container {
    flex: 1;
    min-width: 0;
  }

  .url-input {
    width: 100%;
    height: 28px;
    padding: 0 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    transition: all 0.15s ease;
  }

  .url-input:focus {
    border-color: var(--accent-primary);
    background: var(--bg-primary);
  }

  .url-input::placeholder {
    color: var(--text-muted);
  }
</style>
