// SPDX-License-Identifier: Apache-2.0

package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/t0mer/brightkids/internal/server/handlers"
)

// routes builds the chi router with middleware, the JSON API, metrics/health
// probes, and the SPA fallback.
func (s *Server) routes() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(observability(s.log, s.metrics))
	r.Use(middleware.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	h := &handlers.Deps{
		Log:     s.log,
		Content: s.content,
		Store:   s.store,
		Metrics: s.metrics,
	}

	// Probes.
	r.Get("/healthz", h.Healthz)
	r.Get("/readyz", h.Readyz)

	// Metrics (optional).
	if s.metrics != nil {
		r.Handle("/metrics", promhttp.HandlerFor(s.metrics.Registry, promhttp.HandlerOpts{}))
	}

	// JSON API.
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/version", h.Version)
		r.Get("/subjects", h.Subjects)
		r.Get("/lessons", h.Lessons)
		r.Get("/lessons/{id}", h.Lesson)

		r.Route("/profiles", func(r chi.Router) {
			r.Get("/", h.ListProfiles)
			r.Post("/", h.CreateProfile)
			r.Delete("/{id}", h.DeleteProfile)
			r.Get("/{id}/progress", h.GetProgress)
			r.Post("/{id}/progress", h.RecordProgress)
			r.Get("/{id}/settings", h.GetSettings)
			r.Put("/{id}/settings", h.UpdateSettings)
		})
	})

	// Unknown API routes return JSON 404, not the SPA.
	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		if len(req.URL.Path) >= 4 && req.URL.Path[:4] == "/api" {
			http.Error(w, `{"error":"not found"}`, http.StatusNotFound)
			return
		}
		s.spa.ServeHTTP(w, req)
	})

	return r
}
