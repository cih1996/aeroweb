<script lang="ts">
  import { getPanelsForApp } from '../utils/panel-registry';
  import type { PanelConfig } from '../types/panel';
  import { createEventDispatcher, onMount } from 'svelte';

  export let appId: string = '';
  export let tabId: string | null = null;
  export let visible: boolean = true;
  export let width: number = 400; // 面板宽度，默认 400px

  const dispatch = createEventDispatcher();

  let panels: PanelConfig[] = [];
  let activePanelId: string | null = null;
  let isDragging = false;
  let startX = 0;
  let startWidth = 0;
  let panelElement: HTMLDivElement;

  const MIN_WIDTH = 200;
  const MAX_WIDTH = 800;

  $: if (appId) {
    panels = getPanelsForApp(appId);
    // 默认激活第一个面板
    if (panels.length > 0 && !activePanelId) {
      activePanelId = panels[0].id;
    }
  }

  function switchPanel(panelId: string) {
    activePanelId = panelId;
  }

  function handleMouseDown(event: MouseEvent) {
    isDragging = true;
    startX = event.clientX;
    startWidth = width;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    event.preventDefault();
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging) return;
    
    const deltaX = startX - event.clientX; // 从右往左拖拽，deltaX 为正
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + deltaX));
    
    if (newWidth !== width) {
      width = newWidth;
      dispatch('widthChange', { width });
    }
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  onMount(() => {
    return () => {
      // 清理事件监听
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  });
</script>

{#if visible && panels.length > 0}
  <div 
    class="right-panel" 
    class:dragging={isDragging}
    style="width: {width}px;"
    bind:this={panelElement}
  >
    <!-- 拖拽分隔条 -->
    <div 
      class="resizer"
      role="separator"
      aria-label="调整面板宽度"
      aria-orientation="vertical"
      on:mousedown={handleMouseDown}
      title="拖拽调整面板宽度"
    >
      <div class="resizer-handle"></div>
    </div>

    <!-- Tab 切换栏 - 始终显示，即使只有一个面板 -->
    <div class="panel-tabs">
      {#each panels as panel (panel.id)}
        <button
          class="panel-tab {activePanelId === panel.id ? 'active' : ''}"
          on:click={() => switchPanel(panel.id)}
        >
          {panel.name}
        </button>
      {/each}
    </div>

    <div class="panel-content">
      {#each panels as panel (panel.id)}
        <div 
          class="panel-wrapper"
          class:active={activePanelId === panel.id}
        >
          <svelte:component this={panel.component} {tabId} {appId} />
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .right-panel {
    display: flex;
    flex-direction: column;
    background: rgba(26, 31, 58, 0.95);
    border-left: 1px solid rgba(79, 172, 254, 0.2);
    height: 100%;
    overflow: hidden;
    position: relative;
    z-index: 100;
    user-select: none;
  }

  .right-panel.dragging {
    user-select: none;
  }

  .right-panel.dragging * {
    cursor: col-resize !important;
  }

  .resizer {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .resizer:hover {
    background: rgba(79, 172, 254, 0.2);
  }

  .resizer:hover .resizer-handle {
    opacity: 1;
  }

  .right-panel.dragging .resizer {
    background: rgba(79, 172, 254, 0.3);
  }

  .resizer-handle {
    width: 2px;
    height: 40px;
    background: rgba(79, 172, 254, 0.5);
    border-radius: 1px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .right-panel.dragging .resizer-handle {
    opacity: 1;
    background: rgba(79, 172, 254, 0.8);
  }

  .panel-tabs {
    display: flex;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    background: rgba(10, 14, 39, 0.5);
  }

  .panel-tab {
    flex: 1;
    padding: 10px 16px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .panel-tab:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(79, 172, 254, 0.05);
  }

  .panel-tab.active {
    color: #4facfe;
    border-bottom-color: #4facfe;
    background: rgba(79, 172, 254, 0.05);
  }

  .panel-content {
    flex: 1 1 0; /* flex-grow: 1, flex-shrink: 1, flex-basis: 0 */
    min-height: 0; /* 重要：允许 flex 子元素缩小 */
    max-height: 100%; /* 限制最大高度 */
    overflow: hidden; /* 限制高度，让子组件自己处理滚动 */
    position: relative;
    display: flex; /* 让子组件可以正确计算高度 */
    flex-direction: column;
  }

  .panel-wrapper {
    display: none; /* 默认隐藏 */
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .panel-wrapper.active {
    display: flex; /* 活动面板显示 */
    flex-direction: column;
  }
</style>

