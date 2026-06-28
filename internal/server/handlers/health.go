// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"net/http"

	"github.com/t0mer/brightkids/internal/version"
)

// Healthz handles GET /healthz (liveness): always 200 while the process runs.
func (d *Deps) Healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"version": version.Version,
	})
}

// Readyz handles GET /readyz (readiness): 200 only when the DB is reachable and
// content is loaded.
func (d *Deps) Readyz(w http.ResponseWriter, r *http.Request) {
	if d.Content == nil || d.Content.Count() == 0 {
		writeError(w, http.StatusServiceUnavailable, "content not loaded")
		return
	}
	if err := d.Store.Ping(); err != nil {
		writeError(w, http.StatusServiceUnavailable, "database not ready")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ready",
		"lessons": d.Content.Count(),
		"content": d.Content.Version(),
		"version": version.Version,
	})
}

// Version handles GET /api/v1/version.
func (d *Deps) Version(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, version.Get())
}
