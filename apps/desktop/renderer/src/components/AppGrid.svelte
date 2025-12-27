<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getAllApps, getFavoriteApps, getNonFavoriteApps, saveApp, deleteApp, toggleFavorite, updateAppOrder, readImageAsBase64, saveAppIconToCache } from '../utils/app-storage';
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
  });

  async function loadApps() {
    favoriteApps = getFavoriteApps();
    normalApps = getNonFavoriteApps();
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

      saveApp(appToSave);
      await loadApps();
      closeModal();
    } catch (error) {
      console.error('保存应用失败:', error);
      alert('保存失败，请重试');
    }
  }

  function handleDeleteApp(app: AppConfig, event: Event) {
    event.stopPropagation();
    if (confirm(`确定要删除应用 "${app.name}" 吗？`)) {
      try {
        deleteApp(app.id);
        loadApps();
      } catch (error) {
        console.error('删除应用失败:', error);
        alert('删除失败，请重试');
      }
    }
  }

  function handleToggleFavorite(app: AppConfig, event: Event) {
    event.stopPropagation();
    try {
      toggleFavorite(app.id);
      loadApps();
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
  function handleDrop(targetApp: AppConfig, targetIsFavorite: boolean, event: DragEvent) {
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
        updateAppOrder(allApps);
        loadApps();
      }
    }
  }
</script>

<div class="app-grid-container">
  <div class="header">
    <h2>应用中心</h2>
    <button class="btn-add" on:click={openCreateModal}>
      <span class="icon">+</span>
      添加应用
    </button>
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
    padding: 32px;
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
  }

  .header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .btn-add {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .btn-add:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
  }

  .btn-add .icon {
    font-size: 20px;
    font-weight: 300;
  }

  .section {
    margin-bottom: 48px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .section-header .icon-star {
    font-size: 20px;
  }

  .section-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .section-header .count {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
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
    overflow: hidden;
    transition: all 0.3s;
    cursor: move;
  }

  .app-card:hover {
    transform: translateY(-4px);
    border-color: rgba(79, 172, 254, 0.4);
    box-shadow: 0 8px 32px rgba(79, 172, 254, 0.2);
  }

  .app-card:hover .app-actions {
    opacity: 1;
  }

  .app-main {
    width: 100%;
    background: transparent;
    border: none;
    padding: 24px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
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
    font-size: 24px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    background: rgba(79, 172, 254, 0.2);
    border-radius: 12px;
  }

  .app-name {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
  }

  .app-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
  }

  .action-btn:hover {
    transform: scale(1.1);
  }

  .action-btn.favorite {
    color: #ffd700;
  }

  .action-btn.favorite.active {
    color: #ffd700;
    background: rgba(255, 215, 0, 0.2);
  }

  .action-btn.edit:hover {
    background: rgba(79, 172, 254, 0.6);
  }

  .action-btn.delete:hover {
    background: rgba(255, 59, 48, 0.6);
  }

  .loading-state,
  .empty-state {
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

  .empty-state .hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    margin-top: 8px;
  }

  /* 模态框样式 */
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
    z-index: 2000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: linear-gradient(180deg, rgba(20, 24, 49, 0.98) 0%, rgba(10, 14, 39, 0.98) 100%);
    border: 1px solid rgba(79, 172, 254, 0.3);
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    font-size: 24px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    background: rgba(255, 59, 48, 0.3);
    color: white;
  }

  .modal-body {
    padding: 24px;
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

  .form-group input[type="text"],
  .form-group input[type="url"] {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 14px;
    transition: all 0.2s;
  }

  .form-group input[type="text"]:focus,
  .form-group input[type="url"]:focus {
    outline: none;
    border-color: rgba(79, 172, 254, 0.5);
    background: rgba(255, 255, 255, 0.08);
  }

  .form-group input[type="file"] {
    width: 100%;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    cursor: pointer;
  }

  .form-group input[type="color"] {
    width: 80px;
    height: 40px;
    padding: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
    cursor: pointer;
  }

  .icon-preview {
    width: 64px;
    height: 64px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 12px;
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
    font-size: 24px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.5);
  }

  .hint {
    margin: 8px 0 0 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 24px;
    border-top: 1px solid rgba(79, 172, 254, 0.2);
  }

  .btn-primary,
  .btn-secondary {
    padding: 10px 24px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(79, 172, 254, 0.3);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
  }
</style>
