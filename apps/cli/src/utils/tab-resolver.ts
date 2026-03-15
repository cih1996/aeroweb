import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { client } from './client';

const STATE_FILE = join(process.env.HOME || '/tmp', '.polyweb-state.json');

interface State {
  lastTabId?: string;
  lastCreatedTabId?: string;
}

// 读取状态
function readState(): State {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {
    // 忽略
  }
  return {};
}

// 保存状态
function saveState(state: State): void {
  try {
    const dir = dirname(STATE_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // 忽略
  }
}

// 记录最近操作的 Tab
export function setLastTab(tabId: string): void {
  const state = readState();
  state.lastTabId = tabId;
  saveState(state);
}

// 记录最近创建的 Tab
export function setLastCreatedTab(tabId: string): void {
  const state = readState();
  state.lastCreatedTabId = tabId;
  state.lastTabId = tabId;
  saveState(state);
}

// 获取最近操作的 Tab
export function getLastTab(): string | undefined {
  return readState().lastTabId;
}

/**
 * 解析 Tab ID
 * 支持：
 * - @last / @l - 最近操作的 Tab
 * - @current / @c / @active - 当前激活的 Tab
 * - @new / @n - 最近创建的 Tab
 * - 数字 - 按索引选择（1-based）
 * - 短字符串 - 模糊匹配 Tab ID 或名称
 * - 完整 Tab ID
 */
export async function resolveTabId(input: string): Promise<string> {
  const normalized = input.toLowerCase().trim();

  // @last / @l - 最近操作的 Tab
  if (normalized === '@last' || normalized === '@l') {
    const lastTab = getLastTab();
    if (!lastTab) {
      throw new Error('没有最近操作的 Tab，请先执行其他 Tab 命令');
    }
    return lastTab;
  }

  // @new / @n - 最近创建的 Tab
  if (normalized === '@new' || normalized === '@n') {
    const state = readState();
    if (!state.lastCreatedTabId) {
      throw new Error('没有最近创建的 Tab');
    }
    return state.lastCreatedTabId;
  }

  // @current / @c / @active - 当前激活的 Tab
  if (normalized === '@current' || normalized === '@c' || normalized === '@active') {
    const tabs = await client.listTabs();
    const activeTab = tabs.find(t => t.active);
    if (!activeTab) {
      throw new Error('没有激活的 Tab');
    }
    return activeTab.id;
  }

  // 数字索引（1-based）
  if (/^\d+$/.test(normalized)) {
    const index = parseInt(normalized, 10) - 1;
    const tabs = await client.listTabs();
    if (index < 0 || index >= tabs.length) {
      throw new Error(`Tab 索引超出范围，当前有 ${tabs.length} 个 Tab`);
    }
    return tabs[index].id;
  }

  // 如果是完整的 Tab ID 格式，直接返回
  if (input.startsWith('tab_')) {
    return input;
  }

  // 模糊匹配
  const tabs = await client.listTabs();

  // 先尝试精确匹配 ID 后缀
  const exactMatch = tabs.find(t => t.id.endsWith(input) || t.id.includes(input));
  if (exactMatch) {
    return exactMatch.id;
  }

  // 再尝试匹配名称（appName 或 title）
  const nameMatch = tabs.find(t =>
    (t.appName && t.appName.toLowerCase().includes(normalized)) ||
    (t.title && t.title.toLowerCase().includes(normalized)) ||
    (t.appId && t.appId.toLowerCase().includes(normalized))
  );
  if (nameMatch) {
    return nameMatch.id;
  }

  // 没找到，返回原始输入（让服务端报错）
  return input;
}

/**
 * 包装 Tab 操作，自动记录最近操作的 Tab
 */
export function withLastTab<T>(tabId: string, fn: () => Promise<T>): Promise<T> {
  return fn().then(result => {
    setLastTab(tabId);
    return result;
  });
}
