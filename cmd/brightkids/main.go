// SPDX-License-Identifier: Apache-2.0

// Command brightkids serves the BrightKids learning app: an embedded SPA, a
// small JSON API, and Prometheus metrics, backed by pure-Go SQLite.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/t0mer/brightkids/content"
	"github.com/t0mer/brightkids/internal/config"
	icontent "github.com/t0mer/brightkids/internal/content"
	"github.com/t0mer/brightkids/internal/metrics"
	"github.com/t0mer/brightkids/internal/server"
	"github.com/t0mer/brightkids/internal/store"
	"github.com/t0mer/brightkids/internal/version"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	cfg, showVersion, err := config.Load(args)
	if err != nil {
		return err
	}
	if showVersion {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(version.Get())
	}

	log := cfg.NewLogger()
	log.Info("starting brightkids",
		"version", version.Version,
		"commit", version.Commit,
		"addr", cfg.Server.Addr(),
	)

	// Content (embedded by default; directory override for hot iteration).
	lib, err := icontent.Load(content.FS, cfg.Content.Dir)
	if err != nil {
		return fmt.Errorf("loading content: %w", err)
	}
	log.Info("content loaded", "lessons", lib.Count(), "content_version", lib.Version())

	// Store. In public mode profiles live in the browser, so the server stays
	// stateless and opens no database.
	var st *store.Store
	if cfg.IsPublic() {
		log.Info("public mode: profiles stored in the browser (no database)")
	} else {
		st, err = store.Open(cfg.DB.Path)
		if err != nil {
			return fmt.Errorf("opening store: %w", err)
		}
		defer func() { _ = st.Close() }()

		// Guard re-seed bookkeeping on content version change.
		if err := reconcileContentVersion(st, lib.Version(), log); err != nil {
			return err
		}
	}

	// Metrics.
	var m *metrics.Metrics
	if cfg.Metrics.Enabled {
		m = metrics.New(version.Version, version.Commit)
	}

	srv, err := server.New(server.Options{
		Config:  cfg.Server,
		Mode:    cfg.Mode,
		GAID:    cfg.Analytics.GAID,
		Log:     log,
		Content: lib,
		Store:   st,
		Metrics: m,
	})
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	return srv.Run(ctx)
}

// reconcileContentVersion records the currently-loaded content version, logging
// when it changes between boots.
func reconcileContentVersion(st *store.Store, current string, log *slog.Logger) error {
	prev, err := st.SeededVersion()
	if err != nil {
		return fmt.Errorf("reading seeded version: %w", err)
	}
	if prev != current {
		log.Info("content version changed", "from", prev, "to", current)
		if err := st.SetSeededVersion(current); err != nil {
			return fmt.Errorf("recording content version: %w", err)
		}
	}
	return nil
}
