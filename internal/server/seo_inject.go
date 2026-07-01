// SPDX-License-Identifier: Apache-2.0

package server

import (
	"fmt"
	"html"
	"net/http"
	"regexp"
	"strings"

	"github.com/t0mer/brightkids/internal/content"
	"github.com/t0mer/brightkids/internal/server/handlers"
)

// Per-page SEO is injected into the served index.html in public mode only, so
// crawlers and social scrapers (which don't run the SPA's JS) see correct
// titles, descriptions, keywords, and Open Graph / Twitter cards.

const (
	seoBrand      = "BrightKids"
	seoAuthor     = "Tomer Klein (תומר קליין)"
	seoTagline    = "אקדמיית החלל ללמידה"
	ogImagePath   = "/og-image.png"
	ogImageW      = "1200"
	ogImageH      = "630"
	seoKeywordsHe = "ברייטקידס, לימוד לילדים, משחקים חינוכיים, עברית, אנגלית, חשבון, " +
		"שלב א, שלב ב, שלב ג, שלב ד, אותיות, ניקוד, קריאה, פונטיקה, " +
		"חיבור, חיסור, כפל, חילוק, שברים, תומר קליין"
	seoKeywordsEn = "BrightKids, kids learning, educational games, Hebrew, English, Math, " +
		"grade 1, grade 2, phonics, letters, reading, addition, subtraction, " +
		"multiplication, division, fractions, Tomer Klein"
)

var (
	titleRe       = regexp.MustCompile(`(?s)<title>.*?</title>`)
	staticDescRe  = regexp.MustCompile(`(?i)\s*<meta\s+name="description"[^>]*>`)
	subjectNameHe = map[string]string{"hebrew": "עברית", "english": "אנגלית", "math": "חשבון"}
	subjectNameEn = map[string]string{"hebrew": "Hebrew", "english": "English", "math": "Math"}
	subjectDescHe = map[string]string{
		"hebrew":  "לומדים עברית: אותיות, ניקוד, מילים נרדפות, הפכים, פעלים וקריאה.",
		"english": "לומדים אנגלית: אותיות, פונטיקה, משפחות מילים, מילות שאלה וקריאה.",
		"math":    "לומדים חשבון: ספירה, השוואה, חיבור, חיסור, כפל, חילוק, שברים וסדר פעולות.",
	}
	subjectDescEn = map[string]string{
		"hebrew":  "Learn Hebrew: letters, vowels, synonyms, opposites, verbs and reading.",
		"english": "Learn English: the alphabet, phonics, word families and reading.",
		"math":    "Learn Math: counting, comparison, the four operations, fractions and order of operations.",
	}
)

type pageSEO struct {
	title    string
	desc     string
	keywords string
	ogType   string
	noindex  bool
}

// seoFor resolves the SEO data for a client route path.
func seoFor(lib *content.Library, p string) pageSEO {
	keywords := seoKeywordsHe + ", " + seoKeywordsEn
	seg := strings.Split(strings.Trim(p, "/"), "/")

	switch {
	case p == "/" || p == "":
		return pageSEO{
			title:    seoBrand + " - " + seoTagline,
			desc:     "ברייטקידס – אקדמיית החלל ללמידה. משחקים חינוכיים אינטראקטיביים בעברית, אנגלית וחשבון לילדים בכיתות א׳–ו׳. | BrightKids – a space academy for learning. Interactive educational games in Hebrew, English and Math for kids in grades 1–6.",
			keywords: keywords,
			ogType:   "website",
		}
	case p == "/subjects":
		return pageSEO{
			title:    "מה לומדים? | " + seoBrand,
			desc:     "בחרו מקצוע: עברית, אנגלית או חשבון – ולמדו תוך כדי משחק. | Pick a subject — Hebrew, English or Math — and learn while you play.",
			keywords: keywords,
			ogType:   "website",
		}
	case p == "/rewards":
		return pageSEO{title: "הכוכבים שלי | " + seoBrand, desc: "הכוכבים, הרצף וההישגים שלי בברייטקידס. | My stars, streak and achievements in BrightKids.", keywords: keywords, ogType: "website", noindex: true}
	case p == "/settings":
		return pageSEO{title: "הגדרות | " + seoBrand, desc: "הגדרות ברייטקידס. | BrightKids settings.", keywords: keywords, ogType: "website", noindex: true}
	case p == "/lesson/flags":
		return pageSEO{
			title: "מי המדינה? משחק דגלים | " + seoBrand,
			desc: "מי המדינה? משחק דגלים לילדים: זהו את המדינה לפי הדגל, מתוך 90 מדינות כולל ישראל. | " +
				"Which Country? A flags game for kids — spot the country by its flag, from 90 countries including Israel.",
			keywords: "מי המדינה, דגלים, משחק דגלים, דגלי העולם, מדינות, גאוגרפיה, לימוד לילדים, ברייטקידס, תומר קליין, " +
				"flags, flag game, world flags, countries, geography, kids learning, BrightKids, Tomer Klein",
			ogType: "website",
		}
	case len(seg) == 4 && seg[0] == "subject" && seg[2] == "grade":
		sub, grade := seg[1], seg[3]
		nameHe, nameEn := subjectNameHe[sub], subjectNameEn[sub]
		if nameHe == "" {
			break
		}
		return pageSEO{
			title:    fmt.Sprintf("%s לשלב %s | %s", nameHe, grade, seoBrand),
			desc:     fmt.Sprintf("%s לשלב %s: תרגול אינטראקטיבי עם משוב מיידי. | %s for stage %s: interactive practice with instant feedback.", nameHe, grade, nameEn, grade),
			keywords: keywords,
			ogType:   "website",
		}
	case len(seg) == 2 && seg[0] == "subject":
		sub := seg[1]
		nameHe := subjectNameHe[sub]
		if nameHe == "" {
			break
		}
		return pageSEO{
			title:    nameHe + " לילדים | " + seoBrand,
			desc:     subjectDescHe[sub] + " | " + subjectDescEn[sub],
			keywords: keywords,
			ogType:   "website",
		}
	case len(seg) == 2 && seg[0] == "lesson":
		if lib != nil {
			if lesson, ok := lib.Lesson(seg[1]); ok {
				nameHe, nameEn := subjectNameHe[lesson.Subject], subjectNameEn[lesson.Subject]
				return pageSEO{
					title:    lesson.Title + " | " + seoBrand,
					desc:     fmt.Sprintf("שיעור “%s” ב%s – משחק לימודי אינטראקטיבי לילדים בברייטקידס. | %s lesson “%s” — an interactive learning game for kids on BrightKids.", lesson.Title, nameHe, nameEn, lesson.Title),
					keywords: keywords,
					ogType:   "article",
				}
			}
		}
	}

	// Default / unknown route → the brand landing card.
	return pageSEO{
		title:    seoBrand + " - " + seoTagline,
		desc:     "ברייטקידס – אקדמיית החלל ללמידה. משחקים חינוכיים בעברית, אנגלית וחשבון לילדים. | BrightKids – educational games in Hebrew, English and Math for kids.",
		keywords: keywords,
		ogType:   "website",
	}
}

// injectSEO rewrites the page <title> and inserts SEO + Open Graph + Twitter
// meta tags into the served index.html for the requested route.
func injectSEO(htmlDoc []byte, lib *content.Library, r *http.Request) []byte {
	seo := seoFor(lib, r.URL.Path)
	base := handlers.RequestBaseURL(r)
	canonical := base + r.URL.Path
	img := base + ogImagePath
	esc := html.EscapeString

	var b strings.Builder
	tag := func(format string, args ...any) {
		fmt.Fprintf(&b, format+"\n    ", args...)
	}
	b.WriteString("\n    ")
	tag(`<meta name="description" content="%s" />`, esc(seo.desc))
	tag(`<meta name="keywords" content="%s" />`, esc(seo.keywords))
	tag(`<meta name="author" content="%s" />`, esc(seoAuthor))
	tag(`<link rel="canonical" href="%s" />`, esc(canonical))
	if seo.noindex {
		tag(`<meta name="robots" content="noindex,follow" />`)
	} else {
		tag(`<meta name="robots" content="index,follow" />`)
	}
	// Open Graph.
	tag(`<meta property="og:type" content="%s" />`, esc(seo.ogType))
	tag(`<meta property="og:site_name" content="%s" />`, seoBrand)
	tag(`<meta property="og:title" content="%s" />`, esc(seo.title))
	tag(`<meta property="og:description" content="%s" />`, esc(seo.desc))
	tag(`<meta property="og:url" content="%s" />`, esc(canonical))
	tag(`<meta property="og:image" content="%s" />`, esc(img))
	tag(`<meta property="og:image:secure_url" content="%s" />`, esc(img))
	tag(`<meta property="og:image:type" content="image/png" />`)
	tag(`<meta property="og:image:width" content="%s" />`, ogImageW)
	tag(`<meta property="og:image:height" content="%s" />`, ogImageH)
	tag(`<meta property="og:image:alt" content="%s" />`, esc(seoBrand+" – "+seoTagline))
	tag(`<meta property="og:locale" content="he_IL" />`)
	tag(`<meta property="og:locale:alternate" content="en_US" />`)
	if seo.ogType == "article" {
		tag(`<meta property="article:author" content="%s" />`, esc(seoAuthor))
	}
	// Twitter card.
	tag(`<meta name="twitter:card" content="summary_large_image" />`)
	tag(`<meta name="twitter:title" content="%s" />`, esc(seo.title))
	tag(`<meta name="twitter:description" content="%s" />`, esc(seo.desc))
	tag(`<meta name="twitter:image" content="%s" />`, esc(img))
	tag(`<meta name="twitter:image:alt" content="%s" />`, esc(seoBrand+" – "+seoTagline))
	tag(`<meta name="twitter:creator" content="%s" />`, esc(seoAuthor))

	out := staticDescRe.ReplaceAllString(string(htmlDoc), "") // drop the page's static description
	out = titleRe.ReplaceAllString(out, "<title>"+esc(seo.title)+"</title>")
	out = strings.Replace(out, "</head>", strings.TrimRight(b.String(), " ")+"</head>", 1)
	return []byte(out)
}
