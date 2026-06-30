// Mode-aware data layer for profiles, progress, and settings. In "private"
// (self-hosted) mode these are persisted server-side via the REST API; in
// "public" mode they live only in the browser's localStorage. The mode is
// resolved once from GET /api/v1/config and cached.

import { api } from "./api";
import * as local from "./localData";
import { loadConfig, type AppMode } from "./appConfig";
import type { Profile, ProgressSummary, Settings, Subject } from "./types";

export type { AppMode };

/** appMode resolves (and caches) the server's storage mode, defaulting to private. */
export async function appMode(): Promise<AppMode> {
  return (await loadConfig()).mode;
}

async function isPublic(): Promise<boolean> {
  return (await appMode()) === "public";
}

export const data = {
  listProfiles: async (): Promise<Profile[]> =>
    (await isPublic()) ? local.listProfiles() : api.listProfiles(),

  createProfile: async (name: string, avatar: string, localePref: string): Promise<Profile> =>
    (await isPublic())
      ? local.createProfile(name, avatar, localePref)
      : api.createProfile(name, avatar, localePref),

  deleteProfile: async (id: string): Promise<void> =>
    (await isPublic()) ? local.deleteProfile(id) : api.deleteProfile(id),

  progress: async (id: string): Promise<ProgressSummary> =>
    (await isPublic()) ? local.progress(id) : api.progress(id),

  // subject/grade are used by the local backend (the server derives them from
  // the canonical content library and ignores them).
  recordProgress: async (id: string, lessonId: string, stars: number, subject: Subject, grade: number) =>
    (await isPublic())
      ? local.recordProgress(id, lessonId, stars, subject, grade)
      : api.recordProgress(id, lessonId, stars),

  getSettings: async (id: string): Promise<Settings> =>
    (await isPublic()) ? local.getSettings(id) : api.getSettings(id),

  updateSettings: async (s: Settings): Promise<Settings> =>
    (await isPublic()) ? local.updateSettings(s) : api.updateSettings(s),
};
