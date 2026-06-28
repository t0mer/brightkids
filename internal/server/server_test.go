// SPDX-License-Identifier: Apache-2.0

package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/t0mer/brightkids/internal/config"
	"github.com/t0mer/brightkids/internal/content"
	"github.com/t0mer/brightkids/internal/store"
)

const lessonYAML = `
id: en-g1-letters-01
subject: english
grade: 1
difficulty: 1
locale: en-US
direction: ltr
title: "The Letter A"
activity: letter-recognition
prompt_tts: "Find the letter A"
items:
  - id: a
    label: "A"
    correct: true
  - id: b
    label: "B"
reward: { stars: 1, sfx: ding, effect: confetti }
`

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	lib, err := content.Load(fstest.MapFS{
		"english/a.yaml": &fstest.MapFile{Data: []byte(lessonYAML)},
	}, "")
	if err != nil {
		t.Fatalf("content.Load: %v", err)
	}
	st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	t.Cleanup(func() { _ = st.Close() })

	cfg := config.Config{Log: config.LogConfig{Level: "error", Format: "text"}}
	logger := cfg.NewLogger()
	spaFS := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<!doctype html><title>BrightKids</title>")},
	}
	srv, err := New(Options{
		Config:  config.ServerConfig{Host: "127.0.0.1", Port: 0},
		Log:     logger,
		Content: lib,
		Store:   st,
		Metrics: nil,
		SPAFS:   spaFS,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return srv.Handler()
}

func doJSON(t *testing.T, h http.Handler, method, path string, body any) (*httptest.ResponseRecorder, []byte) {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec, rec.Body.Bytes()
}

func TestHealthAndReady(t *testing.T) {
	h := newTestServer(t)
	rec, _ := doJSON(t, h, http.MethodGet, "/healthz", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("healthz status %d", rec.Code)
	}
	rec, _ = doJSON(t, h, http.MethodGet, "/readyz", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("readyz status %d", rec.Code)
	}
}

func TestSubjectsAndLessons(t *testing.T) {
	h := newTestServer(t)

	rec, body := doJSON(t, h, http.MethodGet, "/api/v1/subjects", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("subjects status %d", rec.Code)
	}
	var subjects []content.SubjectSummary
	if err := json.Unmarshal(body, &subjects); err != nil || len(subjects) != 1 {
		t.Fatalf("subjects: %v %s", err, body)
	}

	rec, body = doJSON(t, h, http.MethodGet, "/api/v1/lessons?subject=english&grade=1", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("lessons status %d", rec.Code)
	}
	var lessons []content.LessonSummary
	if err := json.Unmarshal(body, &lessons); err != nil || len(lessons) != 1 {
		t.Fatalf("lessons: %v %s", err, body)
	}

	rec, body = doJSON(t, h, http.MethodGet, "/api/v1/lessons/en-g1-letters-01", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("lesson status %d", rec.Code)
	}
	var lesson content.Lesson
	if err := json.Unmarshal(body, &lesson); err != nil || lesson.ID != "en-g1-letters-01" {
		t.Fatalf("lesson: %v %s", err, body)
	}

	rec, _ = doJSON(t, h, http.MethodGet, "/api/v1/lessons/missing", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("missing lesson want 404, got %d", rec.Code)
	}
}

func TestProfileProgressFlow(t *testing.T) {
	h := newTestServer(t)

	// Create profile.
	rec, body := doJSON(t, h, http.MethodPost, "/api/v1/profiles", map[string]string{
		"name": "Maya", "avatar": "fox", "locale_pref": "en",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create profile status %d: %s", rec.Code, body)
	}
	var profile store.Profile
	if err := json.Unmarshal(body, &profile); err != nil || profile.ID == "" {
		t.Fatalf("profile: %v %s", err, body)
	}

	// Record progress on a known lesson.
	rec, body = doJSON(t, h, http.MethodPost, "/api/v1/profiles/"+profile.ID+"/progress", map[string]any{
		"lesson_id": "en-g1-letters-01", "stars": 3,
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("record progress status %d: %s", rec.Code, body)
	}

	// Unknown lesson rejected.
	rec, _ = doJSON(t, h, http.MethodPost, "/api/v1/profiles/"+profile.ID+"/progress", map[string]any{
		"lesson_id": "nope", "stars": 1,
	})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown lesson want 400, got %d", rec.Code)
	}

	// Progress summary.
	rec, body = doJSON(t, h, http.MethodGet, "/api/v1/profiles/"+profile.ID+"/progress", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("get progress status %d", rec.Code)
	}
	var sum store.ProgressSummary
	if err := json.Unmarshal(body, &sum); err != nil || sum.TotalStars != 3 {
		t.Fatalf("progress: %v %s", err, body)
	}

	// Settings round-trip.
	rec, _ = doJSON(t, h, http.MethodPut, "/api/v1/profiles/"+profile.ID+"/settings", map[string]any{
		"sound_enabled": false, "voice_enabled": true, "reduce_motion": true,
		"dyslexia_font": true, "ui_lang": "en",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("update settings status %d", rec.Code)
	}
	rec, body = doJSON(t, h, http.MethodGet, "/api/v1/profiles/"+profile.ID+"/settings", nil)
	var set store.Settings
	if err := json.Unmarshal(body, &set); err != nil || set.SoundEnabled || !set.DyslexiaFont {
		t.Fatalf("settings: %v %s", err, body)
	}

	// Delete.
	rec, _ = doJSON(t, h, http.MethodDelete, "/api/v1/profiles/"+profile.ID, nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete status %d", rec.Code)
	}
	rec, _ = doJSON(t, h, http.MethodGet, "/api/v1/profiles/"+profile.ID+"/progress", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("deleted profile progress want 404, got %d", rec.Code)
	}
}

func TestUnknownAPIRouteIs404JSON(t *testing.T) {
	h := newTestServer(t)
	rec, _ := doJSON(t, h, http.MethodGet, "/api/v1/nope", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
}

func TestSPAFallbackServesIndex(t *testing.T) {
	h := newTestServer(t)
	// A client route (no extension) should fall back to index.html (200) rather
	// than 404. The embedded placeholder index is enough for this assertion.
	rec, _ := doJSON(t, h, http.MethodGet, "/subject/english", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("SPA fallback want 200, got %d", rec.Code)
	}
}
