<script lang="ts">
  export let appName: string = '应用';
</script>

<div class="loading-overlay">
  <div class="loading-content">
    <div class="loading-spinner">
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
    </div>
    <div class="loading-text">
      <h3>正在启动 {appName}...</h3>
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
    background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(10px);
    margin: 0;
    padding: 0;
  }

  .loading-content {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .loading-spinner {
    position: relative;
    width: 80px;
    height: 80px;
  }

  .spinner-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 4px solid transparent;
    border-top-color: #4facfe;
    border-radius: 50%;
    animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  }

  .spinner-ring:nth-child(1) {
    animation-delay: -0.45s;
  }

  .spinner-ring:nth-child(2) {
    animation-delay: -0.3s;
    border-top-color: #00f2fe;
  }

  .spinner-ring:nth-child(3) {
    animation-delay: -0.15s;
    border-top-color: #4facfe;
    opacity: 0.7;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .loading-text h3 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .loading-text p {
    margin: 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>

