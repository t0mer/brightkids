// SPDX-License-Identifier: Apache-2.0

package content

import (
	"testing"
	"testing/fstest"
)

func mustFS(t *testing.T, files map[string]string) fstest.MapFS {
	t.Helper()
	m := fstest.MapFS{}
	for name, body := range files {
		m[name] = &fstest.MapFile{Data: []byte(body)}
	}
	return m
}

const validHebrew = `
id: he-g1-letters-01
subject: hebrew
grade: 1
difficulty: 1
locale: he-IL
direction: rtl
title: "האות א"
activity: letter-recognition
prompt_tts: "מצאו את האות אלף"
items:
  - id: alef
    label: "א"
    correct: true
  - id: bet
    label: "ב"
reward: { stars: 1, sfx: ding, effect: confetti }
`

const validMath = `
id: math-g2-add-01
subject: math
grade: 2
difficulty: 1
locale: en-US
direction: ltr
title: "Add two numbers"
activity: arithmetic
prompt_tts: "What is 2 plus 3?"
problem:
  operands: [2, 3]
  operator: "+"
  answer: 5
reward: { stars: 1, sfx: ding, effect: confetti }
`

func TestLoadValid(t *testing.T) {
	lib, err := Load(mustFS(t, map[string]string{
		"hebrew/a.yaml": validHebrew,
		"math/b.yaml":   validMath,
	}), "")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if lib.Count() != 2 {
		t.Fatalf("want 2 lessons, got %d", lib.Count())
	}
	if _, ok := lib.Lesson("he-g1-letters-01"); !ok {
		t.Fatal("hebrew lesson missing")
	}
	subs := lib.Subjects()
	if len(subs) != 2 || subs[0].Subject != SubjectHebrew {
		t.Fatalf("unexpected subjects: %+v", subs)
	}
	if lib.Version() == "" {
		t.Fatal("version not computed")
	}
	heLessons := lib.Lessons(SubjectHebrew, 1)
	if len(heLessons) != 1 {
		t.Fatalf("want 1 hebrew g1 lesson, got %d", len(heLessons))
	}
}

func TestLoadEmptyFails(t *testing.T) {
	if _, err := Load(mustFS(t, map[string]string{}), ""); err == nil {
		t.Fatal("expected error for empty library")
	}
}

const validProblemSet = `
id: math-g2-add-set-99
subject: math
grade: 2
difficulty: 2
locale: en-US
direction: ltr
title: "Addition Set"
activity: arithmetic
prompt_tts: "Solve the addition problems."
problems:
  - { operands: [2, 3], operator: "+", answer: 5 }
  - { operands: [4, 1], operator: "+", answer: 5 }
reward: { stars: 3, sfx: ding, effect: confetti }
`

func TestArithmeticProblemSet(t *testing.T) {
	lib, err := Load(mustFS(t, map[string]string{"math/set.yaml": validProblemSet}), "")
	if err != nil {
		t.Fatalf("Load problem set: %v", err)
	}
	ls, ok := lib.Lesson("math-g2-add-set-99")
	if !ok || len(ls.Problems) != 2 {
		t.Fatalf("expected 2 problems, got %+v", ls.Problems)
	}
}

func TestArithmeticRejectsBadProblemInSet(t *testing.T) {
	bad := `{id: x, subject: math, grade: 2, difficulty: 1, locale: en, direction: ltr, title: t, activity: arithmetic, prompt_tts: p, problems: [{operands: [2,3], operator: "+", answer: 5},{operands: [4], operator: "?", answer: 9}], reward: {stars: 1, sfx: d, effect: e}}`
	if _, err := Load(mustFS(t, map[string]string{"x.yaml": bad}), ""); err == nil {
		t.Fatal("expected error for invalid problem in set")
	}
}

func TestLoadRejectsMalformed(t *testing.T) {
	cases := map[string]string{
		"bad-subject": `{id: x, subject: science, grade: 1, difficulty: 1, locale: en, direction: ltr, title: t, activity: letter-recognition, prompt_tts: p, items: [{id: a, label: A, correct: true},{id: b, label: B}], reward: {stars: 1, sfx: d, effect: e}}`,
		"no-correct":  `{id: x, subject: english, grade: 1, difficulty: 1, locale: en, direction: ltr, title: t, activity: letter-recognition, prompt_tts: p, items: [{id: a, label: A},{id: b, label: B}], reward: {stars: 1, sfx: d, effect: e}}`,
		"unknown-key": `{id: x, subject: english, grade: 1, difficulty: 1, locale: en, direction: ltr, title: t, activity: letter-recognition, prompt_tts: p, bogus: 1, items: [{id: a, label: A, correct: true},{id: b, label: B}], reward: {stars: 1, sfx: d, effect: e}}`,
		"grade-range": `{id: x, subject: english, grade: 9, difficulty: 1, locale: en, direction: ltr, title: t, activity: counting, prompt_tts: p, glyph: "🍎", problem: {operator: count, answer: 2}, reward: {stars: 1, sfx: d, effect: e}}`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Load(mustFS(t, map[string]string{"x.yaml": body}), ""); err == nil {
				t.Fatalf("expected error for %s", name)
			}
		})
	}
}

func TestDuplicateIDRejected(t *testing.T) {
	_, err := Load(mustFS(t, map[string]string{
		"a.yaml": validHebrew,
		"b.yaml": validHebrew,
	}), "")
	if err == nil {
		t.Fatal("expected duplicate id error")
	}
}
