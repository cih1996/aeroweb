<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAllAppsAsync, saveAppAsync, deleteAppAsync, refreshAppsCache, readImageAsBase64, saveAppIconToCache } from '../utils/app-storage';
  import type { AppConfig } from '../types/app-config';

  const dispatch = createEventDispatcher();

  let favoriteApps: AppConfig[] = [];
  let normalApps: AppConfig[] = [];
  let loading = true;
  let showModal = false;
  let editingApp: AppConfig | null = null;

  // 表单数据
  let formData = {
    id: '',
    name: '',
    url: '',
    icon: '',
    color: '#4facfe',
  };
  let iconFile: File | null = null;
  let draggedApp: AppConfig | null = null;
  let draggedFromFavorite = false;

  onMount(async () => {
    await loadApps();
    loading = false;

    // 监听来自主进程的刷新事件
    if (window.electronAPI?.onAppsUpdated) {
      window.electronAPI.onAppsUpdated(() => {
        console.log('[AppGrid] 收到应用更新通知，刷新列表');
        loadApps();
      });
    }
  });

  async function loadApps() {
    const allApps = await getAllAppsAsync();
    favoriteApps = allApps.filter(app => app.isFavorite);
    normalApps = allApps.filter(app => !app.isFavorite);
  }

  // 刷新应用列表（供外部调用）
  export async function refreshApps() {
    await loadApps();
  }

  function handleAppClick(appId: string) {
    dispatch('appClick', { appId });
  }

  function openCreateModal() {
    editingApp = null;
    formData = {
      id: `app_${Date.now()}`,
      name: '',
      url: '',
      icon: '',
      color: '#4facfe',
    };
    iconFile = null;
    showModal = true;
  }

  function openEditModal(app: AppConfig) {
    editingApp = app;
    formData = {
      id: app.id,
      name: app.name,
      url: app.url,
      icon: app.icon,
      color: app.color || '#4facfe',
    };
    iconFile = null;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingApp = null;
    formData = {
      id: '',
      name: '',
      url: '',
      icon: '',
      color: '#4facfe',
    };
    iconFile = null;
  }

  async function handleIconChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      iconFile = target.files[0];
      // 预览图标
      formData.icon = await readImageAsBase64(iconFile);
    }
  }

  async function handleSaveApp() {
    if (!formData.name || !formData.url) {
      alert('请填写应用名称和网址');
      return;
    }

    try {
      // 如果有新的图标（base64 数据），先保存到本地缓存
      let iconPath = formData.icon || './apps/icons/x.svg';
      if (formData.icon && formData.icon.startsWith('data:image/')) {
        iconPath = await saveAppIconToCache(formData.id, formData.icon);
      }

      const appToSave: AppConfig = {
        id: formData.id,
        name: formData.name,
        url: formData.url,
        icon: iconPath, // 使用缓存后的路径
        color: formData.color,
        isFavorite: editingApp?.isFavorite || false,
        order: editingApp?.order || 0,
        createdAt: editingApp?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await saveAppAsync(appToSave);
      await loadApps();
      closeModal();
    } catch (error) {
      console.error('保存应用失败:', error);
      alert('保存失败，请重试');
    }
  }

  async function handleDeleteApp(app: AppConfig, event: Event) {
    event.stopPropagation();
    if (confirm(`确定要删除应用 "${app.name}" 吗？`)) {
      try {
        await deleteAppAsync(app.id);
        await loadApps();
      } catch (error) {
        console.error('删除应用失败:', error);
        alert('删除失败，请重试');
      }
    }
  }

  async function handleToggleFavorite(app: AppConfig, event: Event) {
    event.stopPropagation();
    try {
      // 切换收藏状态
      const updatedApp = { ...app, isFavorite: !app.isFavorite, updatedAt: Date.now() };
      await saveAppAsync(updatedApp);
      await loadApps();
    } catch (error) {
      console.error('切换收藏失败:', error);
    }
  }

  // 拖拽开始
  function handleDragStart(app: AppConfig, isFavorite: boolean) {
    draggedApp = app;
    draggedFromFavorite = isFavorite;
  }

  // 拖拽结束
  function handleDragEnd() {
    draggedApp = null;
    draggedFromFavorite = false;
  }

  // 拖拽悬停
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  // 放置
  async function handleDrop(targetApp: AppConfig, targetIsFavorite: boolean, event: DragEvent) {
    event.preventDefault();

    if (!draggedApp || draggedApp.id === targetApp.id) {
      return;
    }

    // 获取要操作的列表
    const sourceList = draggedFromFavorite ? [...favoriteApps] : [...normalApps];
    const targetList = targetIsFavorite ? [...favoriteApps] : [...normalApps];

    // 如果在同一列表内移动
    if (draggedFromFavorite === targetIsFavorite) {
      const draggedIndex = sourceList.findIndex(a => a.id === draggedApp!.id);
      const targetIndex = sourceList.findIndex(a => a.id === targetApp.id);

      if (draggedIndex >= 0 && targetIndex >= 0) {
        // 交换位置
        sourceList.splice(draggedIndex, 1);
        sourceList.splice(targetIndex, 0, draggedApp!);

        // 更新所有应用的顺序
        const allApps = targetIsFavorite ? [...sourceList, ...normalApps] : [...favoriteApps, ...sourceList];
        // 重新分配 order 并保存每个应用
        for (let i = 0; i < allApps.length; i++) {
          const app = { ...allApps[i], order: i, updatedAt: Date.now() };
          await saveAppAsync(app);
        }
        await loadApps();
      }
    }
  }
</script>

<div class="app-grid-container">
  <div class="header">
    <h2>应用中心</h2>
    <div class="header-actions">
      <button class="btn-refresh" on:click={refreshApps} title="刷新应用列表">
        <span class="icon">↻</span>
      </button>
      <button class="btn-add" on:click={openCreateModal}>
        <span class="icon">+</span>
        添加应用
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载应用中...</p>
    </div>
  {:else}
    <!-- 收藏应用区域 -->
    {#if favoriteApps.length > 0}
      <div class="section">
        <div class="section-header">
          <span class="icon-star">⭐</span>
          <h3>收藏应用</h3>
          <span class="count">({favoriteApps.length})</span>
        </div>
        <div class="app-grid">
          {#each favoriteApps as app (app.id)}
            <div
              class="app-card"
              style="--app-color: {app.color || '#4facfe'}"
              draggable="true"
              role="button"
              tabindex="0"
              on:dragstart={() => handleDragStart(app, true)}
              on:dragend={handleDragEnd}
              on:dragover={handleDragOver}
              on:drop={(e) => handleDrop(app, true, e)}
            >
              <button
                class="app-main"
                on:click={() => handleAppClick(app.id)}
              >
                <div class="app-icon-wrapper">
                  <img 
                    src={app.icon} 
                    alt={app.name}
                    class="app-icon"
                    on:error={(e) => {
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
              </button>
              <div class="app-actions">
                <button
                  class="action-btn favorite active"
                  on:click={(e) => handleToggleFavorite(app, e)}
                  title="取消收藏"
                >
                  ★
                </button>
                <button
                  class="action-btn edit"
                  on:click={(e) => { e.stopPropagation(); openEditModal(app); }}
                  title="编辑"
                >
                  ✎
                </button>
                <button
                  class="action-btn delete"
                  on:click={(e) => handleDeleteApp(app, e)}
                  title="删除"
                >
                  ×
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- 所有应用区域 -->
    <div class="section">
      <div class="section-header">
        <h3>所有应用</h3>
        <span class="count">({normalApps.length})</span>
      </div>
      {#if normalApps.length === 0 && favoriteApps.length === 0}
        <div class="empty-state">
          <p>还没有添加任何应用</p>
          <p class="hint">点击上方"添加应用"按钮创建第一个应用</p>
        </div>
      {:else if normalApps.length === 0}
        <div class="empty-state">
          <p>所有应用都已被收藏</p>
        </div>
      {:else}
        <div class="app-grid">
          {#each normalApps as app (app.id)}
            <div
              class="app-card"
              style="--app-color: {app.color || '#4facfe'}"
              draggable="true"
              role="button"
              tabindex="0"
              on:dragstart={() => handleDragStart(app, false)}
              on:dragend={handleDragEnd}
              on:dragover={handleDragOver}
              on:drop={(e) => handleDrop(app, false, e)}
            >
              <button
                class="app-main"
                on:click={() => handleAppClick(app.id)}
              >
                <div class="app-icon-wrapper">
                  <img 
                    src={app.icon} 
                    alt={app.name}
                    class="app-icon"
                    on:error={(e) => {
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
              </button>
              <div class="app-actions">
                <button
                  class="action-btn favorite"
                  on:click={(e) => handleToggleFavorite(app, e)}
                  title="收藏"
                >
                  ☆
                </button>
                <button
                  class="action-btn edit"
                  on:click={(e) => { e.stopPropagation(); openEditModal(app); }}
                  title="编辑"
                >
                  ✎
                </button>
                <button
                  class="action-btn delete"
                  on:click={(e) => handleDeleteApp(app, e)}
                  title="删除"
                >
                  ×
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- 创建/编辑应用模态框 -->
{#if showModal}
  <div class="modal-overlay" role="dialog" aria-modal="true" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="modal-content" role="document" on:click={(e) => e.stopPropagation()} on:keydown={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3>{editingApp ? '编辑应用' : '添加应用'}</h3>
        <button class="modal-close" on:click={closeModal}>×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="app-name">应用名称 *</label>
          <input
            id="app-name"
            type="text"
            bind:value={formData.name}
            placeholder="例如：Google"
            maxlength="20"
          />
        </div>
        <div class="form-group">
          <label for="app-url">网址 *</label>
          <input
            id="app-url"
            type="url"
            bind:value={formData.url}
            placeholder="https://example.com"
          />
        </div>
        <div class="form-group">
          <label for="app-icon">应用图标</label>
          <div class="icon-preview">
            {#if formData.icon}
              <img src={formData.icon} alt="图标预览" class="preview-img" />
            {:else}
              <div class="preview-placeholder">
                {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
              </div>
            {/if}
          </div>
          <input
            id="app-icon"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/x-icon"
            on:change={handleIconChange}
          />
          <p class="hint">支持 PNG、SVG、ICO 格式，建议尺寸 64x64</p>
        </div>
        <div class="form-group">
          <label for="app-color">主题色</label>
          <input
            id="app-color"
            type="color"
            bind:value={formData.color}
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModal}>取消</button>
        <button class="btn-primary" on:click={handleSaveApp}>
          {editingApp ? '保存' : '创建'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .app-grid-container {
    padding: var(--spacing-2xl);
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-2xl);
    padding-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--border-primary);
  }

  .header h2 {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .btn-refresh {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    font-size: var(--font-size-xl);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-refresh:hover {
    background: var(--accent-bg-hover);
    border-color: var(--border-hover);
    transform: rotate(180deg);
  }

  .btn-refresh:active {
    transform: rotate(360deg);
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-xl);
    background: var(--accent-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-add:hover {
    background: var(--accent-bg-hover);
    border-color: var(--border-hover);
  }

  .btn-add .icon {
    font-size: var(--font-size-xl);
    font-weight: 300;
  }

  .section {
    margin-bottom: var(--spacing-2xl);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
  }

  .section-header .icon-star {
    font-size: var(--font-size-xl);
  }

  .section-header h3 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .section-header .count {
    font-size: var(--font-size-base);
    color: var(--text-tertiary);
  }

  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--spacing-xl);
  }

  .app-card {
    position: relative;
    background: var(--bg-hover);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-xl);
    overflow: hidden;
    transition: all var(--transition-fast);
    cursor: move;
  }

  .app-card:hover {
    transform: translateY(-4px);
    border-color: var(--border-hover);
    box-shadow: var(--shadow-md);
  }

  .app-card:hover .app-actions {
    opacity: 1;
  }

  .app-main {
    width: 100%;
    background: transparent;
    border: none;
    padding: var(--spacing-xl);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
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
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .app-icon-placeholder {
    width: 48px;
    height: 48px;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
    background: var(--accent-bg);
    border-radius: var(--radius-lg);
  }

  .app-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    text-align: center;
  }

  .app-actions {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    display: flex;
    gap: var(--spacing-xs);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }

  .action-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: none;
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    transform: scale(1.1);
    color: var(--text-primary);
  }

  .action-btn.favorite {
    color: var(--color-warning);
  }

  .action-btn.favorite.active {
    color: var(--color-warning);
    background: rgba(245, 158, 11, 0.2);
  }

  .action-btn.edit:hover {
    background: var(--color-info);
    color: white;
  }

  .action-btn.delete:hover {
    background: var(--color-error);
    color: white;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px var(--spacing-xl);
    color: var(--text-tertiary);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-primary);
    border-top-color: var(--text-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--spacing-lg);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state .hint {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin-top: var(--spacing-sm);
  }

  /* 模态框样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--bg-elevated);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-xl);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-lg);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xl);
    border-bottom: 1px solid var(--border-primary);
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .modal-close {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    border: none;
    background: var(--bg-hover);
    color: var(--text-secondary);
    font-size: var(--font-size-2xl);
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    background: var(--color-error);
    color: white;
  }

  .modal-body {
    padding: var(--spacing-xl);
  }

  .form-group {
    margin-bottom: var(--spacing-xl);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }

  .form-group input[type="text"],
  .form-group input[type="url"] {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: var(--font-size-base);
    transition: all var(--transition-fast);
  }

  .form-group input[type="text"]:focus,
  .form-group input[type="url"]:focus {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px var(--accent-bg);
  }

  .form-group input[type="file"] {
    width: 100%;
    padding: var(--spacing-sm);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    cursor: pointer;
  }

  .form-group input[type="color"] {
    width: 80px;
    height: 40px;
    padding: var(--spacing-xs);
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .icon-preview {
    width: 64px;
    height: 64px;
    margin-bottom: var(--spacing-md);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
  }

  .preview-img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .preview-placeholder {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-tertiary);
  }

  .hint {
    margin: var(--spacing-sm) 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    padding: var(--spacing-xl);
    border-top: 1px solid var(--border-primary);
  }

  .btn-primary,
  .btn-secondary {
    padding: var(--spacing-md) var(--spacing-xl);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--accent-primary);
    color: var(--bg-primary);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--bg-hover);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-active);
  }
</style>
