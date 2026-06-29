// SPDX-License-Identifier: Apache-2.0

// Package content loads, validates, and serves the embedded lesson library.
package content

// Activity identifiers — one typed renderer per value on the frontend.
const (
	ActivityLetterRecognition = "letter-recognition"
	ActivityTracing           = "tracing"
	ActivityMatching          = "matching"
	ActivityMultipleChoice    = "multiple-choice"
	ActivityCounting          = "counting"
	ActivityArithmetic        = "arithmetic"
	ActivityDragDrop          = "drag-drop"
	ActivityComparison        = "comparison" // "who is bigger?" — tap the larger number
)

// Subjects supported in v1.
const (
	SubjectHebrew  = "hebrew"
	SubjectEnglish = "english"
	SubjectMath    = "math"
)

// Lesson is one playable activity. Fields are activity-specific; the loader
// validates that the right set is present for each Activity value. The struct
// is serialised verbatim to the frontend as JSON.
type Lesson struct {
	ID         string `yaml:"id" json:"id"`
	Subject    string `yaml:"subject" json:"subject"`
	Grade      int    `yaml:"grade" json:"grade"`
	Difficulty int    `yaml:"difficulty" json:"difficulty"`
	Locale     string `yaml:"locale" json:"locale"`
	Direction  string `yaml:"direction" json:"direction"`
	Title      string `yaml:"title" json:"title"`
	Activity   string `yaml:"activity" json:"activity"`
	PromptTTS  string `yaml:"prompt_tts" json:"prompt_tts"`
	Audio      string `yaml:"audio,omitempty" json:"audio,omitempty"`

	// Items: choices/tokens/objects depending on the activity.
	Items []Item `yaml:"items,omitempty" json:"items,omitempty"`
	// Pairs: matching activity (left <-> right).
	Pairs []Pair `yaml:"pairs,omitempty" json:"pairs,omitempty"`
	// Problem: a single arithmetic or counting problem.
	Problem *Problem `yaml:"problem,omitempty" json:"problem,omitempty"`
	// Problems: an arithmetic practice set — the activity steps through each.
	Problems []Problem `yaml:"problems,omitempty" json:"problems,omitempty"`
	// Comparisons: a "who is bigger?" set — the child taps the larger number.
	Comparisons []Comparison `yaml:"comparisons,omitempty" json:"comparisons,omitempty"`
	// Glyph: tracing (the character) and counting (the object emoji to render).
	Glyph string `yaml:"glyph,omitempty" json:"glyph,omitempty"`
	// Solution: drag-drop ordered list of item IDs forming the correct answer.
	Solution []string `yaml:"solution,omitempty" json:"solution,omitempty"`

	Reward Reward `yaml:"reward" json:"reward"`
}

// Item is a generic choice/token/object used by several activities.
type Item struct {
	ID      string `yaml:"id" json:"id"`
	Label   string `yaml:"label" json:"label"`
	Correct bool   `yaml:"correct,omitempty" json:"correct,omitempty"`
	TTS     string `yaml:"tts,omitempty" json:"tts,omitempty"`
	Audio   string `yaml:"audio,omitempty" json:"audio,omitempty"`
	Emoji   string `yaml:"emoji,omitempty" json:"emoji,omitempty"`
	Image   string `yaml:"image,omitempty" json:"image,omitempty"`
}

// Pair is one matching connection between a left and right token.
type Pair struct {
	ID       string `yaml:"id" json:"id"`
	Left     string `yaml:"left" json:"left"`
	Right    string `yaml:"right" json:"right"`
	LeftTTS  string `yaml:"left_tts,omitempty" json:"left_tts,omitempty"`
	RightTTS string `yaml:"right_tts,omitempty" json:"right_tts,omitempty"`
	Emoji    string `yaml:"emoji,omitempty" json:"emoji,omitempty"`
}

// Comparison is one "who is bigger?" pair. The two numbers are distinct; the
// larger is the correct answer.
type Comparison struct {
	Left  int `yaml:"left" json:"left"`
	Right int `yaml:"right" json:"right"`
}

// Problem describes a counting target or an arithmetic equation.
// For counting, Operator is "count" and Answer is the number of objects.
type Problem struct {
	Operands []int  `yaml:"operands,omitempty" json:"operands,omitempty"`
	Operator string `yaml:"operator" json:"operator"`
	Answer   int    `yaml:"answer" json:"answer"`
}

// Reward configures the success feedback for a lesson.
type Reward struct {
	Stars  int    `yaml:"stars" json:"stars"`
	SFX    string `yaml:"sfx" json:"sfx"`
	Effect string `yaml:"effect" json:"effect"`
}

// SubjectSummary lists the grades available within a subject.
type SubjectSummary struct {
	Subject string `json:"subject"`
	Grades  []int  `json:"grades"`
}

// LessonSummary is the lightweight lesson descriptor used in list responses.
type LessonSummary struct {
	ID         string `json:"id"`
	Subject    string `json:"subject"`
	Grade      int    `json:"grade"`
	Difficulty int    `json:"difficulty"`
	Title      string `json:"title"`
	Activity   string `json:"activity"`
	Direction  string `json:"direction"`
	Locale     string `json:"locale"`
}

// Summary projects a Lesson onto its list descriptor.
func (l Lesson) Summary() LessonSummary {
	return LessonSummary{
		ID:         l.ID,
		Subject:    l.Subject,
		Grade:      l.Grade,
		Difficulty: l.Difficulty,
		Title:      l.Title,
		Activity:   l.Activity,
		Direction:  l.Direction,
		Locale:     l.Locale,
	}
}
