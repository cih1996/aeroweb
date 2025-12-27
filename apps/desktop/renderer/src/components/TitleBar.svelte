<script lang="ts">
  import MinimizeIcon from './icons/MinimizeIcon.svelte';
  import MaximizeIcon from './icons/MaximizeIcon.svelte';
  import CloseIcon from './icons/CloseIcon.svelte';
  import RestoreIcon from './icons/RestoreIcon.svelte';
  import { onMount } from 'svelte';

  let isMaximized = false;
  let isMac = false;

  onMount(() => {
    // 检测是否为 Mac 系统
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
</script>

<div class="title-bar" data-tauri-drag-region class:mac={isMac}>
  <div class="title-bar-left">
    <img src="./logo.svg" alt="奇易聚合浏览AI+" class="title-bar-logo" />
    <div class="app-name">奇易聚合浏览AI+</div>
  </div>
  
  {#if !isMac}
    <div class="title-bar-right">
      <button class="title-bar-button" on:click={handleMinimize} title="最小化">
        <MinimizeIcon />
      </button>
      <button class="title-bar-button" on:click={handleMaximize} title={isMaximized ? '还原' : '最大化'}>
        {#if isMaximized}
          <RestoreIcon />
        {:else}
          <MaximizeIcon />
        {/if}
      </button>
      <button class="title-bar-button close" on:click={handleClose} title="关闭">
        <CloseIcon />
      </button>
    </div>
  {/if}
</div>

<style>
  .title-bar {
    height: 40px;
    background: linear-gradient(180deg, rgba(10, 14, 39, 0.95) 0%, rgba(26, 31, 58, 0.95) 100%);
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    -webkit-app-region: drag;
    user-select: none;
    position: relative;
    z-index: 1000;
  }

  .title-bar.mac {
    justify-content: center;
  }

  .title-bar-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-bar.mac .title-bar-left {
    justify-content: center;
    width: 100%;
  }

  .title-bar-logo {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .app-name {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .title-bar-right {
    display: flex;
    align-items: center;
    gap: 2px;
    -webkit-app-region: no-drag;
  }

  .title-bar-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s;
    padding: 0;
  }

  .title-bar-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .title-bar-button.close:hover {
    background: #e81123;
    color: white;
  }


</style>

