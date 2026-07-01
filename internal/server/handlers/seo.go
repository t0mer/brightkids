// SPDX-License-Identifier: Apache-2.0

package handlers

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"strings"
)

// RequestBaseURL derives the public origin (scheme://host) from the incoming
// request, honoring reverse-proxy headers so generated absolute URLs match the
// address the browser actually used.
func RequestBaseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = strings.TrimSpace(strings.Split(proto, ",")[0])
	}
	host := r.Host
	if fwd := r.Header.Get("X-Forwarded-Host"); fwd != "" {
		host = strings.TrimSpace(strings.Split(fwd, ",")[0])
	}
	return scheme + "://" + host
}

// Robots handles GET /robots.txt. It allows crawling of the content pages,
// keeps bots out of the per-child utility routes and the JSON API, and points
// to the sitemap on the same origin the request arrived on.
func (d *Deps) Robots(w http.ResponseWriter, r *http.Request) {
	base := RequestBaseURL(r)
	body := strings.Join([]string{
		"User-agent: *",
		"Allow: /",
		"Disallow: /settings",
		"Disallow: /rewards",
		"Disallow: /api/",
		"",
		"Sitemap: " + base + "/sitemap.xml",
		"",
	}, "\n")
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write([]byte(body))
}

type sitemapURL struct {
	Loc        string `xml:"loc"`
	ChangeFreq string `xml:"changefreq,omitempty"`
	Priority   string `xml:"priority,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

// Sitemap handles GET /sitemap.xml. It enumerates every public page —
// home, the subject pickers, each subject/grade list, and every lesson — as
// absolute URLs rooted at the request's own origin.
func (d *Deps) Sitemap(w http.ResponseWriter, r *http.Request) {
	base := RequestBaseURL(r)
	set := sitemapURLSet{Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9"}
	add := func(path, freq, prio string) {
		set.URLs = append(set.URLs, sitemapURL{Loc: base + path, ChangeFreq: freq, Priority: prio})
	}

	add("/", "weekly", "1.0")
	add("/subjects", "weekly", "0.9")
	if d.Content != nil {
		for _, s := range d.Content.Subjects() {
			add("/subject/"+s.Subject, "weekly", "0.8")
			for _, g := range s.Grades {
				add(fmt.Sprintf("/subject/%s/grade/%d", s.Subject, g), "weekly", "0.7")
				for _, lesson := range d.Content.Lessons(s.Subject, g) {
					add("/lesson/"+lesson.ID, "monthly", "0.6")
				}
			}
		}
		// Top-level hidden games (e.g. the flag game) are public pages too.
		for _, lesson := range d.Content.HiddenLessons() {
			add("/lesson/"+lesson.ID, "weekly", "0.7")
		}
	}

	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	if err := enc.Encode(set); err != nil {
		d.Log.Error("encoding sitemap", "err", err)
	}
	_, _ = w.Write([]byte("\n"))
}
