/**
 * AI Agent 系统初始化
 * 在应用启动时调用
 */

import { initActionExecutor } from './action-executor';
import { loadAIAgentConfig, getAIAgentClient } from './index';

/**
 * 初始化 AI Agent 系统
 */
export function initAIAgentSystem() {
  console.log('[AI Agent] 初始化系统...');

  // 1. 加载配置
  const config = loadAIAgentConfig();
  console.log('[AI Agent] 配置已加载:', config);

  // 2. 初始化客户端
  getAIAgentClient(config);

  // 3. 初始化动作执行器
  initActionExecutor();

  console.log('[AI Agent] 系统初始化完成');
}

