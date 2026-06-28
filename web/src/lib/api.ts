import type {
  Lesson,
  LessonProgress,
  LessonSummary,
  Profile,
  ProgressSummary,
  Settings,
  SubjectSummary,
} from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = `request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  subjects: () => req<SubjectSummary[]>("/api/v1/subjects"),

  lessons: (subject: string, grade: number) =>
    req<LessonSummary[]>(`/api/v1/lessons?subject=${encodeURIComponent(subject)}&grade=${grade}`),

  lesson: (id: string) => req<Lesson>(`/api/v1/lessons/${encodeURIComponent(id)}`),

  listProfiles: () => req<Profile[]>("/api/v1/profiles"),

  createProfile: (name: string, avatar: string, localePref: string) =>
    req<Profile>("/api/v1/profiles", {
      method: "POST",
      body: JSON.stringify({ name, avatar, locale_pref: localePref }),
    }),

  deleteProfile: (id: string) =>
    req<void>(`/api/v1/profiles/${id}`, { method: "DELETE" }),

  progress: (profileId: string) =>
    req<ProgressSummary>(`/api/v1/profiles/${profileId}/progress`),

  recordProgress: (profileId: string, lessonId: string, stars: number) =>
    req<LessonProgress>(`/api/v1/profiles/${profileId}/progress`, {
      method: "POST",
      body: JSON.stringify({ lesson_id: lessonId, stars }),
    }),

  getSettings: (profileId: string) =>
    req<Settings>(`/api/v1/profiles/${profileId}/settings`),

  updateSettings: (s: Settings) =>
    req<Settings>(`/api/v1/profiles/${s.profile_id}/settings`, {
      method: "PUT",
      body: JSON.stringify({
        sound_enabled: s.sound_enabled,
        voice_enabled: s.voice_enabled,
        reduce_motion: s.reduce_motion,
        dyslexia_font: s.dyslexia_font,
        ui_lang: s.ui_lang,
      }),
    }),
};
