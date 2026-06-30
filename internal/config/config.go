// SPDX-License-Identifier: Apache-2.0

// Package config loads BrightKids configuration with precedence flags > env > YAML.
package config

import (
	"fmt"
	"strings"

	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

// EnvPrefix is the prefix for all environment-variable overrides.
const EnvPrefix = "BRIGHTKIDS"

// Config is the fully-resolved runtime configuration.
type Config struct {
	// Mode selects where child profiles, progress, and settings are stored:
	//   "private" (default, self-hosted) — persisted server-side in SQLite.
	//   "public"  — stored only in the browser's localStorage; the server is
	//               stateless and opens no database.
	Mode      string          `mapstructure:"mode"`
	Server    ServerConfig    `mapstructure:"server"`
	DB        DBConfig        `mapstructure:"db"`
	Log       LogConfig       `mapstructure:"log"`
	Content   ContentConfig   `mapstructure:"content"`
	Metrics   MetricsConfig   `mapstructure:"metrics"`
	Analytics AnalyticsConfig `mapstructure:"analytics"`
	TTS       TTSConfig       `mapstructure:"tts"`
}

// TTSConfig toggles text-to-speech narration. Off by default — when disabled
// the Listen button is hidden and no narration plays on any screen.
type TTSConfig struct {
	Enabled bool `mapstructure:"enabled"`
}

// AnalyticsConfig configures optional Google Analytics. When GAID is set, the
// gtag.js snippet is injected into served pages; empty disables analytics.
type AnalyticsConfig struct {
	GAID string `mapstructure:"ga_id"`
}

// Storage modes.
const (
	ModePrivate = "private"
	ModePublic  = "public"
)

// IsPublic reports whether profiles live in the browser (no server database).
func (c *Config) IsPublic() bool { return c.Mode == ModePublic }

// ServerConfig holds HTTP listener settings.
type ServerConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
}

// DBConfig holds the SQLite database location.
type DBConfig struct {
	Path string `mapstructure:"path"`
}

// LogConfig controls structured logging.
type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

// ContentConfig optionally overrides embedded content with an on-disk directory.
type ContentConfig struct {
	Dir string `mapstructure:"dir"`
}

// MetricsConfig toggles the Prometheus endpoint.
type MetricsConfig struct {
	Enabled bool `mapstructure:"enabled"`
}

// Addr returns the host:port the server should bind to.
func (s ServerConfig) Addr() string {
	return fmt.Sprintf("%s:%d", s.Host, s.Port)
}

// Load resolves configuration from defaults, an optional YAML file, environment
// variables (prefixed BRIGHTKIDS_), and command-line flags, in increasing order
// of precedence (flags > env > YAML > defaults).
//
// args is typically os.Args[1:]. The returned bool reports whether --version was
// requested so the caller can print version info and exit.
func Load(args []string) (*Config, bool, error) {
	v := viper.New()

	setDefaults(v)

	fs := pflag.NewFlagSet("brightkids", pflag.ContinueOnError)
	fs.String("config", "", "path to YAML config file")
	fs.String("mode", v.GetString("mode"), "storage mode: private (DB-backed) | public (browser localStorage)")
	fs.String("host", v.GetString("server.host"), "HTTP listen host")
	fs.Int("port", v.GetInt("server.port"), "HTTP listen port")
	fs.String("db-path", v.GetString("db.path"), "SQLite database path (:memory: allowed)")
	fs.String("log-level", v.GetString("log.level"), "log level: debug|info|warn|error")
	fs.String("log-format", v.GetString("log.format"), "log format: json|text")
	fs.String("content-dir", v.GetString("content.dir"), "override embedded content with a directory")
	fs.Bool("metrics", v.GetBool("metrics.enabled"), "enable Prometheus /metrics endpoint")
	fs.String("ga-id", v.GetString("analytics.ga_id"), "Google Analytics measurement ID (e.g. G-XXXXXXXXXX); enables analytics when set")
	fs.Bool("tts", v.GetBool("tts.enabled"), "enable text-to-speech narration (off by default)")
	showVersion := fs.Bool("version", false, "print version and exit")

	if err := fs.Parse(args); err != nil {
		return nil, false, fmt.Errorf("parsing flags: %w", err)
	}
	if *showVersion {
		return nil, true, nil
	}

	// Environment variables: BRIGHTKIDS_SERVER_HOST, BRIGHTKIDS_LOG_LEVEL, etc.
	v.SetEnvPrefix(EnvPrefix)
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// YAML file (lowest explicit source); --config flag wins over the default name.
	if cfgPath, _ := fs.GetString("config"); cfgPath != "" {
		v.SetConfigFile(cfgPath)
		if err := v.ReadInConfig(); err != nil {
			return nil, false, fmt.Errorf("reading config file %q: %w", cfgPath, err)
		}
	} else {
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath(".")
		// Missing default config file is not an error.
		if err := v.ReadInConfig(); err != nil {
			if _, notFound := err.(viper.ConfigFileNotFoundError); !notFound {
				return nil, false, fmt.Errorf("reading config: %w", err)
			}
		}
	}

	// Flags take highest precedence: bind only the ones the user actually set.
	bindChangedFlags(v, fs)

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, false, fmt.Errorf("unmarshalling config: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return nil, false, err
	}
	return &cfg, false, nil
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("mode", ModePrivate)
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("db.path", "./brightkids.db")
	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")
	v.SetDefault("content.dir", "")
	v.SetDefault("metrics.enabled", true)
	v.SetDefault("analytics.ga_id", "")
	v.SetDefault("tts.enabled", false)
}

// bindChangedFlags maps explicitly-set CLI flags onto config keys so they win
// over env and file values, while leaving untouched flags to lower-precedence
// sources.
func bindChangedFlags(v *viper.Viper, fs *pflag.FlagSet) {
	flagToKey := map[string]string{
		"mode":        "mode",
		"host":        "server.host",
		"port":        "server.port",
		"db-path":     "db.path",
		"log-level":   "log.level",
		"log-format":  "log.format",
		"content-dir": "content.dir",
		"metrics":     "metrics.enabled",
		"ga-id":       "analytics.ga_id",
		"tts":         "tts.enabled",
	}
	fs.Visit(func(f *pflag.Flag) {
		if key, ok := flagToKey[f.Name]; ok {
			_ = v.BindPFlag(key, f)
		}
	})
}

// Validate checks for obviously-bad configuration values.
func (c *Config) Validate() error {
	switch c.Mode {
	case ModePrivate, ModePublic:
	default:
		return fmt.Errorf("mode %q invalid (private|public)", c.Mode)
	}
	if c.Server.Port < 1 || c.Server.Port > 65535 {
		return fmt.Errorf("server.port %d out of range 1-65535", c.Server.Port)
	}
	switch c.Log.Level {
	case "debug", "info", "warn", "warning", "error":
	default:
		return fmt.Errorf("log.level %q invalid (debug|info|warn|error)", c.Log.Level)
	}
	switch c.Log.Format {
	case "json", "text":
	default:
		return fmt.Errorf("log.format %q invalid (json|text)", c.Log.Format)
	}
	if c.DB.Path == "" {
		return fmt.Errorf("db.path must not be empty")
	}
	return nil
}
