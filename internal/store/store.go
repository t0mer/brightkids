// SPDX-License-Identifier: Apache-2.0

package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite" // pure-Go SQLite driver (CGO disabled)
)

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("not found")

// Store is the SQLite-backed persistence layer. It is safe for concurrent use.
type Store struct {
	db *sql.DB
}

// Open opens (or creates) the SQLite database at path and applies the schema.
// Pass ":memory:" for an ephemeral store.
func Open(path string) (*Store, error) {
	dsn := dsnFor(path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("opening sqlite %q: %w", path, err)
	}
	// SQLite tolerates a single writer best; serialise to avoid lock contention.
	db.SetMaxOpenConns(1)

	if _, err := db.Exec(`PRAGMA foreign_keys = ON;`); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("enabling foreign keys: %w", err)
	}
	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("applying schema: %w", err)
	}
	return &Store{db: db}, nil
}

func dsnFor(path string) string {
	if path == ":memory:" {
		// Shared cache keeps the single pooled connection's in-memory DB alive.
		return "file::memory:?cache=shared"
	}
	return "file:" + path + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
}

// Close releases the database handle.
func (s *Store) Close() error { return s.db.Close() }

// Ping verifies the database is reachable (used by readiness probes).
func (s *Store) Ping() error { return s.db.Ping() }

// SeededVersion returns the content version last recorded as seeded.
func (s *Store) SeededVersion() (string, error) {
	var v string
	err := s.db.QueryRow(`SELECT seeded_version FROM content_meta WHERE id = 1`).Scan(&v)
	if err != nil {
		return "", fmt.Errorf("reading seeded version: %w", err)
	}
	return v, nil
}

// SetSeededVersion records the content version currently loaded, guarding
// re-seed work on content bumps.
func (s *Store) SetSeededVersion(version string) error {
	_, err := s.db.Exec(`UPDATE content_meta SET seeded_version = ? WHERE id = 1`, version)
	if err != nil {
		return fmt.Errorf("setting seeded version: %w", err)
	}
	return nil
}

// CreateProfile inserts a new local profile and its default settings.
func (s *Store) CreateProfile(name, avatar, localePref string) (Profile, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Profile{}, fmt.Errorf("%w: name required", ErrInvalid)
	}
	if localePref == "" {
		localePref = "he"
	}
	p := Profile{
		ID:         uuid.NewString(),
		Name:       name,
		Avatar:     avatar,
		LocalePref: localePref,
		CreatedAt:  time.Now().UTC(),
	}
	tx, err := s.db.Begin()
	if err != nil {
		return Profile{}, err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(
		`INSERT INTO profiles (id, name, avatar, locale_pref, created_at) VALUES (?, ?, ?, ?, ?)`,
		p.ID, p.Name, p.Avatar, p.LocalePref, fmtTS(p.CreatedAt),
	); err != nil {
		return Profile{}, fmt.Errorf("inserting profile: %w", err)
	}
	d := DefaultSettings(p.ID)
	d.UILang = localePref
	if _, err := tx.Exec(
		`INSERT INTO settings (profile_id, sound_enabled, voice_enabled, reduce_motion, dyslexia_font, ui_lang)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		d.ProfileID, b2i(d.SoundEnabled), b2i(d.VoiceEnabled), b2i(d.ReduceMotion), b2i(d.DyslexiaFont), d.UILang,
	); err != nil {
		return Profile{}, fmt.Errorf("inserting settings: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return Profile{}, err
	}
	return p, nil
}

// ListProfiles returns all profiles, newest first.
func (s *Store) ListProfiles() ([]Profile, error) {
	rows, err := s.db.Query(
		`SELECT id, name, avatar, locale_pref, created_at FROM profiles ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("listing profiles: %w", err)
	}
	defer func() { _ = rows.Close() }()

	out := make([]Profile, 0)
	for rows.Next() {
		var p Profile
		var created string
		if err := rows.Scan(&p.ID, &p.Name, &p.Avatar, &p.LocalePref, &created); err != nil {
			return nil, err
		}
		p.CreatedAt = parseTS(created)
		out = append(out, p)
	}
	return out, rows.Err()
}

// GetProfile returns one profile by id.
func (s *Store) GetProfile(id string) (Profile, error) {
	var p Profile
	var created string
	err := s.db.QueryRow(
		`SELECT id, name, avatar, locale_pref, created_at FROM profiles WHERE id = ?`, id,
	).Scan(&p.ID, &p.Name, &p.Avatar, &p.LocalePref, &created)
	if errors.Is(err, sql.ErrNoRows) {
		return Profile{}, ErrNotFound
	}
	if err != nil {
		return Profile{}, fmt.Errorf("getting profile: %w", err)
	}
	p.CreatedAt = parseTS(created)
	return p, nil
}

// DeleteProfile removes a profile and its progress/settings (cascade).
func (s *Store) DeleteProfile(id string) error {
	res, err := s.db.Exec(`DELETE FROM profiles WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting profile: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// ErrInvalid signals invalid input to a store operation.
var ErrInvalid = errors.New("invalid input")

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

// tsLayout is the canonical timestamp format stored in SQLite. RFC3339 (UTC) is
// understood by SQLite's date()/datetime() functions, which the streak query
// relies on.
const tsLayout = time.RFC3339

func fmtTS(t time.Time) string { return t.UTC().Format(tsLayout) }

func parseTS(s string) time.Time {
	if t, err := time.Parse(tsLayout, s); err == nil {
		return t
	}
	// Fallback for any rows written with SQLite's default "YYYY-MM-DD HH:MM:SS".
	if t, err := time.Parse("2006-01-02 15:04:05", s); err == nil {
		return t.UTC()
	}
	return time.Time{}
}
