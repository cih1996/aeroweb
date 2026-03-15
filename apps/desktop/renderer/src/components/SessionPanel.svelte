<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Session {
    id: string;
    name: string;
    url: string;
    icon?: string;
    color?: string;
    partition: string;
    lastUsedAt: number;
    isRunning?: boolean;
  }

  export let sessions: Session[] = [];
  export let show = false;

  const dispatch = createEventDispatcher();

  let showCreateForm = false;
  let newName = '';
  let newUrl = 'https://';

  // 监听 show 变化，控制 BrowserView 显示/隐藏
  $: if (typeof window !== 'undefined' && window.electronAPI) {
    if (show) {
      window.electronAPI.view.temporarilyHide();
    } else {
      window.electronAPI.view.restoreHidden();
    }
  }

  function handleOpen(session: Session) {
    dispatch('open', { session });
  }

  function handleCreate() {
    if (!newName.trim() || !newUrl.trim()) return;

    dispatch('create', {
      name: newName.trim(),
      url: newUrl.trim(),
    });

    // 重置表单
    newName = '';
    newUrl = 'https://';
    showCreateForm = false;
  }

  function handleDelete(session: Session, event: MouseEvent) {
    event.stopPropagation();
    if (confirm(`确定要删除 "${session.name}" 吗？\n注意：这会清除该会话的所有缓存数据（包括登录状态）`)) {
      dispatch('delete', { sessionId: session.id });
    }
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (date.toDateString() === now.toDateString()) return '今天';

    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function getSessionIcon(session: Session): string {
    return session.name.charAt(0).toUpperCase();
  }

  function close() {
    dispatch('close');
  }
</script>

{#if show}
  <div class="overlay" on:click={close} on:keydown={(e) => e.key === 'Escape' && close()} role="dialog" tabindex="-1">
    <div class="panel" on:click|stopPropagation on:keydown|stopPropagation role="document">
      <div class="panel-header">
        <h2>选择会话</h2>
        <p class="subtitle">每个会话有独立的缓存，可以登录不同账号</p>
      </div>

      <div class="panel-content">
        <!-- 已保存的会话 -->
        {#if sessions.length > 0}
          <div class="sessions-grid">
            {#each sessions as session (session.id)}
              <button
                class="session-card"
                class:running={session.isRunning}
                on:click={() => handleOpen(session)}
              >
                <div class="session-icon" style="background: {session.color || 'var(--accent-bg)'}">
                  {getSessionIcon(session)}
                </div>
                <div class="session-info">
                  <div class="session-name">{session.name}</div>
                  <div class="session-meta">
                    {#if session.isRunning}
                      <span class="running-badge">运行中</span>
                    {:else}
                      <span class="last-used">{formatTime(session.lastUsedAt)}</span>
                    {/if}
                  </div>
                </div>
                <button
                  class="delete-btn"
                  on:click={(e) => handleDelete(session, e)}
                  title="删除会话"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 4H11M5 4V3C5 2.5 5.5 2 6 2H8C8.5 2 9 2.5 9 3V4M6 6V10M8 6V10M4 4L4.5 11C4.5 11.5 5 12 5.5 12H8.5C9 12 9.5 11.5 9.5 11L10 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </button>
            {/each}
          </div>
        {/if}

        <!-- 创建新会话 -->
        {#if showCreateForm}
          <div class="create-form">
            <div class="form-group">
              <label for="session-name">会话名称</label>
              <input
                id="session-name"
                type="text"
                bind:value={newName}
                placeholder="例如：B站-主号"
                maxlength="20"
              />
            </div>
            <div class="form-group">
              <label for="session-url">默认网址</label>
              <input
                id="session-url"
                type="url"
                bind:value={newUrl}
                placeholder="https://www.bilibili.com"
              />
            </div>
            <div class="form-actions">
              <button class="btn-secondary" on:click={() => showCreateForm = false}>取消</button>
              <button class="btn-primary" on:click={handleCreate}>创建</button>
            </div>
          </div>
        {:else}
          <button class="create-btn" on:click={() => showCreateForm = true}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>创建新会话</span>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .panel {
    background: var(--bg-elevated);
    border: 1px solid var(--border-primary);
    border-radius: 16px;
    width: 90%;
    max-width: 480px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  .panel-header {
    padding: 24px 24px 16px;
    border-bottom: 1px solid var(--border-secondary);
  }

  .panel-header h2 {
    margin: 0 0 4px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0;
    font-size: 13px;
    color: var(--text-tertiary);
  }

  .panel-content {
    padding: 16px 24px 24px;
    overflow-y: auto;
    max-height: calc(80vh - 100px);
  }

  .sessions-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .session-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .session-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .session-card.running {
    border-color: var(--accent-primary);
  }

  .session-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    flex-shrink: 0;
  }

  .session-info {
    flex: 1;
    min-width: 0;
  }

  .session-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .session-meta {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .running-badge {
    color: var(--accent-primary);
    font-weight: 500;
  }

  .delete-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-muted);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
  }

  .session-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--color-error);
  }

  .create-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 16px;
    background: var(--accent-bg);
    border: 2px dashed var(--border-secondary);
    border-radius: 10px;
    color: var(--accent-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .create-btn:hover {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: var(--bg-primary);
  }

  .create-form {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-secondary);
    border-radius: 10px;
    padding: 16px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .form-group label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .form-group input {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .form-group input:focus {
    border-color: var(--accent-primary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .btn-primary, .btn-secondary {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--accent-primary);
    border: none;
    color: var(--bg-primary);
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-primary);
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }
</style>
