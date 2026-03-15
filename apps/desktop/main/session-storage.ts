/**
 * Session 存储管理
 * 持久化保存用户的浏览器会话配置
 */
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { Session, SessionStorage } from './types/session';

const STORAGE_FILE = 'sessions.json';
const CURRENT_VERSION = 1;

function getStoragePath(): string {
  return path.join(app.getPath('userData'), STORAGE_FILE);
}

/**
 * 读取所有 Session
 */
export function getAllSessions(): Session[] {
  try {
    const filePath = getStoragePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    const storage: SessionStorage = JSON.parse(data);
    return storage.sessions.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch (error) {
    console.error('[SessionStorage] 读取失败:', error);
    return [];
  }
}

/**
 * 根据 ID 获取 Session
 */
export function getSessionById(sessionId: string): Session | null {
  const sessions = getAllSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * 保存 Session
 */
export function saveSession(session: Partial<Session> & { id: string; name: string; url: string }): Session {
  const sessions = getAllSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);

  const now = Date.now();
  let savedSession: Session;

  if (existingIndex >= 0) {
    // 更新现有 Session
    savedSession = {
      ...sessions[existingIndex],
      ...session,
      lastUsedAt: now,
    };
    sessions[existingIndex] = savedSession;
  } else {
    // 创建新 Session
    savedSession = {
      id: session.id,
      name: session.name,
      url: session.url,
      icon: session.icon,
      color: session.color,
      note: session.note,
      partition: session.partition || `persist:${session.id}`,
      createdAt: now,
      lastUsedAt: now,
    };
    sessions.push(savedSession);
  }

  const storage: SessionStorage = {
    sessions,
    version: CURRENT_VERSION,
  };
  fs.writeFileSync(getStoragePath(), JSON.stringify(storage, null, 2));
  return savedSession;
}

/**
 * 删除 Session
 */
export function deleteSession(sessionId: string): boolean {
  const sessions = getAllSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  if (filtered.length === sessions.length) {
    return false;
  }

  const storage: SessionStorage = {
    sessions: filtered,
    version: CURRENT_VERSION,
  };
  fs.writeFileSync(getStoragePath(), JSON.stringify(storage, null, 2));
  return true;
}

/**
 * 更新最后使用时间
 */
export function updateLastUsed(sessionId: string): void {
  const sessions = getAllSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.lastUsedAt = Date.now();
    const storage: SessionStorage = {
      sessions,
      version: CURRENT_VERSION,
    };
    fs.writeFileSync(getStoragePath(), JSON.stringify(storage, null, 2));
  }
}

/**
 * 生成唯一的 Session ID
 */
export function generateSessionId(baseName: string): string {
  const sessions = getAllSessions();
  const base = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'session';

  let id = base;
  let counter = 1;
  while (sessions.some(s => s.id === id)) {
    id = `${base}_${counter}`;
    counter++;
  }
  return id;
}

/**
 * 获取 Session 的缓存目录路径
 */
export function getSessionCachePath(sessionId: string): string {
  return path.join(app.getPath('userData'), 'Partitions', sessionId);
}
