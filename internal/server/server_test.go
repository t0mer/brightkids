// SPDX-License-Identifier: Apache-2.0

package server

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
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

func TestSEO(t *testing.T) {
	h := newTestServer(t)

	// robots.txt points to the sitemap on the request's own origin.
	rec, body := doJSON(t, h, http.MethodGet, "/robots.txt", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("robots status %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "text/plain; charset=utf-8" {
		t.Fatalf("robots content-type %q", ct)
	}
	if !bytes.Contains(body, []byte("Sitemap: http://example.com/sitemap.xml")) {
		t.Fatalf("robots missing sitemap line: %s", body)
	}

	// sitemap.xml is well-formed, rooted at the request origin, and lists lessons.
	rec, body = doJSON(t, h, http.MethodGet, "/sitemap.xml", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("sitemap status %d", rec.Code)
	}
	var set struct {
		URLs []struct {
			Loc string `xml:"loc"`
		} `xml:"url"`
	}
	if err := xml.Unmarshal(body, &set); err != nil {
		t.Fatalf("sitemap not well-formed: %v", err)
	}
	var home, lesson bool
	for _, u := range set.URLs {
		switch u.Loc {
		case "http://example.com/":
			home = true
		case "http://example.com/lesson/en-g1-letters-01":
			lesson = true
		}
	}
	if !home || !lesson {
		t.Fatalf("sitemap missing expected urls (home=%v lesson=%v): %s", home, lesson, body)
	}

	// Reverse-proxy headers override the origin.
	req := httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("X-Forwarded-Host", "brightkids.example.org")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if !bytes.Contains(rec.Body.Bytes(), []byte("https://brightkids.example.org/lesson/en-g1-letters-01")) {
		t.Fatalf("sitemap did not honor forwarded headers: %s", rec.Body.Bytes())
	}
}

func TestSEOInjectionPublicMode(t *testing.T) {
	lib, err := content.Load(fstest.MapFS{
		"english/a.yaml": &fstest.MapFile{Data: []byte(lessonYAML)},
	}, "")
	if err != nil {
		t.Fatalf("content.Load: %v", err)
	}
	cfg := config.Config{Log: config.LogConfig{Level: "error", Format: "text"}}
	spaFS := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<!doctype html><html><head><title>BrightKids</title></head><body></body></html>")},
	}
	srv, err := New(Options{
		Config:  config.ServerConfig{Host: "127.0.0.1", Port: 0},
		Mode:    config.ModePublic,
		Log:     cfg.NewLogger(),
		Content: lib,
		SPAFS:   spaFS,
	})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	h := srv.Handler()

	get := func(path string) string {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec.Body.String()
	}

	home := get("/")
	for _, want := range []string{
		`<title>BrightKids - אקדמיית החלל ללמידה</title>`,
		`name="description"`, `name="keywords"`, `name="author" content="Tomer Klein (תומר קליין)"`,
		`property="og:title"`, `property="og:image"`,
		`property="og:image:width" content="1200"`, `property="og:image:height" content="630"`,
		`property="og:url" content="http://example.com/"`,
		`name="twitter:card" content="summary_large_image"`,
	} {
		if !strings.Contains(home, want) {
			t.Errorf("home SEO missing %q", want)
		}
	}

	lesson := get("/lesson/en-g1-letters-01")
	if !strings.Contains(lesson, `property="og:type" content="article"`) {
		t.Errorf("lesson page should be og:type article")
	}
	if !strings.Contains(lesson, "The Letter A") {
		t.Errorf("lesson SEO should include the lesson title")
	}

	// Private mode serves the plain HTML — no injection.
	priv := get2(t, newTestServer(t), "/")
	if strings.Contains(priv, "og:image") || strings.Contains(priv, "Tomer Klein") {
		t.Errorf("private mode must not inject SEO meta")
	}
}

func TestAnalyticsInjection(t *testing.T) {
	lib, err := content.Load(fstest.MapFS{
		"english/a.yaml": &fstest.MapFile{Data: []byte(lessonYAML)},
	}, "")
	if err != nil {
		t.Fatalf("content.Load: %v", err)
	}
	cfg := config.Config{Log: config.LogConfig{Level: "error", Format: "text"}}
	spaFS := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<!doctype html><html><head><title>BrightKids</title></head><body></body></html>")},
	}
	homeBody := func(mode, ga string) string {
		st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
		if err != nil {
			t.Fatalf("store.Open: %v", err)
		}
		t.Cleanup(func() { _ = st.Close() })
		srv, err := New(Options{
			Config: config.ServerConfig{Host: "127.0.0.1", Port: 0},
			Mode:   mode, GAID: ga, Log: cfg.NewLogger(), Content: lib, Store: st, SPAFS: spaFS,
		})
		if err != nil {
			t.Fatalf("New: %v", err)
		}
		rec := httptest.NewRecorder()
		srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		return rec.Body.String()
	}

	// Enabled — works in any mode, including private.
	on := homeBody(config.ModePrivate, "G-ABC123XYZ")
	if !strings.Contains(on, "googletagmanager.com/gtag/js?id=G-ABC123XYZ") ||
		!strings.Contains(on, "gtag('config', 'G-ABC123XYZ')") {
		t.Errorf("GA snippet missing when enabled:\n%s", on)
	}
	// Disabled (no id) — no analytics.
	if off := homeBody(config.ModePrivate, ""); strings.Contains(off, "googletagmanager.com") {
		t.Errorf("GA snippet present when disabled")
	}
	// Invalid id — ignored (no injection of an unsafe value).
	if bad := homeBody(config.ModePrivate, `x"></script><script>alert(1)`); strings.Contains(bad, "googletagmanager.com") || strings.Contains(bad, "alert(1)") {
		t.Errorf("invalid GA id should be ignored")
	}
}

func TestConfigEndpointTTS(t *testing.T) {
	lib, err := content.Load(fstest.MapFS{
		"english/a.yaml": &fstest.MapFile{Data: []byte(lessonYAML)},
	}, "")
	if err != nil {
		t.Fatalf("content.Load: %v", err)
	}
	cfg := config.Config{Log: config.LogConfig{Level: "error", Format: "text"}}
	spaFS := fstest.MapFS{"index.html": &fstest.MapFile{Data: []byte("<html><head><title>BK</title></head></html>")}}

	cfgJSON := func(tts bool) (mode string, ttsOut bool) {
		st, err := store.Open(filepath.Join(t.TempDir(), "t.db"))
		if err != nil {
			t.Fatalf("store.Open: %v", err)
		}
		t.Cleanup(func() { _ = st.Close() })
		srv, err := New(Options{
			Config:     config.ServerConfig{Host: "127.0.0.1", Port: 0},
			TTSEnabled: tts, Log: cfg.NewLogger(), Content: lib, Store: st, SPAFS: spaFS,
		})
		if err != nil {
			t.Fatalf("New: %v", err)
		}
		rec := httptest.NewRecorder()
		srv.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/config", nil))
		var c struct {
			Mode string `json:"mode"`
			TTS  bool   `json:"tts"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &c); err != nil {
			t.Fatalf("config json: %v (%s)", err, rec.Body.Bytes())
		}
		return c.Mode, c.TTS
	}

	if _, ttsOut := cfgJSON(false); ttsOut {
		t.Errorf("tts should default off")
	}
	if mode, ttsOut := cfgJSON(true); !ttsOut || mode != "private" {
		t.Errorf("tts should be on when enabled (mode=%q tts=%v)", mode, ttsOut)
	}
}

func get2(t *testing.T, h http.Handler, path string) string {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Body.String()
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
	if rec.Code != http.StatusOK {
		t.Fatalf("get settings status %d", rec.Code)
	}
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
