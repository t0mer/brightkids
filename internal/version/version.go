// SPDX-License-Identifier: Apache-2.0

// Package version exposes build metadata injected at link time via -ldflags.
package version

import "runtime"

// These variables are overridden at build time with:
//
//	-ldflags "-X github.com/t0mer/brightkids/internal/version.Version=... \
//	          -X github.com/t0mer/brightkids/internal/version.Commit=... \
//	          -X github.com/t0mer/brightkids/internal/version.Date=..."
var (
	// Version is the semantic build version (e.g. v2026.6.0).
	Version = "dev"
	// Commit is the git commit hash the binary was built from.
	Commit = "none"
	// Date is the build timestamp (RFC3339).
	Date = "unknown"
)

// Info bundles build metadata for JSON responses and logging.
type Info struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	Date      string `json:"date"`
	GoVersion string `json:"go_version"`
}

// Get returns the current build information.
func Get() Info {
	return Info{
		Version:   Version,
		Commit:    Commit,
		Date:      Date,
		GoVersion: runtime.Version(),
	}
}
