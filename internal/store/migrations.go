// SPDX-License-Identifier: Apache-2.0

package store

// schema is applied idempotently at Open. SQLite executes these in order.
const schema = `
CREATE TABLE IF NOT EXISTS profiles (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    avatar      TEXT NOT NULL DEFAULT '',
    locale_pref TEXT NOT NULL DEFAULT 'he',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS progress (
    id           TEXT PRIMARY KEY,
    profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject      TEXT NOT NULL,
    grade        INTEGER NOT NULL,
    lesson_id    TEXT NOT NULL,
    stars        INTEGER NOT NULL DEFAULT 0,
    attempts     INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(profile_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_profile ON progress(profile_id);

CREATE TABLE IF NOT EXISTS settings (
    profile_id    TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    sound_enabled INTEGER NOT NULL DEFAULT 1,
    voice_enabled INTEGER NOT NULL DEFAULT 1,
    reduce_motion INTEGER NOT NULL DEFAULT 0,
    dyslexia_font INTEGER NOT NULL DEFAULT 0,
    ui_lang       TEXT NOT NULL DEFAULT 'he'
);

CREATE TABLE IF NOT EXISTS content_meta (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    seeded_version TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO content_meta (id, seeded_version) VALUES (1, '');
`
