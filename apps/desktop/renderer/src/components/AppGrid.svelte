<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAppsByCategory, getCategories, getAppIconUrl, getCategoryIconUrl } from '../utils/app-config';
  import type { AppConfig, CategoryConfig } from '../types/app-config';

  const dispatch = createEventDispatcher();

  let categories: CategoryConfig[] = [];
  let appsByCategory: Record<string, AppConfig[]> = {};
  let loading = true;

  onMount(async () => {
    try {
      categories = await getCategories();
      appsByCategory = await getAppsByCategory();
    } catch (error) {
      console.error('Failed to load apps:', error);
    } finally {
      loading = false;
    }
  });

  function handleAppClick(appId: string) {
    dispatch('appClick', { appId });
  }

  function getIconUrl(iconFileName: string): string {
    return getAppIconUrl(iconFileName);
  }

  function getCatIconUrl(iconFileName?: string): string | null {
    return iconFileName ? getCategoryIconUrl(iconFileName) : null;
  }

  // 获取分类顺序（按配置顺序）
  $: categoryOrder = categories.map(cat => cat.id);
  
  // 如果有未分类的应用，添加到末尾
  $: if (appsByCategory['uncategorized'] && appsByCategory['uncategorized'].length > 0) {
    if (!categoryOrder.includes('uncategorized')) {
      categoryOrder.push('uncategorized');
    }
  }
</script>

<div class="app-grid-container">
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载应用中...</p>
    </div>
  {:else if categoryOrder.length === 0}
    <div class="empty-state">
      <p>暂无可用应用</p>
    </div>
  {:else}
    {#each categoryOrder as categoryId (categoryId)}
      {@const category = categories.find(c => c.id === categoryId)}
      {@const apps = appsByCategory[categoryId] || []}
      {#if apps.length > 0}
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
            <h2 class="category-name">{category?.name || '未分类'}</h2>
            <span class="category-count">({apps.length})</span>
          </div>
          <div class="app-grid">
            {#each apps as app (app.id)}
              <button 
                class="app-card"
                on:click={() => handleAppClick(app.id)}
                style="--app-color: {app.color || '#4facfe'}"
              >
                <div class="app-icon-wrapper">
                  <img 
                    src={getIconUrl(app.icon)} 
                    alt={app.name}
                    class="app-icon"
                    on:error={(e) => {
                      // 如果图标加载失败，显示占位符
                      const target = e.currentTarget;
                      if (target instanceof HTMLImageElement) {
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling;
                        if (placeholder instanceof HTMLElement) {
                          placeholder.style.display = 'flex';
                        }
                      }
                    }}
                  />
                  <div class="app-icon-placeholder">
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div class="app-name">{app.name}</div>
                <div class="app-hover-effect"></div>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .app-grid-container {
    padding: 32px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .category-section {
    margin-bottom: 48px;
  }

  .category-section:last-child {
    margin-bottom: 0;
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

  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 20px;
  }

  .app-card {
    position: relative;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(79, 172, 254, 0.1);
    border-radius: 16px;
    padding: 24px;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    min-height: 140px;
  }

  .app-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.1) 100%);
    opacity: 0;
    transition: opacity 0.4s;
  }

  .app-card:hover::before {
    opacity: 1;
  }

  .app-card:hover {
    transform: translateY(-4px);
    border-color: rgba(79, 172, 254, 0.4);
    box-shadow: 0 8px 32px rgba(79, 172, 254, 0.2);
  }

  .app-icon-wrapper {
    position: relative;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .app-icon {
    width: 40px;
    height: 40px;
    position: relative;
    z-index: 2;
    object-fit: contain;
  }

  .app-icon-placeholder {
    width: 40px;
    height: 40px;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    background: rgba(79, 172, 254, 0.2);
    border-radius: 8px;
  }

  .loading-state,
  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.5);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(79, 172, 254, 0.2);
    border-top-color: #4facfe;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .app-name {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    position: relative;
    z-index: 2;
  }

  .app-hover-effect {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 0;
    height: 0;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(79, 172, 254, 0.3) 0%, transparent 70%);
    transition: width 0.6s, height 0.6s;
  }

  .app-card:hover .app-hover-effect {
    width: 200px;
    height: 200px;
  }
</style>

