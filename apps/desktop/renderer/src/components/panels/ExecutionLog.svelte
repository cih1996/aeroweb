<script lang="ts">
  import type { ExecutionLogEntry } from '../../services/ai-agent/index';

  export let logs: ExecutionLogEntry[] = [];

  // Agent 类型到图标和颜色的映射
  const agentStyles: Record<string, { icon: string; color: string; bgColor: string }> = {
    GlobalIntentAI: { icon: '🎯', color: '#4facfe', bgColor: 'rgba(79, 172, 254, 0.1)' },
    ContextBuilderAI: { icon: '📋', color: '#43e97b', bgColor: 'rgba(67, 233, 123, 0.1)' },
    StrategyAI: { icon: '🗺️', color: '#fa709a', bgColor: 'rgba(250, 112, 154, 0.1)' },
    DecisionAI: { icon: '🤔', color: '#f093fb', bgColor: 'rgba(240, 147, 251, 0.1)' },
    ExecutorAI: { icon: '⚡', color: '#feca57', bgColor: 'rgba(254, 202, 87, 0.1)' },
    PerceptionAI: { icon: '👁️', color: '#ff6b6b', bgColor: 'rgba(255, 107, 107, 0.1)' },
    SupervisorAI: { icon: '🛡️', color: '#48dbfb', bgColor: 'rgba(72, 219, 251, 0.1)' },
    SummarizerAI: { icon: '📝', color: '#ee5a6f', bgColor: 'rgba(238, 90, 111, 0.1)' },
  };

  // 动作类型到样式的映射
  const actionStyles: Record<string, { color: string }> = {
    start: { color: '#4facfe' },
    complete: { color: '#43e97b' },
    decision: { color: '#f093fb' },
    execute: { color: '#feca57' },
    success: { color: '#43e97b' },
    error: { color: '#ff6b6b' },
  };

  function getAgentStyle(agent: string) {
    return agentStyles[agent] || { icon: '🤖', color: '#999', bgColor: 'rgba(153, 153, 153, 0.1)' };
  }

  function getActionStyle(action: string) {
    return actionStyles[action] || { color: '#999' };
  }

  function formatTime(timestamp: string) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDetails(details: Record<string, any>): string {
    if (!details || Object.keys(details).length === 0) return '';
    
    const important = ['message', 'reason', 'action', 'progress', 'error'];
    const result: string[] = [];
    
    for (const key of important) {
      if (details[key] !== undefined) {
        if (typeof details[key] === 'object') {
          result.push(`${key}: ${JSON.stringify(details[key])}`);
        } else {
          result.push(`${key}: ${details[key]}`);
        }
      }
    }
    
    return result.join(', ');
  }
</script>

<div class="execution-log-container">
  {#if logs.length === 0}
    <div class="empty-log">
      <span class="empty-icon">📋</span>
      <span class="empty-text">暂无执行记录</span>
    </div>
  {:else}
    <div class="log-list">
      {#each logs as log, index (index)}
        {@const agentStyle = getAgentStyle(log.agent)}
        {@const actionStyle = getActionStyle(log.action)}
        <div 
          class="log-entry" 
          style="border-left-color: {agentStyle.color}; background: {agentStyle.bgColor}"
        >
          <div class="log-header">
            <span class="log-icon">{agentStyle.icon}</span>
            <span class="log-agent" style="color: {agentStyle.color}">{log.agent}</span>
            <span class="log-action" style="color: {actionStyle.color}">{log.action}</span>
            <span class="log-time">{formatTime(log.timestamp)}</span>
          </div>
          {#if log.details && Object.keys(log.details).length > 0}
            <div class="log-details">
              {formatDetails(log.details)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .execution-log-container {
    max-height: 400px;
    overflow-y: auto;
    padding: 8px;
    background: rgba(10, 14, 39, 0.4);
    border-radius: 6px;
  }

  .execution-log-container::-webkit-scrollbar {
    width: 6px;
  }

  .execution-log-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .execution-log-container::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 3px;
  }

  .empty-log {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    gap: 8px;
  }

  .empty-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .empty-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .log-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .log-entry {
    padding: 8px 12px;
    border-radius: 4px;
    border-left: 3px solid;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .log-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .log-icon {
    font-size: 14px;
  }

  .log-agent {
    font-weight: 600;
    flex-shrink: 0;
  }

  .log-action {
    font-weight: 500;
    flex-shrink: 0;
  }

  .log-time {
    margin-left: auto;
    color: rgba(255, 255, 255, 0.4);
    font-size: 10px;
  }

  .log-details {
    margin-top: 4px;
    padding-left: 22px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.4;
    word-break: break-word;
  }
</style>

