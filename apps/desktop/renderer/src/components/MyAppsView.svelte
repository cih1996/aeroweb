<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAllConfigs, deleteConfigs } from '../utils/browser-config-storage';
  import { getAppsByCategory, getCategories, getAppIconUrl, getCategoryIconUrl, getAppById } from '../utils/app-config';
  import type { BrowserConfig } from '../types/browser-config';
  import type { AppConfig, CategoryConfig } from '../types/app-config';

  const dispatch = createEventDispatcher();

  export let configs: BrowserConfig[] = [];

  let categories: CategoryConfig[] = [];
  let apps: AppConfig[] = [];
  let selectedConfigIds: Set<string> = new Set();
  let isSelectMode = false;

  // 应用 ID 到名称的映射
  let appNameMap: Record<string, string> = {};
  let appCategoryMap: Record<string, string> = {}; // appId -> categoryId

  // 按分类和应用分组的配置
  $: groupedConfigs = (() => {
    const grouped: Record<string, Record<string, BrowserConfig[]>> = {};
    
    configs.forEach(config => {
      const categoryId = appCategoryMap[config.appId] || 'uncategorized';
      if (!grouped[categoryId]) {
        grouped[categoryId] = {};
      }
      if (!grouped[categoryId][config.appId]) {
        grouped[categoryId][config.appId] = [];
      }
      grouped[categoryId][config.appId].push(config);
    });

    // 按最后使用时间排序
    Object.keys(grouped).forEach(categoryId => {
      Object.keys(grouped[categoryId]).forEach(appId => {
        grouped[categoryId][appId].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
      });
    });

    return grouped;
  })();

  onMount(async () => {
    categories = await getCategories();
    apps = await (await import('../utils/app-config')).getApps();
    
    // 构建应用名称映射和分类映射
    const newAppNameMap: Record<string, string> = {};
    const newAppCategoryMap: Record<string, string> = {};
    
    for (const app of apps) {
      newAppNameMap[app.id] = app.name;
      newAppCategoryMap[app.id] = app.category || 'uncategorized';
    }
    
    appNameMap = newAppNameMap;
    appCategoryMap = newAppCategoryMap;
  });

  function toggleSelectMode() {
    isSelectMode = !isSelectMode;
    if (!isSelectMode) {
      selectedConfigIds.clear();
    }
  }

  function toggleSelect(configId: string) {
    if (selectedConfigIds.has(configId)) {
      selectedConfigIds.delete(configId);
    } else {
      selectedConfigIds.add(configId);
    }
    selectedConfigIds = selectedConfigIds; // 触发响应式更新
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
    // 运行后退出选择模式
    isSelectMode = false;
    selectedConfigIds.clear();
  }

  function handleBatchDelete() {
    if (selectedConfigIds.size === 0) return;
    
    if (confirm(`确定要删除选中的 ${selectedConfigIds.size} 个配置吗？此操作不可恢复。`)) {
      deleteConfigs(Array.from(selectedConfigIds));
      dispatch('configsDeleted', { configIds: Array.from(selectedConfigIds) });
      selectedConfigIds.clear();
      isSelectMode = false;
    }
  }

  function getIconUrl(iconFileName: string): string {
    return getAppIconUrl(iconFileName);
  }

  function getCatIconUrl(iconFileName?: string): string | null {
    return iconFileName ? getCategoryIconUrl(iconFileName) : null;
  }

  // 获取分类顺序
  $: categoryOrder = categories.map(cat => cat.id);
  $: if (Object.keys(groupedConfigs).some(catId => catId === 'uncategorized')) {
    if (!categoryOrder.includes('uncategorized')) {
      categoryOrder = [...categoryOrder, 'uncategorized'];
    }
  }
</script>

<div class="my-apps-view">
  <div class="view-header">
    <div class="header-left">
      <h2>我的应用</h2>
      <p class="subtitle">管理已创建的浏览器配置</p>
    </div>
    <div class="header-actions">
      {#if isSelectMode}
        <div class="selection-info">
          <span>已选择 {selectedConfigIds.size} 项</span>
        </div>
        <button class="btn-secondary" on:click={deselectAll} disabled={selectedConfigIds.size === 0}>
          取消全选
        </button>
        <button class="btn-secondary" on:click={selectAll}>
          全选
        </button>
        <button class="btn-primary" on:click={handleBatchRun} disabled={selectedConfigIds.size === 0}>
          批量运行 ({selectedConfigIds.size})
        </button>
        <button class="btn-danger" on:click={handleBatchDelete} disabled={selectedConfigIds.size === 0}>
          批量删除 ({selectedConfigIds.size})
        </button>
        <button class="btn-secondary" on:click={toggleSelectMode}>
          取消
        </button>
      {:else}
        <button class="btn-secondary" on:click={toggleSelectMode}>
          批量选择
        </button>
      {/if}
    </div>
  </div>

  {#if configs.length === 0}
    <div class="empty-state">
      <p>还没有创建任何浏览器配置</p>
      <p class="empty-hint">在应用中心创建配置后，它们会显示在这里</p>
    </div>
  {:else}
    <div class="configs-container">
      {#each categoryOrder as categoryId (categoryId)}
        {@const category = categories.find(c => c.id === categoryId)}
        {@const categoryConfigs = groupedConfigs[categoryId] || {}}
        {#if Object.keys(categoryConfigs).length > 0}
          <div class="category-section">
            <div class="category-header">
              {#if category}
                {#if category.icon}
                  {@const iconUrl = getCatIconUrl(category.icon)}
                  {#if iconUrl}
                    <img 
                      src={iconUrl} 
                      alt={category.name}
                      class="category-icon"
                      on:error={(e) => {
                        const target = e.currentTarget;
                        if (target instanceof HTMLImageElement) {
                          target.style.display = 'none';
                        }
                      }}
                    />
                  {:else}
                    <div class="category-icon-placeholder" style="background: {category.color || '#4facfe'}20; color: {category.color || '#4facfe'}">
                      {category.name.charAt(0)}
                    </div>
                  {/if}
                {:else}
                  <div class="category-icon-placeholder" style="background: {category.color || '#4facfe'}20; color: {category.color || '#4facfe'}">
                    {category.name.charAt(0)}
                  </div>
                {/if}
              {/if}
              <h3 class="category-name">{category?.name || '未分类'}</h3>
              <span class="category-count">({Object.values(categoryConfigs).reduce((sum, apps) => sum + apps.length, 0)})</span>
            </div>

            {#each Object.entries(categoryConfigs) as [appId, appConfigs] (appId)}
              <div class="app-group">
                <div class="app-group-header">
                  {#if appNameMap[appId]}
                    {@const app = apps.find(a => a.id === appId)}
                    {#if app?.icon}
                      <img 
                        src={getIconUrl(app.icon)} 
                        alt={appNameMap[appId]}
                        class="app-group-icon"
                        on:error={(e) => {
                          const target = e.currentTarget;
                          if (target instanceof HTMLImageElement) {
                            target.style.display = 'none';
                          }
                        }}
                      />
                    {/if}
                    <h4 class="app-group-name">{appNameMap[appId]}</h4>
                  {:else}
                    <h4 class="app-group-name">{appId}</h4>
                  {/if}
                  <span class="app-group-count">({appConfigs.length})</span>
                </div>
                <div class="configs-grid">
                  {#each appConfigs as config (config.id)}
                    <div 
                      class="config-card {isSelectMode && selectedConfigIds.has(config.id) ? 'selected' : ''}"
                      role="button"
                      tabindex="0"
                      on:click={() => handleConfigClick(config)}
                      on:keydown={(e) => e.key === 'Enter' && handleConfigClick(config)}
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
                      <div class="config-icon">
                        {config.name.charAt(0).toUpperCase()}
                      </div>
                      <div class="config-info">
                        <div class="config-name">{config.name}</div>
                        <div class="config-meta">
                          创建于 {new Date(config.createdAt).toLocaleDateString()}
                        </div>
                        {#if config.lastUsedAt}
                          <div class="config-meta">
                            最后使用 {new Date(config.lastUsedAt).toLocaleDateString()}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .my-apps-view {
    padding: 32px;
    max-width: 1400px;
    height: 100%;
    overflow-y: auto;
  }

  .view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
  }

  .header-left h2 {
    margin: 0 0 8px 0;
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .selection-info {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    margin-right: 8px;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
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

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(79, 172, 254, 0.3);
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(79, 172, 254, 0.5);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-danger {
    background: rgba(255, 59, 48, 0.2);
    color: #ff3b30;
    border: 1px solid rgba(255, 59, 48, 0.3);
  }

  .btn-danger:hover:not(:disabled) {
    background: rgba(255, 59, 48, 0.3);
    border-color: rgba(255, 59, 48, 0.5);
  }

  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: rgba(255, 255, 255, 0.5);
  }

  .empty-state p {
    margin: 8px 0;
    font-size: 16px;
  }

  .empty-hint {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.3);
  }

  .configs-container {
    display: flex;
    flex-direction: column;
    gap: 48px;
  }

  .category-section {
    margin-bottom: 32px;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
  }

  .category-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .category-icon-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
  }

  .category-name {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .category-count {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
    margin-left: auto;
  }

  .app-group {
    margin-bottom: 32px;
  }

  .app-group-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-left: 8px;
  }

  .app-group-icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  .app-group-name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .app-group-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin-left: auto;
  }

  .configs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .config-card {
    position: relative;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(79, 172, 254, 0.1);
    border-radius: 12px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .config-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(79, 172, 254, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 172, 254, 0.2);
  }

  .config-card.selected {
    background: rgba(79, 172, 254, 0.15);
    border-color: rgba(79, 172, 254, 0.5);
    box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.3);
  }

  .config-checkbox {
    flex-shrink: 0;
  }

  .config-checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #4facfe;
  }

  .config-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
  }

  .config-info {
    flex: 1;
    min-width: 0;
  }

  .config-name {
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .config-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    margin-top: 2px;
  }
</style>

