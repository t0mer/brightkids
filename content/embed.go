// SPDX-License-Identifier: Apache-2.0

// Package content embeds the read-only lesson YAML shipped inside the binary.
// The loader lives in internal/content; this package only exposes the FS so the
// embed directive can reach the YAML at the repository root.
package content

import "embed"

// FS holds every lesson YAML, organised by subject directory. The `all:` prefix
// includes the .gitkeep placeholder so an empty subject directory (e.g. math,
// when its content is cleared) still compiles; the loader only reads *.yaml.
//
//go:embed all:hebrew all:english all:math
var FS embed.FS
