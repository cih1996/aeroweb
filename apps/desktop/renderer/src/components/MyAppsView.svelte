<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAllConfigs, deleteConfigs } from '../utils/browser-config-storage';
  import { getAllApps } from '../utils/app-storage';
  import type { BrowserConfig } from '../types/browser-config';
  import type { AppConfig } from '../types/app-config';

  const dispatch = createEventDispatcher();

  export let configs: BrowserConfig[] = [];

  let apps: AppConfig[] = [];
  let selectedConfigIds: Set<string> = new Set();
  let isSelectMode = false;

  let appNameMap: Record<string, string> = {};
  let appIconMap: Record<string, string> = {};

  $: groupedConfigs = (() => {
    const grouped: Record<string, BrowserConfig[]> = {};
    configs.forEach(config => {
      const appId = config.appId || 'uncategorized';
      if (!grouped[appId]) grouped[appId] = [];
      grouped[appId].push(config);
    });
    Object.keys(grouped).forEach(appId => {
      grouped[appId].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    });
    return grouped;
  })();

  onMount(async () => {
    apps = getAllApps();
    const newAppNameMap: Record<string, string> = {};
    const newAppIconMap: Record<string, string> = {};
    for (const app of apps) {
      newAppNameMap[app.id] = app.name;
      newAppIconMap[app.id] = app.icon;
    }
    appNameMap = newAppNameMap;
    appIconMap = newAppIconMap;
  });

  function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    if (!isSelectMode) selectedConfigIds.clear();
  }

  function toggleSelect(configId: string) {
    if (selectedConfigIds.has(configId)) {
      selectedConfigIds.delete(configId);
    } else {
      selectedConfigIds.add(configId);
    }
    selectedConfigIds = selectedConfigIds;
  }

  function selectAll() {
    configs.forEach(config => selectedConfigIds.add(config.id));
    selectedConfigIds = new Set(selectedConfigIds);
  }

  function deselectAll() {
    selectedConfigIds.clear();
    selectedConfigIds = new Set();
  }

  function handleConfigClick(config: BrowserConfig) {
    if (isSelectMode) {
      toggleSelect(config.id);
    } else {
      dispatch('configClick', { config });
    }
  }

  function handleBatchRun() {
    const selectedConfigs = configs.filter(c => selectedConfigIds.has(c.id));
    dispatch('batchRun', { configs: selectedConfigs });
    isSelectMode = false;
    selectedConfigIds.clear();
  }

  function handleBatchDelete() {
    if (selectedConfigIds.size === 0) return;
    if (confirm(`确定要删除选中的 ${selectedConfigIds.size} 个配置吗？`)) {
      deleteConfigs(Array.from(selectedConfigIds));
      dispatch('configsDeleted', { configIds: Array.from(selectedConfigIds) });
      selectedConfigIds.clear();
      isSelectMode = false;
    }
  }

  $: appOrder = Object.keys(groupedConfigs).sort((a, b) => {
    const nameA = appNameMap[a] || a;
    const nameB = appNameMap[b] || b;
    return nameA.localeCompare(nameB, 'zh-CN');
  });
</script>

<div class="my-apps-view">
  <div class="view-header">
    <div class="header-left">
      <h2>我的应用</h2>
      <p class="subtitle">管理已创建的浏览器配置</p>
    </div>
    <div class="header-actions">
      {#if isSelectMode}
        <span class="selection-info">已选择 {selectedConfigIds.size} 项</span>
        <button class="btn btn-secondary" on:click={deselectAll} disabled={selectedConfigIds.size === 0}>取消全选</button>
        <button class="btn btn-secondary" on:click={selectAll}>全选</button>
        <button class="btn btn-primary" on:click={handleBatchRun} disabled={selectedConfigIds.size === 0}>
          批量运行 ({selectedConfigIds.size})
        </button>
        <button class="btn btn-danger" on:click={handleBatchDelete} disabled={selectedConfigIds.size === 0}>
          批量删除 ({selectedConfigIds.size})
        </button>
        <button class="btn btn-secondary" on:click={toggleSelectMode}>取消</button>
      {:else}
        <button class="btn btn-secondary" on:click={toggleSelectMode}>批量选择</button>
      {/if}
    </div>
  </div>

  {#if configs.length === 0}
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/>
        <path d="M24 16V32M16 24H32" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p>还没有创建任何浏览器配置</p>
      <p class="empty-hint">在应用中心创建配置后，它们会显示在这里</p>
    </div>
  {:else}
    <div class="configs-container">
      {#each appOrder as appId (appId)}
        {@const appConfigs = groupedConfigs[appId] || []}
        {#if appConfigs.length > 0}
          <div class="app-section">
            <div class="app-header">
              {#if appIconMap[appId]}
                <img src={appIconMap[appId]} alt="" class="app-icon" />
              {:else}
                <div class="app-icon-placeholder">{(appNameMap[appId] || appId).charAt(0).toUpperCase()}</div>
              {/if}
              <h3 class="app-name">{appNameMap[appId] || appId}</h3>
              <span class="app-count">{appConfigs.length}</span>
            </div>
            <div class="configs-grid">
              {#each appConfigs as config (config.id)}
                <button
                  class="config-card"
                  class:selected={isSelectMode && selectedConfigIds.has(config.id)}
                  on:click={() => handleConfigClick(config)}
                >
                  {#if isSelectMode}
                    <div class="config-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedConfigIds.has(config.id)}
                        on:change={() => toggleSelect(config.id)}
                        on:click|stopPropagation
                      />
                    </div>
                  {/if}
                  <div class="config-icon">{config.name.charAt(0).toUpperCase()}</div>
                  <div class="config-info">
                    <div class="config-name">{config.name}</div>
                    <div class="config-meta">
                      创建于 {new Date(config.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .my-apps-view {
    padding: var(--spacing-2xl);
    height: 100%;
    overflow-y: auto;
  }

  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2xl);
    padding-bottom: var(--spacing-xl);
    border-bottom: 1px solid var(--border-primary);
  }

  .header-left h2 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-tertiary);
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .selection-info {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-right: var(--spacing-sm);
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-md);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--accent-primary);
    color: var(--bg-primary);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--bg-hover);
    color: var(--text-secondary);
    border: 1px solid var(--border-primary);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-active);
    color: var(--text-primary);
  }

  .btn-danger {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-error);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .btn-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    color: var(--text-muted);
    gap: var(--spacing-md);
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-base);
  }

  .empty-hint {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .configs-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2xl);
  }

  .app-section {
    margin-bottom: var(--spacing-lg);
  }

  .app-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border-secondary);
  }

  .app-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
    border-radius: var(--radius-sm);
  }

  .app-icon-placeholder {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-bg);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--accent-primary);
  }

  .app-name {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .app-count {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin-left: auto;
  }

  .configs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--spacing-md);
  }

  .config-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
  }

  .config-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .config-card.selected {
    background: var(--accent-bg);
    border-color: var(--accent-primary);
  }

  .config-checkbox {
    flex-shrink: 0;
  }

  .config-checkbox input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .config-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--accent-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--accent-primary);
    flex-shrink: 0;
  }

  .config-info {
    flex: 1;
    min-width: 0;
  }

  .config-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .config-meta {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
</style>
