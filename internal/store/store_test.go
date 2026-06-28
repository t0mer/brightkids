// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	st, err := Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })
	return st
}

func TestProfileLifecycle(t *testing.T) {
	st := newTestStore(t)

	p, err := st.CreateProfile("  Maya ", "fox", "he")
	if err != nil {
		t.Fatalf("CreateProfile: %v", err)
	}
	if p.Name != "Maya" {
		t.Fatalf("name not trimmed: %q", p.Name)
	}

	got, err := st.GetProfile(p.ID)
	if err != nil || got.ID != p.ID {
		t.Fatalf("GetProfile: %v %+v", err, got)
	}

	// Default settings are created with the profile.
	set, err := st.GetSettings(p.ID)
	if err != nil {
		t.Fatalf("GetSettings: %v", err)
	}
	if !set.SoundEnabled || !set.VoiceEnabled || set.UILang != "he" {
		t.Fatalf("unexpected default settings: %+v", set)
	}

	list, err := st.ListProfiles()
	if err != nil || len(list) != 1 {
		t.Fatalf("ListProfiles: %v len=%d", err, len(list))
	}

	if err := st.DeleteProfile(p.ID); err != nil {
		t.Fatalf("DeleteProfile: %v", err)
	}
	if _, err := st.GetProfile(p.ID); err != ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

func TestCreateProfileRejectsEmptyName(t *testing.T) {
	st := newTestStore(t)
	if _, err := st.CreateProfile("   ", "", ""); err == nil {
		t.Fatal("expected error for empty name")
	}
}

func TestProgressAggregation(t *testing.T) {
	st := newTestStore(t)
	p, _ := st.CreateProfile("Noa", "owl", "en")

	// First attempt: 2 stars.
	if _, err := st.RecordAttempt(p.ID, Attempt{LessonID: "en-g1-letters-01", Subject: "english", Grade: 1, Stars: 2}); err != nil {
		t.Fatalf("RecordAttempt: %v", err)
	}
	// Second attempt on same lesson with more stars: keep max, bump attempts.
	if _, err := st.RecordAttempt(p.ID, Attempt{LessonID: "en-g1-letters-01", Subject: "english", Grade: 1, Stars: 3}); err != nil {
		t.Fatalf("RecordAttempt 2: %v", err)
	}
	// Different lesson.
	if _, err := st.RecordAttempt(p.ID, Attempt{LessonID: "math-g1-counting-01", Subject: "math", Grade: 1, Stars: 1}); err != nil {
		t.Fatalf("RecordAttempt 3: %v", err)
	}

	sum, err := st.GetProgress(p.ID)
	if err != nil {
		t.Fatalf("GetProgress: %v", err)
	}
	if sum.TotalStars != 4 {
		t.Fatalf("want total 4 stars (3+1), got %d", sum.TotalStars)
	}
	if len(sum.Lessons) != 2 {
		t.Fatalf("want 2 lessons, got %d", len(sum.Lessons))
	}
	if sum.CompletedBy["english"] != 1 || sum.CompletedBy["math"] != 1 {
		t.Fatalf("unexpected per-subject counts: %+v", sum.CompletedBy)
	}
	if sum.Streak != 1 {
		t.Fatalf("want streak 1, got %d", sum.Streak)
	}

	// Verify max-stars + attempt count on the repeated lesson.
	var best LessonProgress
	for _, l := range sum.Lessons {
		if l.LessonID == "en-g1-letters-01" {
			best = l
		}
	}
	if best.Stars != 3 || best.Attempts != 2 {
		t.Fatalf("want stars=3 attempts=2, got stars=%d attempts=%d", best.Stars, best.Attempts)
	}
}

func TestSettingsUpdate(t *testing.T) {
	st := newTestStore(t)
	p, _ := st.CreateProfile("Eitan", "robot", "he")

	set, _ := st.GetSettings(p.ID)
	set.DyslexiaFont = true
	set.ReduceMotion = true
	set.UILang = "en"
	if _, err := st.UpdateSettings(set); err != nil {
		t.Fatalf("UpdateSettings: %v", err)
	}
	got, _ := st.GetSettings(p.ID)
	if !got.DyslexiaFont || !got.ReduceMotion || got.UILang != "en" {
		t.Fatalf("settings not persisted: %+v", got)
	}
}

func TestSeededVersion(t *testing.T) {
	st := newTestStore(t)
	v, err := st.SeededVersion()
	if err != nil || v != "" {
		t.Fatalf("initial version: %q %v", v, err)
	}
	if err := st.SetSeededVersion("abc123"); err != nil {
		t.Fatalf("SetSeededVersion: %v", err)
	}
	v, _ = st.SeededVersion()
	if v != "abc123" {
		t.Fatalf("want abc123, got %q", v)
	}
}

func TestProgressUnknownProfile(t *testing.T) {
	st := newTestStore(t)
	if _, err := st.GetProgress("nope"); err != ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}
