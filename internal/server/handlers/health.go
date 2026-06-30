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

// Readyz handles GET /readyz (readiness): 200 only when content is loaded and,
// in private mode, the DB is reachable. Public mode has no database.
func (d *Deps) Readyz(w http.ResponseWriter, r *http.Request) {
	if d.Content == nil || d.Content.Count() == 0 {
		writeError(w, http.StatusServiceUnavailable, "content not loaded")
		return
	}
	if d.Store != nil {
		if err := d.Store.Ping(); err != nil {
			writeError(w, http.StatusServiceUnavailable, "database not ready")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ready",
		"mode":    d.storageMode(),
		"lessons": d.Content.Count(),
		"content": d.Content.Version(),
		"version": version.Version,
	})
}

// Config handles GET /api/v1/config: the client-visible runtime configuration.
// The SPA reads `mode` to decide whether profiles persist on the server
// (private) or in the browser's localStorage (public).
func (d *Deps) Config(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"mode": d.storageMode()})
}

// storageMode normalizes the mode, defaulting to private.
func (d *Deps) storageMode() string {
	if d.Mode == "public" {
		return "public"
	}
	return "private"
}

// Version handles GET /api/v1/version.
func (d *Deps) Version(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, version.Get())
}
