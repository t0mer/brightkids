// SPDX-License-Identifier: Apache-2.0

// Package content embeds the read-only lesson YAML shipped inside the binary.
// The loader lives in internal/content; this package only exposes the FS so
// go:embed can reach the YAML at the repository root.
package content

import "embed"

// FS holds every lesson YAML, organised by subject directory.
//
//go:embed hebrew english math
var FS embed.FS
