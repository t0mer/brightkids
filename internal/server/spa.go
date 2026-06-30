// SPDX-License-Identifier: Apache-2.0

package server

import (
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// spaHandler serves the embedded SPA. Real files are served directly; any other
// path falls back to index.html so client-side routing works on deep links.
// Requests for missing asset-looking paths (with an extension) return 404. The
// optional transform rewrites the served HTML entrypoint per request (used to
// inject per-page SEO meta in public mode).
func spaHandler(spa fs.FS, transform func(*http.Request, []byte) []byte) http.Handler {
	fileServer := http.FileServer(http.FS(spa))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upath := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if upath == "" {
			upath = "index.html"
		}

		// Real static assets (everything but the HTML entrypoint) served directly.
		if upath != "index.html" {
			if f, err := spa.Open(upath); err == nil {
				_ = f.Close()
				setCacheHeaders(w, upath)
				fileServer.ServeHTTP(w, r)
				return
			}
			// Missing file with an extension → genuine 404 (don't mask broken assets).
			if ext := path.Ext(upath); ext != "" {
				http.NotFound(w, r)
				return
			}
		}

		// The homepage, /index.html, or any client route → serve the (optionally
		// SEO-templated) index.html with no-cache so deploys take effect.
		serveIndex(w, r, spa, transform)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, spa fs.FS, transform func(*http.Request, []byte) []byte) {
	index, err := fs.ReadFile(spa, "index.html")
	if err != nil {
		http.Error(w, "SPA not built", http.StatusNotFound)
		return
	}
	if transform != nil {
		index = transform(r, index)
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(index)
}

// setCacheHeaders caches Vite's content-hashed assets aggressively, but never
// the HTML entrypoint.
func setCacheHeaders(w http.ResponseWriter, upath string) {
	if strings.HasPrefix(upath, "assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return
	}
	if strings.HasSuffix(upath, ".html") || upath == "index.html" {
		w.Header().Set("Cache-Control", "no-cache")
	}
}
