<script lang="ts">
  export let appName: string = '应用';
</script>

<div class="loading-overlay">
  <div class="loading-content">
    <div class="loading-spinner">
      <svg class="spinner" viewBox="0 0 50 50">
        <circle
          class="spinner-track"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke-width="3"
        />
        <circle
          class="spinner-path"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke-width="3"
        />
      </svg>
    </div>
    <div class="loading-text">
      <h3>正在启动 {appName}</h3>
      <p>请稍候</p>
    </div>
  </div>
</div>

<style>
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    margin: 0;
    padding: 0;
  }

  .loading-content {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xl);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
  }

  .spinner {
    width: 100%;
    height: 100%;
    animation: rotate 1.4s linear infinite;
  }

  .spinner-track {
    stroke: var(--border-primary);
  }

  .spinner-path {
    stroke: var(--text-primary);
    stroke-linecap: round;
    stroke-dasharray: 80, 200;
    stroke-dashoffset: 0;
    animation: dash 1.4s ease-in-out infinite;
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes dash {
    0% {
      stroke-dasharray: 1, 200;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 80, 200;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 80, 200;
      stroke-dashoffset: -125;
    }
  }

  .loading-text h3 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }

  .loading-text p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
  }
</style>
