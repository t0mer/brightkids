// SPDX-License-Identifier: Apache-2.0

package content

import "fmt"

var validSubjects = map[string]bool{
	SubjectHebrew:  true,
	SubjectEnglish: true,
	SubjectMath:    true,
}

var validActivities = map[string]bool{
	ActivityLetterRecognition: true,
	ActivityTracing:           true,
	ActivityMatching:          true,
	ActivityMultipleChoice:    true,
	ActivityCounting:          true,
	ActivityArithmetic:        true,
	ActivityDragDrop:          true,
	ActivityComparison:        true,
}

var validDirections = map[string]bool{"rtl": true, "ltr": true}

// validateLesson enforces the content schema, failing fast on malformed data so
// the binary refuses to boot with broken lessons.
func validateLesson(l Lesson) error {
	if l.ID == "" {
		return fmt.Errorf("missing id")
	}
	if !validSubjects[l.Subject] {
		return fmt.Errorf("invalid subject %q", l.Subject)
	}
	if l.Grade < 1 || l.Grade > 6 {
		return fmt.Errorf("grade %d out of range 1-6", l.Grade)
	}
	if l.Difficulty < 1 || l.Difficulty > 3 {
		return fmt.Errorf("difficulty %d out of range 1-3", l.Difficulty)
	}
	if !validDirections[l.Direction] {
		return fmt.Errorf("invalid direction %q (rtl|ltr)", l.Direction)
	}
	if l.Title == "" {
		return fmt.Errorf("missing title")
	}
	if l.PromptTTS == "" {
		return fmt.Errorf("missing prompt_tts")
	}
	if !validActivities[l.Activity] {
		return fmt.Errorf("invalid activity %q", l.Activity)
	}
	if l.Reward.Stars < 1 {
		return fmt.Errorf("reward.stars must be >= 1")
	}

	switch l.Activity {
	case ActivityMultipleChoice, ActivityLetterRecognition:
		// Both support either a single `items` set or a `questions` set.
		if len(l.Questions) > 0 {
			return validateQuestionSet(l)
		}
		return validateChoice(l)
	case ActivityTracing:
		return validateTracing(l)
	case ActivityMatching:
		return validateMatching(l)
	case ActivityCounting:
		return validateCounting(l)
	case ActivityArithmetic:
		return validateArithmetic(l)
	case ActivityDragDrop:
		return validateDragDrop(l)
	case ActivityComparison:
		return validateComparison(l)
	}
	return nil
}

func validateComparison(l Lesson) error {
	if len(l.Comparisons) == 0 {
		return fmt.Errorf("comparison needs at least one pair")
	}
	for i, c := range l.Comparisons {
		if c.Left == c.Right {
			return fmt.Errorf("comparisons[%d]: numbers must differ (who is bigger?)", i)
		}
		if c.Left < 0 || c.Right < 0 {
			return fmt.Errorf("comparisons[%d]: numbers must be non-negative", i)
		}
	}
	return nil
}

func validateChoice(l Lesson) error {
	return validateChoiceItems(l.Items, l.Activity)
}

// validateChoiceItems checks a single set of options: at least 2, unique ids,
// each renderable, exactly one correct.
func validateChoiceItems(items []Item, activity string) error {
	if len(items) < 2 {
		return fmt.Errorf("%s needs at least 2 items", activity)
	}
	correct := 0
	seen := map[string]bool{}
	for _, it := range items {
		if it.ID == "" {
			return fmt.Errorf("item missing id")
		}
		if seen[it.ID] {
			return fmt.Errorf("duplicate item id %q", it.ID)
		}
		seen[it.ID] = true
		if it.Label == "" && it.Emoji == "" && it.Image == "" {
			return fmt.Errorf("item %q needs a label, emoji, or image", it.ID)
		}
		if it.Correct {
			correct++
		}
	}
	if correct != 1 {
		return fmt.Errorf("%s needs exactly 1 correct item, found %d", activity, correct)
	}
	return nil
}

// validateQuestionSet checks a multiple-choice set: at least one question, each
// with a valid set of options.
func validateQuestionSet(l Lesson) error {
	if len(l.Questions) == 0 {
		return fmt.Errorf("multiple-choice set needs at least one question")
	}
	for i, q := range l.Questions {
		if err := validateChoiceItems(q.Items, "multiple-choice"); err != nil {
			return fmt.Errorf("questions[%d]: %w", i, err)
		}
	}
	return nil
}

func validateTracing(l Lesson) error {
	if l.Glyph == "" {
		return fmt.Errorf("tracing needs a glyph")
	}
	return nil
}

func validateMatching(l Lesson) error {
	if len(l.Pairs) < 2 {
		return fmt.Errorf("matching needs at least 2 pairs")
	}
	seen := map[string]bool{}
	for _, p := range l.Pairs {
		if p.ID == "" {
			return fmt.Errorf("pair missing id")
		}
		if seen[p.ID] {
			return fmt.Errorf("duplicate pair id %q", p.ID)
		}
		seen[p.ID] = true
		if p.Left == "" || (p.Right == "" && p.Emoji == "") {
			return fmt.Errorf("pair %q needs left and right (or emoji)", p.ID)
		}
	}
	return nil
}

func validateCounting(l Lesson) error {
	if l.Problem == nil {
		return fmt.Errorf("counting needs a problem with answer")
	}
	if l.Problem.Answer < 1 {
		return fmt.Errorf("counting answer must be >= 1")
	}
	if l.Glyph == "" && len(l.Items) == 0 {
		return fmt.Errorf("counting needs a glyph or items to count")
	}
	return nil
}

func validateArithmetic(l Lesson) error {
	if l.Problem == nil && len(l.Problems) == 0 {
		return fmt.Errorf("arithmetic needs a problem or problems set")
	}
	if l.Problem != nil {
		if err := validateProblem(*l.Problem); err != nil {
			return err
		}
	}
	for i, p := range l.Problems {
		if err := validateProblem(p); err != nil {
			return fmt.Errorf("problems[%d]: %w", i, err)
		}
	}
	return nil
}

func validateProblem(p Problem) error {
	switch p.Operator {
	case "+", "-", "x", "*", "/", "÷":
	default:
		return fmt.Errorf("arithmetic operator %q invalid", p.Operator)
	}
	if len(p.Operands) < 2 {
		return fmt.Errorf("arithmetic needs at least 2 operands")
	}
	return nil
}

func validateDragDrop(l Lesson) error {
	if len(l.Items) < 2 {
		return fmt.Errorf("drag-drop needs at least 2 items")
	}
	if len(l.Solution) < 2 {
		return fmt.Errorf("drag-drop needs a solution ordering")
	}
	ids := map[string]bool{}
	for _, it := range l.Items {
		if it.ID == "" {
			return fmt.Errorf("drag-drop item missing id")
		}
		ids[it.ID] = true
	}
	for _, s := range l.Solution {
		if !ids[s] {
			return fmt.Errorf("solution references unknown item %q", s)
		}
	}
	return nil
}
