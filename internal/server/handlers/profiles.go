// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/t0mer/brightkids/internal/store"
)

type createProfileReq struct {
	Name       string `json:"name"`
	Avatar     string `json:"avatar"`
	LocalePref string `json:"locale_pref"`
}

// CreateProfile handles POST /api/v1/profiles.
func (d *Deps) CreateProfile(w http.ResponseWriter, r *http.Request) {
	var req createProfileReq
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	p, err := d.Store.CreateProfile(req.Name, req.Avatar, req.LocalePref)
	if err != nil {
		if errors.Is(err, store.ErrInvalid) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		d.Log.Error("create profile", "err", err)
		writeError(w, http.StatusInternalServerError, "could not create profile")
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

// ListProfiles handles GET /api/v1/profiles.
func (d *Deps) ListProfiles(w http.ResponseWriter, r *http.Request) {
	profiles, err := d.Store.ListProfiles()
	if err != nil {
		d.Log.Error("list profiles", "err", err)
		writeError(w, http.StatusInternalServerError, "could not list profiles")
		return
	}
	writeJSON(w, http.StatusOK, profiles)
}

// DeleteProfile handles DELETE /api/v1/profiles/{id}.
func (d *Deps) DeleteProfile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := d.Store.DeleteProfile(id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "profile not found")
			return
		}
		d.Log.Error("delete profile", "err", err)
		writeError(w, http.StatusInternalServerError, "could not delete profile")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
