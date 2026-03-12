import type { Session, Profile } from '@qiyi/shared';

/**
 * Manages sessions and profiles for application tabs.
 *
 * This class provides methods to create, retrieve, and delete sessions
 * associated with specific tab IDs. It also allows for the creation and
 * retrieval of profiles that can be optionally linked to sessions.
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private profiles: Map<string, Profile> = new Map();

  createSession(tabId: string, profileId?: string): Session {
    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tabId,
      profileId,
    };

    this.sessions.set(tabId, session);
    return session;
  }

  getSession(tabId: string): Session | undefined {
    return this.sessions.get(tabId);
  }

  deleteSession(tabId: string): boolean {
    return this.sessions.delete(tabId);
  }

  createProfile(name: string, config?: Partial<Profile>): Profile {
    const profile: Profile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      ...config,
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  getProfile(profileId: string): Profile | undefined {
    return this.profiles.get(profileId);
  }
}

