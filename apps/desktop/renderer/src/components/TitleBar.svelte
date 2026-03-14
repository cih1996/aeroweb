<script lang="ts">
  import MinimizeIcon from './icons/MinimizeIcon.svelte';
  import MaximizeIcon from './icons/MaximizeIcon.svelte';
  import CloseIcon from './icons/CloseIcon.svelte';
  import RestoreIcon from './icons/RestoreIcon.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import type { Theme } from './ThemeProvider.svelte';
  import { onMount, createEventDispatcher } from 'svelte';

  export let currentTheme: Theme = 'system';
  export let resolvedTheme: 'light' | 'dark' = 'dark';

  const dispatch = createEventDispatcher();

  let isMaximized = false;
  let isMac = false;

  onMount(() => {
    isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  });

  async function handleMinimize() {
    await window.electronAPI.window.minimize();
  }

  async function handleMaximize() {
    isMaximized = !isMaximized;
    await window.electronAPI.window.maximize();
  }

  async function handleClose() {
    await window.electronAPI.window.close();
  }

  function handleToggleTheme() {
    dispatch('toggleTheme');
  }
</script>

<div class="title-bar" data-tauri-drag-region class:mac={isMac}>
  <div class="title-bar-left">
    <img src="./logo.svg" alt="PolyWebsAI" class="title-bar-logo" />
    <div class="app-name">PolyWebsAI</div>
  </div>

  <div class="title-bar-center">
    <!-- 可扩展区域 -->
  </div>

  <div class="title-bar-right">
    <div class="title-bar-actions">
      <ThemeToggle
        theme={currentTheme}
        {resolvedTheme}
        on:toggle={handleToggleTheme}
      />
    </div>

    {#if !isMac}
      <div class="window-controls">
        <button class="window-button" on:click={handleMinimize} title="最小化">
          <MinimizeIcon />
        </button>
        <button class="window-button" on:click={handleMaximize} title={isMaximized ? '还原' : '最大化'}>
          {#if isMaximized}
            <RestoreIcon />
          {:else}
            <MaximizeIcon />
          {/if}
        </button>
        <button class="window-button close" on:click={handleClose} title="关闭">
          <CloseIcon />
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .title-bar {
    height: var(--titlebar-height);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--spacing-md);
    -webkit-app-region: drag;
    user-select: none;
    position: relative;
    z-index: 1000;
  }

  .title-bar.mac {
    padding-left: 80px;
  }

  .title-bar-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-shrink: 0;
  }

  .title-bar-logo {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .app-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .title-bar-center {
    flex: 1;
  }

  .title-bar-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    -webkit-app-region: no-drag;
  }

  .title-bar-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .window-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: var(--spacing-sm);
  }

  .window-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
    padding: 0;
  }

  .window-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .window-button.close:hover {
    background: var(--color-error);
    color: white;
  }
</style>
