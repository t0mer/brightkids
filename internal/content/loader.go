// SPDX-License-Identifier: Apache-2.0

package content

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"os"
	"path"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// Library is the validated, in-memory lesson set served to clients. It is
// immutable after Load and safe for concurrent reads.
type Library struct {
	lessons   map[string]Lesson           // id -> lesson
	byGrade   map[string]map[int][]string // subject -> grade -> lesson ids (ordered)
	subjects  []SubjectSummary
	version   string // content hash, used to guard re-seed
	lessonIDs []string
}

// Load builds a Library from the embedded FS, or from overrideDir when non-empty
// (useful for hot-iterating content without rebuilding). All *.yaml files found
// recursively are decoded and validated; a single malformed file fails the load.
func Load(embedded fs.FS, overrideDir string) (*Library, error) {
	var src fs.FS
	if overrideDir != "" {
		src = os.DirFS(overrideDir)
	} else {
		src = embedded
	}

	lib := &Library{
		lessons: make(map[string]Lesson),
		byGrade: make(map[string]map[int][]string),
	}

	hasher := sha256.New()

	walkErr := fs.WalkDir(src, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !isYAML(p) {
			return nil
		}
		raw, readErr := fs.ReadFile(src, p)
		if readErr != nil {
			return fmt.Errorf("reading %s: %w", p, readErr)
		}
		hasher.Write(raw)

		var lesson Lesson
		dec := yaml.NewDecoder(strings.NewReader(string(raw)))
		dec.KnownFields(true)
		if decErr := dec.Decode(&lesson); decErr != nil {
			return fmt.Errorf("decoding %s: %w", p, decErr)
		}
		if vErr := validateLesson(lesson); vErr != nil {
			return fmt.Errorf("invalid lesson %s: %w", p, vErr)
		}
		if _, dup := lib.lessons[lesson.ID]; dup {
			return fmt.Errorf("duplicate lesson id %q (%s)", lesson.ID, p)
		}
		lib.add(lesson)
		return nil
	})
	if walkErr != nil {
		return nil, walkErr
	}

	if len(lib.lessons) == 0 {
		return nil, fmt.Errorf("no lessons found")
	}

	lib.finalize()
	lib.version = hex.EncodeToString(hasher.Sum(nil))[:16]
	return lib, nil
}

func isYAML(p string) bool {
	ext := strings.ToLower(path.Ext(p))
	return ext == ".yaml" || ext == ".yml"
}

func (l *Library) add(lesson Lesson) {
	l.lessons[lesson.ID] = lesson
	if l.byGrade[lesson.Subject] == nil {
		l.byGrade[lesson.Subject] = make(map[int][]string)
	}
	l.byGrade[lesson.Subject][lesson.Grade] = append(l.byGrade[lesson.Subject][lesson.Grade], lesson.ID)
}

// finalize computes the sorted subject/grade index and a stable lesson order.
func (l *Library) finalize() {
	subjectOrder := map[string]int{SubjectHebrew: 0, SubjectEnglish: 1, SubjectMath: 2}

	subjects := make([]string, 0, len(l.byGrade))
	for s := range l.byGrade {
		subjects = append(subjects, s)
	}
	sort.Slice(subjects, func(i, j int) bool {
		oi, oj := subjectOrder[subjects[i]], subjectOrder[subjects[j]]
		if oi != oj {
			return oi < oj
		}
		return subjects[i] < subjects[j]
	})

	for _, s := range subjects {
		grades := make([]int, 0, len(l.byGrade[s]))
		for g := range l.byGrade[s] {
			grades = append(grades, g)
		}
		sort.Ints(grades)
		// Deterministic in-grade lesson order: difficulty then id.
		for _, g := range grades {
			ids := l.byGrade[s][g]
			sort.Slice(ids, func(i, j int) bool {
				li, lj := l.lessons[ids[i]], l.lessons[ids[j]]
				if li.Difficulty != lj.Difficulty {
					return li.Difficulty < lj.Difficulty
				}
				return li.ID < lj.ID
			})
			l.lessonIDs = append(l.lessonIDs, ids...)
		}
		l.subjects = append(l.subjects, SubjectSummary{Subject: s, Grades: grades})
	}
}

// Version returns the content hash used to detect content changes between boots.
func (l *Library) Version() string { return l.version }

// Subjects returns the available subjects and their grades, in canonical order.
func (l *Library) Subjects() []SubjectSummary { return l.subjects }

// Lessons returns lesson summaries filtered by subject and grade. A zero grade
// or empty subject acts as a wildcard.
func (l *Library) Lessons(subject string, grade int) []LessonSummary {
	out := make([]LessonSummary, 0)
	for _, id := range l.lessonIDs {
		ls := l.lessons[id]
		if subject != "" && ls.Subject != subject {
			continue
		}
		if grade != 0 && ls.Grade != grade {
			continue
		}
		out = append(out, ls.Summary())
	}
	return out
}

// Lesson returns the full lesson for an id.
func (l *Library) Lesson(id string) (Lesson, bool) {
	ls, ok := l.lessons[id]
	return ls, ok
}

// Count returns the total number of loaded lessons.
func (l *Library) Count() int { return len(l.lessons) }
