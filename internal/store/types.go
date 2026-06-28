// SPDX-License-Identifier: Apache-2.0

// Package store provides the pure-Go SQLite persistence layer for local
// profiles, progress, and settings. All learning content is read-only and
// served from memory; the store holds only device-local, non-PII data.
package store

import "time"

// Profile is a local, account-free child profile (a name and a picked avatar).
type Profile struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Avatar     string    `json:"avatar"`
	LocalePref string    `json:"locale_pref"`
	CreatedAt  time.Time `json:"created_at"`
}

// Settings are per-profile preferences with sensible defaults.
type Settings struct {
	ProfileID    string `json:"profile_id"`
	SoundEnabled bool   `json:"sound_enabled"`
	VoiceEnabled bool   `json:"voice_enabled"`
	ReduceMotion bool   `json:"reduce_motion"`
	DyslexiaFont bool   `json:"dyslexia_font"`
	UILang       string `json:"ui_lang"`
}

// DefaultSettings returns the settings a new profile starts with.
func DefaultSettings(profileID string) Settings {
	return Settings{
		ProfileID:    profileID,
		SoundEnabled: true,
		VoiceEnabled: true,
		ReduceMotion: false,
		DyslexiaFont: false,
		UILang:       "he",
	}
}

// Attempt records one lesson completion to be persisted.
type Attempt struct {
	LessonID string `json:"lesson_id"`
	Subject  string `json:"subject"`
	Grade    int    `json:"grade"`
	Stars    int    `json:"stars"`
}

// LessonProgress is the best result a profile has achieved on a lesson.
type LessonProgress struct {
	LessonID    string    `json:"lesson_id"`
	Subject     string    `json:"subject"`
	Grade       int       `json:"grade"`
	Stars       int       `json:"stars"`
	Attempts    int       `json:"attempts"`
	CompletedAt time.Time `json:"completed_at"`
}

// ProgressSummary aggregates a profile's progress for the rewards screen.
type ProgressSummary struct {
	ProfileID   string           `json:"profile_id"`
	TotalStars  int              `json:"total_stars"`
	Streak      int              `json:"streak"`
	Lessons     []LessonProgress `json:"lessons"`
	CompletedBy map[string]int   `json:"completed_by_subject"`
}
