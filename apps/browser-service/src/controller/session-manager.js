"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
/**
 * Session 管理器
 * 负责管理 Tab 的会话状态、Cookies、LocalStorage 等
 */
class SessionManager {
    sessions = new Map();
    profiles = new Map();
    createSession(tabId, profileId) {
        const session = {
            id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tabId,
            profileId,
        };
        this.sessions.set(tabId, session);
        return session;
    }
    getSession(tabId) {
        return this.sessions.get(tabId);
    }
    deleteSession(tabId) {
        return this.sessions.delete(tabId);
    }
    createProfile(name, config) {
        const profile = {
            id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            ...config,
        };
        this.profiles.set(profile.id, profile);
        return profile;
    }
    getProfile(profileId) {
        return this.profiles.get(profileId);
    }
}
exports.SessionManager = SessionManager;
