<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Theme } from './ThemeProvider.svelte';

  export let theme: Theme = 'system';
  export let resolvedTheme: 'light' | 'dark' = 'dark';

  const dispatch = createEventDispatcher<{ toggle: void }>();

  function handleClick() {
    dispatch('toggle');
  }

  function getLabel(t: Theme): string {
    switch (t) {
      case 'light': return '浅色';
      case 'dark': return '深色';
      case 'system': return '跟随系统';
    }
  }
</script>

<button
  class="theme-toggle"
  on:click={handleClick}
  title="切换主题 ({getLabel(theme)})"
  aria-label="切换主题"
>
  <div class="icon-container">
    {#if resolvedTheme === 'dark'}
      <!-- 月亮图标 -->
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    {:else}
      <!-- 太阳图标 -->
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    {/if}
  </div>
  {#if theme === 'system'}
    <span class="system-indicator">A</span>
  {/if}
</button>

<style>
  .theme-toggle {
    position: relative;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-hover);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .theme-toggle:hover {
    background: var(--bg-active);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }

  .icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon {
    width: 18px;
    height: 18px;
  }

  .system-indicator {
    position: absolute;
    bottom: 2px;
    right: 2px;
    font-size: 8px;
    font-weight: 600;
    color: var(--text-muted);
    line-height: 1;
  }
</style>
