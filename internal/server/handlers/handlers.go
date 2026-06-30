// SPDX-License-Identifier: Apache-2.0

// Package handlers implements the BrightKids JSON API endpoints.
package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/t0mer/brightkids/internal/content"
	"github.com/t0mer/brightkids/internal/metrics"
	"github.com/t0mer/brightkids/internal/store"
)

// Deps carries the dependencies shared by all handlers.
type Deps struct {
	Log *slog.Logger
	// Mode is the storage mode ("private" or "public"); reported to the client
	// so it knows whether to persist profiles server-side or in localStorage.
	Mode string
	// TTSEnabled reports whether text-to-speech narration is enabled; the client
	// hides the Listen button and skips narration when false.
	TTSEnabled bool
	Content    *content.Library
	// Store is nil in public mode (no server-side persistence).
	Store   *store.Store
	Metrics *metrics.Metrics
}

// errorBody is the standard error envelope.
type errorBody struct {
	Error string `json:"error"`
}

// writeJSON encodes v as JSON with the given status.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// writeError writes a JSON error envelope.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorBody{Error: msg})
}

// decodeJSON decodes a request body into v, rejecting unknown fields.
func decodeJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}
