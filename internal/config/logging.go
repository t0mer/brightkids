// SPDX-License-Identifier: Apache-2.0

package config

import (
	"log/slog"
	"os"
)

// NewLogger builds a slog.Logger honouring the configured level and format.
// Format "json" is intended for production; "text" for local development.
func (c *Config) NewLogger() *slog.Logger {
	opts := &slog.HandlerOptions{Level: c.slogLevel()}

	var handler slog.Handler
	if c.Log.Format == "text" {
		handler = slog.NewTextHandler(os.Stdout, opts)
	} else {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	}
	return slog.New(handler)
}

func (c *Config) slogLevel() slog.Level {
	switch c.Log.Level {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
