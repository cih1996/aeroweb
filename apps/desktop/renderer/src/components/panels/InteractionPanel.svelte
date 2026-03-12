<script lang="ts">
  import type { InteractionData } from '../../services/ai-agent/index';

  export let interactionData: InteractionData;
  export let onChoice: (choiceId: string) => void;

  // 严重程度到样式的映射
  const severityStyles: Record<string, { color: string; bgColor: string; icon: string }> = {
    low: { color: '#43e97b', bgColor: 'rgba(67, 233, 123, 0.1)', icon: 'ℹ️' },
    medium: { color: '#feca57', bgColor: 'rgba(254, 202, 87, 0.1)', icon: '⚠️' },
    high: { color: '#ff6b6b', bgColor: 'rgba(255, 107, 107, 0.1)', icon: '🚨' },
  };

  $: severityStyle = severityStyles[interactionData.severity] || severityStyles.medium;

  function handleChoice(choiceId: string) {
    onChoice(choiceId);
  }
</script>

<div class="interaction-panel" style="background: {severityStyle.bgColor}; border-color: {severityStyle.color}">
  <div class="interaction-header">
    <span class="severity-icon">{severityStyle.icon}</span>
    <span class="situation-text" style="color: {severityStyle.color}">{interactionData.situation}</span>
  </div>

  {#if interactionData.details}
    <div class="interaction-details">
      {interactionData.details}
    </div>
  {/if}

  <div class="options-container">
    <div class="options-label">请选择操作：</div>
    <div class="options-list">
      {#each interactionData.options as option}
        <button 
          class="option-button"
          on:click={() => handleChoice(option.choice_id)}
        >
          <div class="option-label">{option.label}</div>
          <div class="option-description">{option.description}</div>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .interaction-panel {
    padding: 16px;
    border-radius: 8px;
    border: 2px solid;
    margin: 12px 0;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .interaction-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .severity-icon {
    font-size: 24px;
  }

  .situation-text {
    font-size: 15px;
    font-weight: 600;
    flex: 1;
  }

  .interaction-details {
    margin-bottom: 16px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.85);
  }

  .options-container {
    margin-top: 12px;
  }

  .options-label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 8px;
  }

  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-button {
    padding: 12px 16px;
    background: rgba(79, 172, 254, 0.15);
    border: 1px solid rgba(79, 172, 254, 0.3);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .option-button:hover {
    background: rgba(79, 172, 254, 0.25);
    border-color: rgba(79, 172, 254, 0.5);
    transform: translateX(4px);
  }

  .option-button:active {
    transform: translateX(2px);
  }

  .option-label {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin-bottom: 4px;
  }

  .option-description {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.4;
  }
</style>

