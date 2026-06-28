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
// Requests for missing asset-looking paths (with an extension) return 404.
func spaHandler(spa fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(spa))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		upath := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if upath == "" {
			upath = "index.html"
		}

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

		// Client route → serve index.html (no cache, so deploys take effect).
		serveIndex(w, r, spa)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, spa fs.FS) {
	index, err := fs.ReadFile(spa, "index.html")
	if err != nil {
		http.Error(w, "SPA not built", http.StatusNotFound)
		return
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
