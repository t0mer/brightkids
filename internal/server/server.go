// SPDX-License-Identifier: Apache-2.0

// Package server wires the chi HTTP server, middleware, JSON API, and the
// embedded SPA, with graceful shutdown.
package server

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"time"

	"github.com/t0mer/brightkids/internal/config"
	"github.com/t0mer/brightkids/internal/content"
	"github.com/t0mer/brightkids/internal/metrics"
	"github.com/t0mer/brightkids/internal/store"
)

// Server holds the HTTP server and its dependencies.
type Server struct {
	cfg     config.ServerConfig
	mode    string
	log     *slog.Logger
	content *content.Library
	store   *store.Store
	metrics *metrics.Metrics
	spa     http.Handler
	http    *http.Server
}

// Options bundles the server dependencies.
type Options struct {
	Config config.ServerConfig
	// Mode is the storage mode ("private" or "public"). Empty defaults to private.
	Mode    string
	Log     *slog.Logger
	Content *content.Library
	// Store may be nil in public mode (the server is then stateless).
	Store   *store.Store
	Metrics *metrics.Metrics
	// SPAFS optionally overrides the embedded SPA filesystem (used in tests).
	SPAFS fs.FS
}

// New constructs a Server. It returns an error if the embedded SPA is missing.
func New(opts Options) (*Server, error) {
	spaFS := opts.SPAFS
	if spaFS == nil {
		var err error
		if spaFS, err = SPA(); err != nil {
			return nil, fmt.Errorf("loading embedded SPA: %w", err)
		}
	}
	mode := opts.Mode
	if mode == "" {
		mode = config.ModePrivate
	}
	s := &Server{
		cfg:     opts.Config,
		mode:    mode,
		log:     opts.Log,
		content: opts.Content,
		store:   opts.Store,
		metrics: opts.Metrics,
		spa:     spaHandler(spaFS),
	}
	s.http = &http.Server{
		Addr:              opts.Config.Addr(),
		Handler:           s.routes(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	return s, nil
}

// Run starts the server and blocks until ctx is cancelled, then gracefully
// shuts down within a timeout.
func (s *Server) Run(ctx context.Context) error {
	errCh := make(chan error, 1)
	go func() {
		s.log.Info("http server listening", "addr", s.cfg.Addr())
		if err := s.http.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	case <-ctx.Done():
		s.log.Info("shutting down http server")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := s.http.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("graceful shutdown: %w", err)
		}
		return nil
	}
}

// Handler exposes the router for testing.
func (s *Server) Handler() http.Handler { return s.http.Handler }
