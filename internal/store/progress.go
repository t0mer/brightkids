// SPDX-License-Identifier: Apache-2.0

package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RecordAttempt upserts a lesson result for a profile. Attempts increment on
// every call; the best (highest) star count is retained. Returns the resulting
// per-lesson progress row.
func (s *Store) RecordAttempt(profileID string, a Attempt) (LessonProgress, error) {
	if _, err := s.GetProfile(profileID); err != nil {
		return LessonProgress{}, err
	}
	if a.Stars < 0 {
		a.Stars = 0
	}
	now := time.Now().UTC()

	// Upsert: keep max(stars), bump attempts, refresh completed_at.
	_, err := s.db.Exec(`
		INSERT INTO progress (id, profile_id, subject, grade, lesson_id, stars, attempts, completed_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?)
		ON CONFLICT(profile_id, lesson_id) DO UPDATE SET
			stars        = MAX(progress.stars, excluded.stars),
			attempts     = progress.attempts + 1,
			completed_at = excluded.completed_at`,
		uuid.NewString(), profileID, a.Subject, a.Grade, a.LessonID, a.Stars, fmtTS(now),
	)
	if err != nil {
		return LessonProgress{}, fmt.Errorf("recording attempt: %w", err)
	}

	var lp LessonProgress
	var completed string
	err = s.db.QueryRow(`
		SELECT lesson_id, subject, grade, stars, attempts, completed_at
		FROM progress WHERE profile_id = ? AND lesson_id = ?`,
		profileID, a.LessonID,
	).Scan(&lp.LessonID, &lp.Subject, &lp.Grade, &lp.Stars, &lp.Attempts, &completed)
	if err != nil {
		return LessonProgress{}, fmt.Errorf("reading recorded attempt: %w", err)
	}
	lp.CompletedAt = parseTS(completed)
	return lp, nil
}

// GetProgress aggregates a profile's progress, total stars, and current daily
// streak.
func (s *Store) GetProgress(profileID string) (ProgressSummary, error) {
	if _, err := s.GetProfile(profileID); err != nil {
		return ProgressSummary{}, err
	}

	rows, err := s.db.Query(`
		SELECT lesson_id, subject, grade, stars, attempts, completed_at
		FROM progress WHERE profile_id = ?
		ORDER BY completed_at DESC`, profileID)
	if err != nil {
		return ProgressSummary{}, fmt.Errorf("querying progress: %w", err)
	}
	defer rows.Close()

	summary := ProgressSummary{
		ProfileID:   profileID,
		Lessons:     make([]LessonProgress, 0),
		CompletedBy: make(map[string]int),
	}
	for rows.Next() {
		var lp LessonProgress
		var completed string
		if err := rows.Scan(&lp.LessonID, &lp.Subject, &lp.Grade, &lp.Stars, &lp.Attempts, &completed); err != nil {
			return ProgressSummary{}, err
		}
		lp.CompletedAt = parseTS(completed)
		summary.Lessons = append(summary.Lessons, lp)
		summary.TotalStars += lp.Stars
		summary.CompletedBy[lp.Subject]++
	}
	if err := rows.Err(); err != nil {
		return ProgressSummary{}, err
	}

	streak, err := s.dailyStreak(profileID)
	if err != nil {
		return ProgressSummary{}, err
	}
	summary.Streak = streak
	return summary, nil
}

// dailyStreak counts consecutive calendar days (ending today or yesterday) with
// at least one completion.
func (s *Store) dailyStreak(profileID string) (int, error) {
	rows, err := s.db.Query(`
		SELECT DISTINCT date(completed_at) FROM progress
		WHERE profile_id = ? ORDER BY date(completed_at) DESC`, profileID)
	if err != nil {
		return 0, fmt.Errorf("querying streak: %w", err)
	}
	defer rows.Close()

	var days []time.Time
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return 0, err
		}
		t, perr := time.Parse("2006-01-02", d)
		if perr != nil {
			continue
		}
		days = append(days, t)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if len(days) == 0 {
		return 0, nil
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	// Allow the streak to "start" today or yesterday so an unfinished today
	// doesn't reset a run.
	gap := today.Sub(days[0])
	if gap > 48*time.Hour {
		return 0, nil
	}
	streak := 1
	for i := 1; i < len(days); i++ {
		if days[i-1].Sub(days[i]) == 24*time.Hour {
			streak++
		} else {
			break
		}
	}
	return streak, nil
}

// GetSettings returns a profile's settings, falling back to defaults if absent.
func (s *Store) GetSettings(profileID string) (Settings, error) {
	if _, err := s.GetProfile(profileID); err != nil {
		return Settings{}, err
	}
	var set Settings
	var sound, voice, motion, dys int
	err := s.db.QueryRow(`
		SELECT profile_id, sound_enabled, voice_enabled, reduce_motion, dyslexia_font, ui_lang
		FROM settings WHERE profile_id = ?`, profileID,
	).Scan(&set.ProfileID, &sound, &voice, &motion, &dys, &set.UILang)
	if errors.Is(err, sql.ErrNoRows) {
		return DefaultSettings(profileID), nil
	}
	if err != nil {
		return Settings{}, fmt.Errorf("getting settings: %w", err)
	}
	set.SoundEnabled = sound != 0
	set.VoiceEnabled = voice != 0
	set.ReduceMotion = motion != 0
	set.DyslexiaFont = dys != 0
	return set, nil
}

// UpdateSettings persists a profile's settings.
func (s *Store) UpdateSettings(set Settings) (Settings, error) {
	if _, err := s.GetProfile(set.ProfileID); err != nil {
		return Settings{}, err
	}
	if set.UILang == "" {
		set.UILang = "he"
	}
	_, err := s.db.Exec(`
		INSERT INTO settings (profile_id, sound_enabled, voice_enabled, reduce_motion, dyslexia_font, ui_lang)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(profile_id) DO UPDATE SET
			sound_enabled = excluded.sound_enabled,
			voice_enabled = excluded.voice_enabled,
			reduce_motion = excluded.reduce_motion,
			dyslexia_font = excluded.dyslexia_font,
			ui_lang       = excluded.ui_lang`,
		set.ProfileID, b2i(set.SoundEnabled), b2i(set.VoiceEnabled),
		b2i(set.ReduceMotion), b2i(set.DyslexiaFont), set.UILang,
	)
	if err != nil {
		return Settings{}, fmt.Errorf("updating settings: %w", err)
	}
	return set, nil
}
