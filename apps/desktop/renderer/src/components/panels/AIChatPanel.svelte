<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getAction, getAvailableActions } from './actions/action-registry';
  import { AIService, loadAIConfig, validateConfig, getCurrentProvider } from '../../services/ai';
  import type { AIConfig } from '../../services/ai';
  import { saveHistory } from '../../services/ai/history-manager';
  // JSON响应类型定义
  interface ExecuteResponse {
    type: 'execute';
    action: string;
    params: any;
    progress?: any; // 任务进度参数
  }

  interface ReplyResponse {
    type: 'reply';
    content: string;
  }

  type AIResponse = ExecuteResponse | ReplyResponse;

  export let tabId: string | null = null;
  export let appId: string = '';

  let aiService: AIService | null = null;
  let currentProvider = getCurrentProvider();
  let aiConfig: AIConfig = loadAIConfig(currentProvider);

  interface Message {
    id: string; // 唯一标识符
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }

  // 生成唯一ID
  let messageIdCounter = 0;
  function generateMessageId(): string {
    return `msg_${Date.now()}_${++messageIdCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  let messages: Message[] = [];
  let inputMessage: string = '';
  let sending = false;
  let thinking = false;
  let thinkingContent = '';
  let tabs: any[] = [];
  let currentTab: any = null;
  let userOriginalRequest = ''; // 保存用户最初的需求
  let currentExecutingAction: string = ''; // 当前正在执行的命令描述
  let pendingAssistantMessageId: string | null = null; // 当前待处理的助手消息ID（用于隐藏非reply的JSON）
  let taskProgress: any = null; // 任务进度参数
  let executionHistory: Array<{action: string; params: any; timestamp: number}> = []; // 执行命令历史（最近5条）

  // 根据tabId获取tab信息，并生成历史会话ID
  async function getHistoryFile(): Promise<string> {
    if (!tabId) {
      throw new Error('没有活动的标签页');
    }

    // 获取当前tab信息
    tabs = await window.electronAPI.tab.list();
    currentTab = tabs.find(t => t.id === tabId);
    
    if (!currentTab) {
      throw new Error('找不到对应的标签页');
    }

    // 使用configId作为历史会话ID，如果没有configId则使用tabId
    const sessionId = currentTab.configId || `tab_${tabId}`;
    return sessionId;
  }

  // 初始化 AI 服务
  function initAIService() {
    // 验证配置
    const validation = validateConfig(aiConfig);
    if (!validation.valid) {
      console.error('[AIChatPanel] AI 配置无效:', validation.error);
      return;
    }

    aiService = new AIService(aiConfig);
    
    // 根据 appId 加载对应的提示词文件，并注入操作方法说明
    if (appId === 'douyin' || appId === 'tiktok') {
      aiService.loadPromptFile('douyin-assistant.txt', appId).catch(err => {
        console.error('[AIChatPanel] 加载提示词失败:', err);
      });
    } else {
      aiService.loadPromptFile('default.txt', appId).catch(err => {
        console.error('[AIChatPanel] 加载提示词失败:', err);
      });
    }
  }

  // 加载历史对话
  async function loadHistory() {
    if (!tabId || !aiService) return;

    try {
      const historyFileId = await getHistoryFile();
      aiService.setHistoryFile(historyFileId);
      
      // 从持久化存储加载历史对话
      const history = aiService.getHistory();
      // 导入到aiService的内部历史对话
      aiService.importHistory(history);
      
      // 显示在UI上
      messages = history.map((msg) => ({
        id: generateMessageId(),
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: Date.now(),
      }));
      scrollToBottom();
    } catch (err) {
      console.error('[AIChatPanel] 加载历史对话失败:', err);
    }
  }

  // 发送消息
  async function sendMessage() {
    if (!inputMessage.trim() || sending || !tabId || !aiService) {
      return;
    }

    const userMessage = inputMessage.trim();
    inputMessage = '';
    sending = true;
    thinking = false;
    thinkingContent = '';
    
    // 保存用户最初的需求
    userOriginalRequest = userMessage;

    // 添加用户消息
    messages = [...messages, {
      id: generateMessageId(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    }];
    scrollToBottom();

    try {
      const historyFileId = await getHistoryFile();
      aiService.setHistoryFile(historyFileId);

      // 添加一个空的助手消息，用于流式更新
      const assistantMessageId = generateMessageId();
      pendingAssistantMessageId = assistantMessageId;
      let assistantMessage = '';
      
      messages = [...messages, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }];
      scrollToBottom();

      // 输出发送给AI的原始内容
      console.log('[发送给AI]', {
        message: userMessage,
        timestamp: new Date().toISOString()
      });

      // 使用流式 API
      let isNonReplyJson = false; // 标记是否为非reply类型的JSON
      for await (const chunk of aiService.chatStream(userMessage, {
        historyFile: historyFileId,
        useHistory: true,
        maxTokens: 2000,
        temperature: 0.7,
        stream: true,
      })) {
        if (chunk.done) {
          break;
        }
        
        assistantMessage += chunk.content;
        
        // 检测是否是JSON格式（非reply类型）
        const aiResponse = parseAIResponse(assistantMessage);
        if (aiResponse) {
          if (aiResponse.type !== 'reply') {
            // 非reply类型，显示占位符
            isNonReplyJson = true;
            messages = messages.map((msg) => 
              msg.id === assistantMessageId
                ? { ...msg, content: '正在处理中...' }
                : msg
            );
          } else {
            // reply类型，正常显示
            isNonReplyJson = false;
            messages = messages.map((msg) => 
              msg.id === assistantMessageId
                ? { ...msg, content: aiResponse.content }
                : msg
            );
          }
        } else {
          // 如果还不是完整的JSON，检查是否可能是JSON的开头
          // 如果已经确定是非reply JSON，继续显示占位符
          if (!isNonReplyJson) {
            // 检查是否可能是JSON开头（以{开头）
            if (assistantMessage.trim().startsWith('{')) {
              // 可能是JSON，暂时显示原始内容，等待完整解析
              messages = messages.map((msg) => 
                msg.id === assistantMessageId
                  ? { ...msg, content: assistantMessage }
                  : msg
              );
            } else {
              // 不是JSON，正常显示
              messages = messages.map((msg) => 
                msg.id === assistantMessageId
                  ? { ...msg, content: assistantMessage }
                  : msg
              );
            }
          }
        }
        scrollToBottom();
      }

      // 输出AI的原始回复内容
      if (assistantMessage) {
        console.log('[AI回复]', {
          content: assistantMessage,
          timestamp: new Date().toISOString()
        });
      }

      // 注意：历史对话已由 aiService 的 chatStream 自动保存到内部历史对话中
      // 不需要手动保存，只有在 AI 输出 reply 时才会持久化保存

      // 处理AI响应
      if (assistantMessage) {
        // 在流式输出完成后，再次检查并隐藏非reply类型的JSON
        const aiResponse = parseAIResponse(assistantMessage);
        if (aiResponse && aiResponse.type !== 'reply' && pendingAssistantMessageId) {
          // 隐藏非reply类型的消息
          messages = messages.filter(msg => msg.id !== pendingAssistantMessageId);
          pendingAssistantMessageId = null;
        }
        
        await handleAIResponse(assistantMessage);
      }
    } catch (err: any) {
      thinking = false;
      const errorMsg = err.message || String(err);
      messages = [...messages, {
        id: generateMessageId(),
        role: 'assistant',
        content: `❌ 错误: ${errorMsg}`,
        timestamp: Date.now(),
      }];
      scrollToBottom();
    } finally {
      sending = false;
      thinking = false;
    }
  }

  // 解析JSON响应
  function parseAIResponse(response: string): AIResponse | null {
    try {
      // 尝试提取JSON（可能包含在代码块中）
      let jsonStr = response.trim();
      
      // 如果包含代码块标记，提取JSON部分
      const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // 尝试直接查找JSON对象
        const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          jsonStr = braceMatch[0];
        }
      }
      
      const parsed = JSON.parse(jsonStr);
      if (parsed.type && ['execute', 'reply'].includes(parsed.type)) {
        return parsed as AIResponse;
      }
    } catch (err) {
      //console.warn('[AIChatPanel] 解析JSON响应失败:', err);
    }
    return null;
  }

  // 执行操作（通用动态调用）
  async function executeAction(action: string, params: any): Promise<any> {
    if (!tabId) {
      throw new Error('没有活动的标签页');
    }

    // 将params转换为数组形式（如果传入的是对象，尝试兼容处理）
    let paramsArray: any[] = [];
    if (Array.isArray(params)) {
      paramsArray = params;
    } else if (params && typeof params === 'object') {
      // 兼容旧的对象形式，但建议AI返回数组形式
      // 这里只做基本转换，具体参数应该由AI按照数组形式返回
      paramsArray = Object.values(params);
    }

    // 打印执行的命令和参数
    console.log('[执行命令]', {
      action,
      params: paramsArray,
      timestamp: new Date().toISOString()
    });

    try {
      // 动态获取action函数
      const actionFn = getAction(appId, action);
      
      if (!actionFn) {
        throw new Error(`未知的操作: ${action}。可用操作: ${getAvailableActions(appId).join(', ')}`);
      }
      // 动态调用action函数，第一个参数总是tabId，后续参数从paramsArray中获取
      const result = await actionFn(tabId, ...paramsArray);

      return result;
    } catch (error: any) {
      // 打印错误信息
      console.error('[执行错误]', {
        action,
        params: paramsArray,
        error: error.message || String(error),
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // 处理AI响应
  async function handleAIResponse(response: string) {
    if (!tabId || !aiService) return;

    const aiResponse = parseAIResponse(response);
    
 
    if (!aiResponse) {
      // 如果不是JSON格式，显示原始回复
      return;
    }

    try {
      if (aiResponse.type === 'execute') {
        // 隐藏当前消息（不显示JSON）
        if (pendingAssistantMessageId) {
          messages = messages.filter(msg => msg.id !== pendingAssistantMessageId);
          pendingAssistantMessageId = null;
        }
        
        // 保存progress参数
        if (aiResponse.progress !== undefined) {
          taskProgress = aiResponse.progress;
        }
        
        // 更新执行命令历史（保留最近5条）
        executionHistory.push({
          action: aiResponse.action,
          params: aiResponse.params,
          timestamp: Date.now()
        });
        if (executionHistory.length > 5) {
          executionHistory.shift(); // 移除最旧的一条
        }
        
        // 更新当前执行的命令描述
        currentExecutingAction = `${aiResponse.action}${aiResponse.params ? `(${JSON.stringify(aiResponse.params)})` : ''}`;
        
        // 执行命令（不显示执行过程和返回值）
        const result = await executeAction(aiResponse.action, aiResponse.params);
        
        // 清空当前执行命令描述
        currentExecutingAction = '';
        
        // 继续执行（自循环）- 让AI根据历史对话决定下一步
        await continueExecution(result);
      } else if (aiResponse.type === 'reply') {
        // 普通回复，更新消息内容为reply的content
        if (pendingAssistantMessageId) {
          messages = messages.map((msg) => 
            msg.id === pendingAssistantMessageId
              ? { ...msg, content: aiResponse.content }
              : msg
          );
          pendingAssistantMessageId = null;
        } else {
          // 如果没有待处理的消息，添加新消息
          messages = [...messages, {
            id: generateMessageId(),
            role: 'assistant',
            content: aiResponse.content,
            timestamp: Date.now(),
          }];
        }
        scrollToBottom();
        
        // AI输出reply时，持久化保存历史对话（过滤掉exec等内部命令）
        if (aiService) {
          try {
            const historyFileId = await getHistoryFile();
            // 从aiService获取内部历史对话
            const allHistory = aiService.exportHistory();
            
            // 过滤掉exec等内部命令的历史对话
            // 判断标准：如果assistant的回复是JSON格式且type为execute，则过滤掉
            const filteredHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
            
            for (let i = 0; i < allHistory.length; i++) {
              const msg = allHistory[i];
              
              // 跳过 system 角色的消息（提示词）
              if (msg.role === 'system') {
                continue;
              }
              
              // 用户消息总是保留
              if (msg.role === 'user') {
                filteredHistory.push({ role: 'user', content: msg.content });
              } else if (msg.role === 'assistant') {
                // 检查是否是execute类型的JSON
                const aiResponse = parseAIResponse(msg.content);
                // 只保留非execute类型的消息（reply类型或非JSON格式）
                if (!aiResponse || aiResponse.type !== 'execute') {
                  filteredHistory.push({ role: 'assistant', content: msg.content });
                }
                // execute类型的消息被过滤掉，不保存
              }
            }
            
            // 持久化保存过滤后的历史对话
            if (filteredHistory.length > 0) {
              saveHistory(historyFileId, filteredHistory);
              console.log('[AIChatPanel] 已持久化保存历史对话（已过滤exec命令）');
            }
          } catch (err) {
            console.error('[AIChatPanel] 持久化保存历史对话失败:', err);
          }
        }
        
        // 重置状态
        userOriginalRequest = '';
        currentExecutingAction = '';
        taskProgress = null;
        executionHistory = [];
      }
    } catch (err: any) {
      // 错误不显示在UI，继续执行（让AI决定如何处理错误）
      console.error('[AIChatPanel] 执行失败:', err);
      await continueExecution(null, err.message);
    }
  }

  // 继续执行（自循环）- 让AI根据用户需求和历史对话决定下一步
  async function continueExecution(lastResult: any, error?: string) {
    if (!aiService) {
      return;
    }

    // 构建上下文消息，让AI根据用户需求和历史对话决定下一步
    let contextMessage = `请根据用户最初的需求和之前的对话历史，判断：
1. 如果用户需求已满足，输出 {"type": "reply", "content": "回复内容"} 来回答用户
2. 如果用户需求未满足，输出 {"type": "execute", "action": "具体操作", "params": {}, "progress": {}} 来执行下一步操作

**重要**：如果输出execute类型，必须包含progress参数。如果这是第一次输出，初始化progress；否则更新上一次的progress参数。`;

    if (userOriginalRequest) {
      contextMessage = `用户最初的需求：${userOriginalRequest}\n\n` + contextMessage;
    }
    
    // 传递上一次的progress参数
    if (taskProgress !== null) {
      contextMessage = `上一次的任务进度参数：${JSON.stringify(taskProgress, null, 2)}\n\n` + contextMessage;
    }
    
    if (lastResult !== null) {
      contextMessage = `最新执行结果：${JSON.stringify(lastResult, null, 2)}\n\n` + contextMessage;
    }
    if (error) {
      contextMessage = `执行错误：${error}\n\n` + contextMessage;
    }

    try {
      const historyFileId = await getHistoryFile();
      
      // 输出发送给AI的原始内容
      console.log('[发送给AI]', contextMessage);
      
      let responseText = '';

      for await (const chunk of aiService.chatStream(contextMessage, {
        historyFile: historyFileId,
        useHistory: true,
        maxTokens: 2000,
        temperature: 0.7,
      })) {
        if (chunk.done) break;
        responseText += chunk.content;
      }

      // 输出AI的原始回复内容
      if (responseText) {
        console.log('[AI回复]', responseText);
      }

      // 注意：历史对话已由 aiService 的 chatStream 自动保存到内部历史对话中
      // contextMessage 会被保存（虽然包含系统内部信息，但这是为了保持对话连续性）
      // 只有在 AI 输出 reply 时才会持久化保存，并过滤掉 exec 命令

      if (responseText) {
        await handleAIResponse(responseText);
      }
    } catch (err: any) {
      console.error('[AIChatPanel] 继续执行失败:', err);
      addSystemMessage(`❌ 继续执行失败: ${err.message}`);
    }
  }



  // 添加系统消息
  function addSystemMessage(content: string) {
    messages = [...messages, {
      id: generateMessageId(),
      role: 'assistant',
      content: `🔧 ${content}`,
      timestamp: Date.now(),
    }];
    scrollToBottom();
  }

  // 取消发送
  function cancelSend() {
    // 流式请求无法直接取消，但可以标记为取消状态
    sending = false;
    thinking = false;
  }

  // 清空历史对话
  async function clearHistory() {
    if (!tabId || !aiService) return;
    
    // 确认清空
    if (!confirm('确定要清空所有历史对话吗？此操作不可恢复。')) {
      return;
    }
    
    try {
      const historyFileId = await getHistoryFile();
      aiService.clearHistory(historyFileId);
      messages = [];
      userOriginalRequest = '';
      currentExecutingAction = '';
      pendingAssistantMessageId = null;
      taskProgress = null;
      executionHistory = [];
      console.log('[AIChatPanel] 历史对话已清空');
    } catch (err) {
      console.error('[AIChatPanel] 清空历史对话失败:', err);
      addSystemMessage(`清空历史对话失败: ${err instanceof Error ? err.message : String(err)}`);
    }
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
    // 初始化 AI 服务
    initAIService();
    
    // 异步加载历史对话
    loadHistory();
    
    // 监听配置变化（从 localStorage 或其他地方）
    const checkConfig = () => {
      const newProvider = getCurrentProvider();
      const newConfig = loadAIConfig(newProvider);
      // 如果服务商变化或配置变化，重新初始化
      if (newProvider !== currentProvider || JSON.stringify(newConfig) !== JSON.stringify(aiConfig)) {
        currentProvider = newProvider;
        aiConfig = newConfig;
        initAIService();
        loadHistory();
      }
    };
    
    // 定期检查配置变化
    const configCheckInterval = setInterval(checkConfig, 1000);
    
    // 监听tab变化
    const updateTabs = async () => {
      tabs = await window.electronAPI.tab.list();
      currentTab = tabs.find(t => t.id === tabId);
      // 如果tab变化了，重新加载历史对话
      if (currentTab && aiService) {
        await loadHistory();
      }
    };

    const handleTabUpdate = () => updateTabs();
    const handleTabActivate = () => updateTabs();

    window.electronAPI.on('tab:update', handleTabUpdate);
    window.electronAPI.on('tab:activate', handleTabActivate);

    return () => {
      // 清理事件监听
      window.electronAPI.off('tab:update', handleTabUpdate);
      window.electronAPI.off('tab:activate', handleTabActivate);
      clearInterval(configCheckInterval);
    };
  });
</script>

<div class="ai-chat-panel">
  <div class="panel-header">
    <h3>AI 对话</h3>
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
          title="取消发送"
        >
          取消
        </button>
      {/if}
    </div>
  </div>

  <div class="panel-content">
    {#if executionHistory.length > 0 || currentExecutingAction}
      <!-- 执行命令历史 -->
      <div class="execution-history-panel">
        <div class="execution-history-header">
          <span class="history-label">执行命令历史</span>
        </div>
        <div class="execution-history-list">
          {#each executionHistory.slice().reverse() as item, index}
            <div class="execution-history-item">
              <span class="history-index">{executionHistory.length - index}</span>
              <span class="history-action">{item.action}</span>
              {#if item.params && Object.keys(item.params).length > 0}
                <span class="history-params">({JSON.stringify(item.params)})</span>
              {/if}
            </div>
          {/each}
          {#if currentExecutingAction}
            <div class="execution-history-item executing">
              <span class="action-indicator">⟳</span>
              <span class="history-action">正在执行: {currentExecutingAction}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
    
    <div class="messages-container">
      {#if messages.length === 0}
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>开始与AI对话吧</p>
          <p class="empty-hint">AI可以根据你的指令执行抖音操作</p>
        </div>
      {:else}
        {#each messages as message (message.id)}
          <div class="message message-{message.role}">
            <div class="message-avatar">
              {#if message.role === 'user'}
                👤
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
      
      {#if thinking}
        <div class="message message-assistant">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <div class="thinking-indicator">
              <span class="thinking-text">{thinkingContent}</span>
              <div class="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
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

  .execution-history-panel {
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
    background: rgba(10, 14, 39, 0.6);
    max-height: 200px;
    overflow-y: auto;
  }

  .execution-history-header {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.1);
  }

  .history-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .execution-history-list {
    padding: 6px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .execution-history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    background: rgba(79, 172, 254, 0.05);
    border: 1px solid rgba(79, 172, 254, 0.1);
    font-size: 11px;
    font-family: 'Consolas', 'Monaco', monospace;
  }

  .execution-history-item.executing {
    background: rgba(79, 172, 254, 0.15);
    border-color: rgba(79, 172, 254, 0.4);
  }

  .history-index {
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
    min-width: 20px;
  }

  .history-action {
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  }

  .history-params {
    color: rgba(255, 255, 255, 0.6);
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .action-indicator {
    font-size: 12px;
    color: rgba(79, 172, 254, 0.9);
    animation: spin 1s linear infinite;
  }

  .execution-history-panel::-webkit-scrollbar {
    width: 6px;
  }

  .execution-history-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .execution-history-panel::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 3px;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
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

  .thinking-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(79, 172, 254, 0.1);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 8px;
  }

  .thinking-text {
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
  }

  .thinking-dots {
    display: flex;
    gap: 4px;
  }

  .thinking-dots span {
    width: 6px;
    height: 6px;
    background: rgba(79, 172, 254, 0.6);
    border-radius: 50%;
    animation: thinkingDot 1.4s infinite ease-in-out;
  }

  .thinking-dots span:nth-child(1) {
    animation-delay: 0s;
  }

  .thinking-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .thinking-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes thinkingDot {
    0%, 80%, 100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
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

  .send-btn {
    padding: 10px 20px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 60px;
    height: 40px;
  }

  .send-btn:hover:not(:disabled) {
    box-shadow: 0 2px 8px rgba(79, 172, 254, 0.4);
    transform: translateY(-1px);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

