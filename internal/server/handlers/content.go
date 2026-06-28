// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// Subjects handles GET /api/v1/subjects.
func (d *Deps) Subjects(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, d.Content.Subjects())
}

// Lessons handles GET /api/v1/lessons?subject=&grade=.
func (d *Deps) Lessons(w http.ResponseWriter, r *http.Request) {
	subject := r.URL.Query().Get("subject")
	grade := 0
	if g := r.URL.Query().Get("grade"); g != "" {
		n, err := strconv.Atoi(g)
		if err != nil || n < 0 {
			writeError(w, http.StatusBadRequest, "grade must be a non-negative integer")
			return
		}
		grade = n
	}
	writeJSON(w, http.StatusOK, d.Content.Lessons(subject, grade))
}

// Lesson handles GET /api/v1/lessons/{id}.
func (d *Deps) Lesson(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	lesson, ok := d.Content.Lesson(id)
	if !ok {
		writeError(w, http.StatusNotFound, "lesson not found")
		return
	}
	writeJSON(w, http.StatusOK, lesson)
}
