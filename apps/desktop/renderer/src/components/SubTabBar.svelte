<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface SubTab {
    id: string;
    title: string;
    url: string;
    active: boolean;
  }

  export let subTabs: SubTab[] = [];
  export let activeSubTabId: string | null = null;

  const dispatch = createEventDispatcher();

  function activateSubTab(tabId: string) {
    dispatch('activate', { tabId });
  }

  function closeSubTab(tabId: string, event: MouseEvent) {
    event.stopPropagation();
    dispatch('close', { tabId });
  }

  function getHostname(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }
</script>

{#if subTabs.length > 0}
  <div class="sub-tab-bar">
    <div class="sub-tabs">
      {#each subTabs as tab (tab.id)}
        <button
          class="sub-tab"
          class:active={tab.id === activeSubTabId}
          on:click={() => activateSubTab(tab.id)}
          title={tab.url}
        >
          <span class="sub-tab-title">{tab.title || getHostname(tab.url)}</span>
          <button
            class="sub-tab-close"
            on:click={(e) => closeSubTab(tab.id, e)}
            title="关闭"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .sub-tab-bar {
    height: 32px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    align-items: center;
    padding: 0 8px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .sub-tab-bar::-webkit-scrollbar {
    height: 4px;
  }

  .sub-tab-bar::-webkit-scrollbar-thumb {
    background: var(--border-secondary);
    border-radius: 2px;
  }

  .sub-tabs {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .sub-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    max-width: 180px;
    min-width: 80px;
  }

  .sub-tab:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .sub-tab.active {
    background: var(--accent-bg);
    border-color: var(--accent-primary);
  }

  .sub-tab-title {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .sub-tab.active .sub-tab-title {
    color: var(--accent-primary);
  }

  .sub-tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .sub-tab:hover .sub-tab-close {
    opacity: 1;
  }

  .sub-tab-close:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-error);
  }
</style>
