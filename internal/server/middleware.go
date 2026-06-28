// SPDX-License-Identifier: Apache-2.0

package server

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/t0mer/brightkids/internal/metrics"
)

// observability logs each request via slog and records Prometheus metrics. It
// uses the matched chi route pattern as the metric label to keep cardinality
// bounded (path params never become distinct label values).
func observability(log *slog.Logger, m *metrics.Metrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			start := time.Now()

			next.ServeHTTP(ww, r)

			dur := time.Since(start)
			route := routePattern(r)
			status := ww.Status()
			if status == 0 {
				status = http.StatusOK
			}

			log.LogAttrs(r.Context(), slog.LevelInfo, "http_request",
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.String("route", route),
				slog.Int("status", status),
				slog.Int("bytes", ww.BytesWritten()),
				slog.Duration("duration", dur),
				slog.String("request_id", middleware.GetReqID(r.Context())),
			)

			if m != nil {
				m.HTTPRequests.WithLabelValues(r.Method, route, strconv.Itoa(status)).Inc()
				m.HTTPRequestDuration.WithLabelValues(route).Observe(dur.Seconds())
			}
		})
	}
}

// routePattern returns the matched chi route pattern, or the raw path when no
// pattern matched (e.g. the SPA fallback).
func routePattern(r *http.Request) string {
	if rctx := chi.RouteContext(r.Context()); rctx != nil {
		if p := rctx.RoutePattern(); p != "" {
			return p
		}
	}
	return "unmatched"
}
