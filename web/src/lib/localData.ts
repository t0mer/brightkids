// Browser-localStorage implementation of the profile / progress / settings
// backend, used in "public" mode where the server is stateless. Mirrors the
// server's store semantics (best-stars upsert, daily streak, default settings)
// so the UI behaves identically regardless of mode.

import type { LessonProgress, Profile, ProgressSummary, Settings, Subject } from "./types";

const KEY = "brightkids:data";
const DAY_MS = 86_400_000;

interface LocalDB {
  profiles: Profile[];
  progress: Record<string, LessonProgress[]>;
  settings: Record<string, Settings>;
}

function read(): LocalDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<LocalDB>;
      return { profiles: d.profiles ?? [], progress: d.progress ?? {}, settings: d.settings ?? {} };
    }
  } catch {
    /* corrupt/unavailable storage → start fresh */
  }
  return { profiles: [], progress: {}, settings: {} };
}

function write(db: LocalDB): void {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `p-${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`;
}

function defaultSettings(profileId: string): Settings {
  return {
    profile_id: profileId,
    sound_enabled: true,
    voice_enabled: true,
    reduce_motion: false,
    dyslexia_font: false,
    ui_lang: "he",
  };
}

export function listProfiles(): Profile[] {
  return read().profiles;
}

export function createProfile(name: string, avatar: string, localePref: string): Profile {
  const db = read();
  const profile: Profile = {
    id: uuid(),
    name: name.trim() || "★",
    avatar,
    locale_pref: localePref,
    created_at: new Date().toISOString(),
  };
  db.profiles = [profile, ...db.profiles];
  db.settings[profile.id] = defaultSettings(profile.id);
  write(db);
  return profile;
}

export function deleteProfile(id: string): void {
  const db = read();
  db.profiles = db.profiles.filter((p) => p.id !== id);
  delete db.progress[id];
  delete db.settings[id];
  write(db);
}

export function recordProgress(
  profileId: string,
  lessonId: string,
  stars: number,
  subject: Subject,
  grade: number,
): LessonProgress {
  const db = read();
  const rows = db.progress[profileId] ?? [];
  const now = new Date().toISOString();
  const safeStars = Math.max(0, stars);
  const existing = rows.find((r) => r.lesson_id === lessonId);
  let lp: LessonProgress;
  if (existing) {
    existing.stars = Math.max(existing.stars, safeStars);
    existing.attempts += 1;
    existing.completed_at = now;
    lp = existing;
  } else {
    lp = { lesson_id: lessonId, subject, grade, stars: safeStars, attempts: 1, completed_at: now };
    rows.push(lp);
  }
  db.progress[profileId] = rows;
  write(db);
  return lp;
}

export function progress(profileId: string): ProgressSummary {
  const rows = (read().progress[profileId] ?? [])
    .slice()
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const completed_by_subject: Record<string, number> = {};
  let total_stars = 0;
  for (const r of rows) {
    total_stars += r.stars;
    completed_by_subject[r.subject] = (completed_by_subject[r.subject] ?? 0) + 1;
  }
  return { profile_id: profileId, total_stars, streak: dailyStreak(rows), lessons: rows, completed_by_subject };
}

// dailyStreak counts consecutive UTC days (ending today or yesterday) with at
// least one completion — the same rule the server uses.
function dailyStreak(rows: LessonProgress[]): number {
  const days = [...new Set(rows.map((r) => r.completed_at.slice(0, 10)))].sort().reverse();
  if (days.length === 0) return 0;
  const at = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  if (today - at(days[0]) > 2 * DAY_MS) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (at(days[i - 1]) - at(days[i]) === DAY_MS) streak++;
    else break;
  }
  return streak;
}

export function getSettings(profileId: string): Settings {
  return read().settings[profileId] ?? defaultSettings(profileId);
}

export function updateSettings(s: Settings): Settings {
  const db = read();
  const next = { ...s, ui_lang: s.ui_lang || "he" };
  db.settings[s.profile_id] = next;
  write(db);
  return next;
}
