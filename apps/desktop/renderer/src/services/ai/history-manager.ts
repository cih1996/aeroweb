/**
 * 历史对话管理器
 * 负责管理对话历史的存储和加载
 */

import type { Message } from './types';

const HISTORY_STORAGE_PREFIX = 'ai_history_';

/**
 * 获取历史对话存储键
 */
function getHistoryKey(historyFile: string): string {
  return `${HISTORY_STORAGE_PREFIX}${historyFile}`;
}

/**
 * 加载历史对话
 */
export function loadHistory(historyFile: string): Message[] {
  try {
    const key = getHistoryKey(historyFile);
    const stored = localStorage.getItem(key);
    if (!stored) {
      return [];
    }
    const history = JSON.parse(stored);
    // 过滤掉系统消息（系统消息不应该存储在历史中）
    return history.filter((msg: Message) => msg.role !== 'system');
  } catch (error) {
    console.error('[HistoryManager] 加载历史对话失败:', error);
    return [];
  }
}

/**
 * 保存历史对话
 */
export function saveHistory(historyFile: string, history: Message[]): void {
  try {
    const key = getHistoryKey(historyFile);
    // 过滤掉系统消息
    const filteredHistory = history.filter(msg => msg.role !== 'system');
    localStorage.setItem(key, JSON.stringify(filteredHistory));
  } catch (error) {
    console.error('[HistoryManager] 保存历史对话失败:', error);
    throw error;
  }
}

/**
 * 清空历史对话
 */
export function clearHistory(historyFile: string): void {
  try {
    const key = getHistoryKey(historyFile);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[HistoryManager] 清空历史对话失败:', error);
    throw error;
  }
}

/**
 * 获取历史对话数量
 */
export function getHistoryCount(historyFile: string): number {
  const history = loadHistory(historyFile);
  return history.length;
}

