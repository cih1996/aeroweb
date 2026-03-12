<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getAIAgentClient, type TaskStatus, type ExecutionLogEntry, type InteractionData } from '../../services/ai-agent/index';
  import { actionExecutor } from '../../services/ai-agent/action-executor';
  import ExecutionLog from './ExecutionLog.svelte';
  import InteractionPanel from './InteractionPanel.svelte';

  export let tabId: string | null = null;
  export let appId: string = '';

  interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }

  let messageIdCounter = 0;
  function generateMessageId(): string {
    return `msg_${Date.now()}_${++messageIdCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  let messages: Message[] = [];
  let inputMessage: string = '';
  let sending = false;
  let currentTaskId: string | null = null;
  let currentTaskStatus: TaskStatus | null = null;
  let statusCheckInterval: any = null;
  let executionLogs: ExecutionLogEntry[] = [];
  let hasShownRunningMessage = false; // 标记是否已显示"任务执行中"消息
  let interactionData: InteractionData | null = null; // 交互数据
  let waitingForInteraction = false; // 是否正在等待交互

  // 初始化：注册能力
  async function initCapabilities() {
    if (!appId) return;

    try {
      // 设置当前 APP 和 Tab
      actionExecutor.setCurrentApp(appId);
      actionExecutor.setCurrentTabId(tabId);
      // 通用能力已在 action-registry 中注册，无需额外操作
    } catch (err: any) {
      console.error('[AIChatPanel] 初始化能力失败:', err);
      addSystemMessage(`❌ 初始化失败: ${err.message}`);
    }
  }

  // 发送消息
  async function sendMessage() {
    if (!inputMessage.trim() || sending || !tabId) {
      return;
    }

    const userMessage = inputMessage.trim();
    inputMessage = '';
    sending = true;

    // 添加用户消息
    messages = [...messages, {
      id: generateMessageId(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }];
    scrollToBottom();

    try {
      const client = getAIAgentClient();

      // 先尝试对话接口（路由判断）
      const conversationHistory = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10) // 只传递最近 10 条
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const conversationResult = await client.sendConversation({
        message: userMessage,
        conversation_history: conversationHistory,
      });

      // 如果是对话模式，直接显示回复
      if (conversationResult.response && !conversationResult.response.includes('请通过任务接口')) {
        // 添加 AI 回复
        messages = [...messages, {
          id: generateMessageId(),
          role: 'assistant',
          content: conversationResult.response,
          timestamp: Date.now(),
        }];

        // 如果有建议，显示为系统消息
        if (conversationResult.suggestions && conversationResult.suggestions.length > 0) {
          addSystemMessage(`💡 建议：${conversationResult.suggestions.join('；')}`);
        }

        // 如果记录了新信息
        if (conversationResult.memorized) {
          addSystemMessage('✓ 已记录你的偏好');
        }

        sending = false;
        scrollToBottom();
        return;
      }

      // 否则创建任务
      const taskId = await client.createTask({
        message: userMessage,
        enable_interaction: false,
      });

      currentTaskId = taskId;
      addSystemMessage(`任务已创建: ${taskId}`);

      // 开始轮询任务状态
      startStatusPolling(taskId);
    } catch (err: any) {
      sending = false;
      const errorMsg = err.message || String(err);
      addSystemMessage(`❌ 发送消息失败: ${errorMsg}`);
    }
  }

  // 开始轮询任务状态
  function startStatusPolling(taskId: string) {
    // 清除之前的轮询
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }

    // 立即检查一次
    checkTaskStatus(taskId);

    // 每 2 秒检查一次
    statusCheckInterval = setInterval(() => {
      checkTaskStatus(taskId);
    }, 2000);
  }

  // 检查任务状态
  async function checkTaskStatus(taskId: string) {
    try {
      const client = getAIAgentClient();
      const status = await client.getTaskStatus(taskId);
      
      currentTaskStatus = status;

      // 更新执行日志
      if (status.execution_log) {
        executionLogs = status.execution_log;
      }

      // 只在第一次变为 running 时显示消息
      if (status.status === 'running' && !hasShownRunningMessage) {
        addSystemMessage('任务正在执行中...');
        hasShownRunningMessage = true;
      }

      // 检查是否需要人机交互
      if (status.interaction_required && status.interaction_data && !waitingForInteraction) {
        handleInteractionRequired(status.interaction_data);
      }

      // 如果任务完成或失败，停止轮询
      if (status.status === 'completed' || status.status === 'failed') {
        stopStatusPolling();
        handleTaskComplete(status);
      }
    } catch (err: any) {
      console.error('[AIChatPanel] 检查任务状态失败:', err);
    }
  }

  // 处理需要人机交互
  function handleInteractionRequired(data: InteractionData) {
    waitingForInteraction = true;
    interactionData = data;
    addSystemMessage('⚠️ 需要您的确认...');
    scrollToBottom();
  }

  // 处理用户选择
  async function handleUserChoice(choiceId: string) {
    if (!currentTaskId) return;

    try {
      const client = getAIAgentClient();
      await client.submitInteraction(currentTaskId, choiceId);
      
      addSystemMessage(`✓ 已选择: ${choiceId}`);
      
      // 清除交互状态
      waitingForInteraction = false;
      interactionData = null;
      
      // 继续轮询
      // 任务会自动继续执行
    } catch (err: any) {
      addSystemMessage(`❌ 提交选择失败: ${err.message}`);
    }
  }

  // 停止轮询
  function stopStatusPolling() {
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }
    sending = false;
    executionLogs = []; // 清空执行日志
    hasShownRunningMessage = false; // 重置标记
    interactionData = null; // 清除交互数据
    waitingForInteraction = false; // 重置交互状态
  }

  // 处理任务完成
  function handleTaskComplete(status: TaskStatus) {
    if (status.status === 'completed') {
      // 构建回复消息
      let replyContent = '✓ 任务执行完成\n\n';
      
      if (status.progress) {
        replyContent += '进度:\n';
        for (const [key, value] of Object.entries(status.progress)) {
          replyContent += `  ${key}: ${value}\n`;
        }
      }

      if (status.token_stats) {
        replyContent += '\n💰 Token 统计:\n';
        let totalTokens = 0;
        let totalCalls = 0;
        
        for (const [aiName, stats] of Object.entries(status.token_stats)) {
          const aiStats = stats as any;
          totalTokens += aiStats.total_tokens || 0;
          totalCalls += aiStats.call_count || 0;
          replyContent += `  ${aiName}: ${aiStats.call_count} 次调用, ${aiStats.total_tokens.toLocaleString()} tokens\n`;
        }
        
        replyContent += `\n  总计: ${totalCalls} 次 AI 调用, ${totalTokens.toLocaleString()} tokens`;
      }

      messages = [...messages, {
        id: generateMessageId(),
        role: 'assistant',
        content: replyContent,
        timestamp: Date.now(),
      }];
    } else if (status.status === 'failed') {
      messages = [...messages, {
        id: generateMessageId(),
        role: 'assistant',
        content: `❌ 任务执行失败: ${status.error || '未知错误'}`,
        timestamp: Date.now(),
      }];
    }

    scrollToBottom();
    currentTaskId = null;
    currentTaskStatus = null;
  }

  // 添加系统消息
  function addSystemMessage(content: string) {
    messages = [...messages, {
      id: generateMessageId(),
      role: 'system',
      content: `🔧 ${content}`,
      timestamp: Date.now(),
    }];
    scrollToBottom();
  }

  // 取消发送
  function cancelSend() {
    stopStatusPolling();
    if (currentTaskId) {
      addSystemMessage('任务已取消');
      currentTaskId = null;
      currentTaskStatus = null;
    }
  }

  // 清空历史对话
  function clearHistory() {
    if (!confirm('确定要清空所有历史对话吗？此操作不可恢复。')) {
      return;
    }
    
    messages = [];
    currentTaskId = null;
    currentTaskStatus = null;
    console.log('[AIChatPanel] 历史对话已清空');
  }

  // 滚动到底部
  function scrollToBottom() {
    setTimeout(() => {
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }

  // 处理键盘事件
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  // 组件挂载时初始化
  onMount(() => {
    initCapabilities();
  });

  // 组件卸载时清理
  onDestroy(() => {
    stopStatusPolling();
  });

  // 监听 tabId 变化
  $: if (tabId) {
    actionExecutor.setCurrentTabId(tabId);
  }
</script>

<div class="ai-chat-panel">
  <div class="panel-header">
    <h3>AI 智能助手</h3>
    <div class="panel-actions">
      {#if messages.length > 0 && !sending}
        <button 
          class="btn-clear" 
          on:click={clearHistory}
          title="清空历史对话"
        >
          清空
        </button>
      {/if}
      {#if sending}
        <button 
          class="btn-cancel" 
          on:click={cancelSend}
          title="取消任务"
        >
          取消
        </button>
      {/if}
    </div>
  </div>

  <div class="panel-content">
    {#if currentTaskStatus && (currentTaskStatus.status === 'running' || currentTaskStatus.status === 'waiting_interaction')}
      <!-- 任务进度显示 -->
      <div class="task-progress-panel">
        <div class="progress-header">
          <span class="progress-label">
            {#if currentTaskStatus.status === 'waiting_interaction'}
              ⏸️ 等待您的确认...
            {:else}
              ⚙️ 任务执行中...
            {/if}
          </span>
        </div>
        
        <!-- 人机交互面板 -->
        {#if interactionData}
          <div class="interaction-section">
            <InteractionPanel 
              interactionData={interactionData} 
              onChoice={handleUserChoice} 
            />
          </div>
        {/if}
        
        {#if currentTaskStatus.progress && Object.keys(currentTaskStatus.progress).length > 0}
          <div class="progress-details">
            {#each Object.entries(currentTaskStatus.progress) as [key, value]}
              <div class="progress-item">
                <span class="progress-key">{key}:</span>
                <span class="progress-value">{value}</span>
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- 执行日志 -->
        {#if executionLogs.length > 0}
          <div class="execution-log-section">
            <div class="section-title">执行细节</div>
            <ExecutionLog logs={executionLogs} />
          </div>
        {/if}
      </div>
    {/if}
    
    <div class="messages-container">
      {#if messages.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🤖</div>
          <p>开始与 AI 智能助手对话</p>
          <p class="empty-hint">AI 可以根据你的指令自动执行{appId}操作</p>
        </div>
      {:else}
        {#each messages as message (message.id)}
          <div class="message message-{message.role}">
            <div class="message-avatar">
              {#if message.role === 'user'}
                👤
              {:else if message.role === 'system'}
                ⚙️
              {:else}
                🤖
              {/if}
            </div>
            <div class="message-content">
              <pre class="message-text">{message.content}</pre>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="input-section">
      <div class="input-wrapper">
        <textarea
          class="message-input"
          bind:value={inputMessage}
          on:keydown={handleKeydown}
          placeholder="输入消息... (Shift+Enter换行)"
          disabled={sending || !tabId}
          rows="3"
        ></textarea>
      </div>
    </div>
  </div>
</div>

<style>
  .ai-chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-height: 0;
    background: rgba(26, 31, 58, 0.95);
    border-left: 1px solid rgba(79, 172, 254, 0.2);
    overflow: hidden;
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .panel-actions {
    display: flex;
    gap: 8px;
  }

  .btn-cancel {
    padding: 6px 12px;
    background: rgba(255, 59, 48, 0.2);
    border: 1px solid rgba(255, 59, 48, 0.4);
    border-radius: 6px;
    color: #ff3b30;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover {
    background: rgba(255, 59, 48, 0.3);
    border-color: rgba(255, 59, 48, 0.6);
  }

  .btn-clear {
    padding: 6px 12px;
    background: rgba(255, 149, 0, 0.2);
    border: 1px solid rgba(255, 149, 0, 0.4);
    border-radius: 6px;
    color: #ff9500;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-clear:hover {
    background: rgba(255, 149, 0, 0.3);
    border-color: rgba(255, 149, 0, 0.6);
  }

  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .task-progress-panel {
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    background: rgba(10, 14, 39, 0.6);
    padding: 12px;
    max-height: 500px;
    overflow-y: auto;
  }

  .task-progress-panel::-webkit-scrollbar {
    width: 6px;
  }

  .task-progress-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .task-progress-panel::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 3px;
  }

  .progress-header {
    margin-bottom: 8px;
  }

  .progress-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(79, 172, 254, 0.9);
  }

  .progress-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-item {
    display: flex;
    gap: 8px;
    font-size: 11px;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .progress-key {
    color: rgba(255, 255, 255, 0.6);
  }

  .progress-value {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
  }

  .execution-log-section {
    margin-top: 12px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
    padding-left: 4px;
  }

  .interaction-section {
    margin-bottom: 12px;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .messages-container::-webkit-scrollbar {
    width: 8px;
  }

  .messages-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-container::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 4px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state p {
    margin: 8px 0;
    font-size: 14px;
  }

  .empty-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
  }

  .message {
    display: flex;
    gap: 12px;
    animation: fadeIn 0.3s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message-user {
    flex-direction: row-reverse;
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    background: rgba(79, 172, 254, 0.2);
    border-radius: 50%;
  }

  .message-content {
    flex: 1;
    min-width: 0;
  }

  .message-text {
    margin: 0;
    padding: 12px 16px;
    background: rgba(79, 172, 254, 0.1);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.9);
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .message-user .message-text {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    border: none;
    color: white;
  }

  .message-system .message-text {
    background: rgba(255, 149, 0, 0.1);
    border-color: rgba(255, 149, 0, 0.2);
    color: rgba(255, 149, 0, 0.9);
  }

  .input-section {
    padding: 16px;
    border-top: 1px solid rgba(79, 172, 254, 0.1);
    background: rgba(255, 255, 255, 0.02);
  }

  .input-wrapper {
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }

  .message-input {
    flex: 1;
    padding: 10px 12px;
    background: rgba(10, 14, 39, 0.8);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-family: inherit;
    resize: none;
    outline: none;
    line-height: 1.5;
  }

  .message-input:focus {
    border-color: rgba(79, 172, 254, 0.5);
    box-shadow: 0 0 0 2px rgba(79, 172, 254, 0.1);
  }

  .message-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .message-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
