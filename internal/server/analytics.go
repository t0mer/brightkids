// SPDX-License-Identifier: Apache-2.0

package server

import (
	"regexp"
	"strings"
)

// gaIDRe matches Google tag/measurement IDs (G-…, UA-…-…, GTM-…, AW-…). It also
// guards against injection: the configured value is only ever embedded verbatim
// into the page when it matches this safe charset.
var gaIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{2,40}$`)

// validGAID reports whether id is a well-formed, safe-to-embed analytics ID.
func validGAID(id string) bool { return gaIDRe.MatchString(id) }

// injectGA inserts the Google Analytics (gtag.js) snippet into the page <head>.
// The id is validated against gaIDRe before this is called, so it is safe to
// embed directly.
func injectGA(doc []byte, id string) []byte {
	snippet := "\n    <!-- Google tag (gtag.js) -->\n" +
		`    <script async src="https://www.googletagmanager.com/gtag/js?id=` + id + `"></script>` + "\n" +
		"    <script>\n" +
		"      window.dataLayer = window.dataLayer || [];\n" +
		"      function gtag(){dataLayer.push(arguments);}\n" +
		"      gtag('js', new Date());\n" +
		"      gtag('config', '" + id + "');\n" +
		"    </script>\n  "
	return []byte(strings.Replace(string(doc), "</head>", snippet+"</head>", 1))
}
