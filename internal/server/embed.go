// SPDX-License-Identifier: Apache-2.0

package server

import (
	"embed"
	"io/fs"
)

// distFS holds the built SPA. The `all:` prefix includes dotfiles so the embed
// compiles against the tracked .gitkeep placeholder before any frontend build.
//
//go:embed all:dist
var distFS embed.FS

// SPA returns the built single-page app filesystem rooted at dist/.
func SPA() (fs.FS, error) {
	return fs.Sub(distFS, "dist")
}
