// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/t0mer/brightkids/internal/store"
)

// GetProgress handles GET /api/v1/profiles/{id}/progress.
func (d *Deps) GetProgress(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	sum, err := d.Store.GetProgress(id)
	if err != nil {
		d.handleStoreErr(w, err, "could not load progress")
		return
	}
	writeJSON(w, http.StatusOK, sum)
}

type recordProgressReq struct {
	LessonID string `json:"lesson_id"`
	Stars    int    `json:"stars"`
}

// RecordProgress handles POST /api/v1/profiles/{id}/progress. The subject and
// grade are resolved from the canonical content library, not trusted from the
// client.
func (d *Deps) RecordProgress(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req recordProgressReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	lesson, ok := d.Content.Lesson(req.LessonID)
	if !ok {
		writeError(w, http.StatusBadRequest, "unknown lesson_id")
		return
	}
	lp, err := d.Store.RecordAttempt(id, store.Attempt{
		LessonID: lesson.ID,
		Subject:  lesson.Subject,
		Grade:    lesson.Grade,
		Stars:    req.Stars,
	})
	if err != nil {
		d.handleStoreErr(w, err, "could not record progress")
		return
	}
	if d.Metrics != nil {
		d.Metrics.LessonsCompleted.WithLabelValues(lesson.Subject, strconv.Itoa(lesson.Grade)).Inc()
	}
	writeJSON(w, http.StatusCreated, lp)
}

// GetSettings handles GET /api/v1/profiles/{id}/settings.
func (d *Deps) GetSettings(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	set, err := d.Store.GetSettings(id)
	if err != nil {
		d.handleStoreErr(w, err, "could not load settings")
		return
	}
	writeJSON(w, http.StatusOK, set)
}

type updateSettingsReq struct {
	SoundEnabled bool   `json:"sound_enabled"`
	VoiceEnabled bool   `json:"voice_enabled"`
	ReduceMotion bool   `json:"reduce_motion"`
	DyslexiaFont bool   `json:"dyslexia_font"`
	UILang       string `json:"ui_lang"`
}

// UpdateSettings handles PUT /api/v1/profiles/{id}/settings.
func (d *Deps) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req updateSettingsReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	set, err := d.Store.UpdateSettings(store.Settings{
		ProfileID:    id,
		SoundEnabled: req.SoundEnabled,
		VoiceEnabled: req.VoiceEnabled,
		ReduceMotion: req.ReduceMotion,
		DyslexiaFont: req.DyslexiaFont,
		UILang:       req.UILang,
	})
	if err != nil {
		d.handleStoreErr(w, err, "could not update settings")
		return
	}
	writeJSON(w, http.StatusOK, set)
}

func (d *Deps) handleStoreErr(w http.ResponseWriter, err error, fallback string) {
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "profile not found")
		return
	}
	d.Log.Error(fallback, "err", err)
	writeError(w, http.StatusInternalServerError, fallback)
}
