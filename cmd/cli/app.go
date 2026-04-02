package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/justgook/gams/pkg/wasmhost"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

type app struct {
	v          *viper.Viper
	configFile string
	config     Config
	paths      ResolvedPaths
	loaded     bool
}

type Config struct {
	Paths   PathsConfig   `mapstructure:"paths" json:"paths"`
	Runtime RuntimeConfig `mapstructure:"runtime" json:"runtime"`
	Logging LoggingConfig `mapstructure:"logging" json:"logging"`
}

type PathsConfig struct {
	Plugins    string `mapstructure:"plugins" json:"plugins"`
	Migrations string `mapstructure:"migrations" json:"migrations"`
	Database   string `mapstructure:"database" json:"database"`
	Workdir    string `mapstructure:"workdir" json:"workdir"`
}

type RuntimeConfig struct {
	LoadGlobalPlugins  bool `mapstructure:"load_global_plugins" json:"load_global_plugins"`
	SaveDatabaseOnExit bool `mapstructure:"save_database_on_exit" json:"save_database_on_exit"`
}

type LoggingConfig struct {
	Level string `mapstructure:"level" json:"level"`
}

type ResolvedPaths struct {
	Workdir    string `json:"workdir"`
	Plugins    string `json:"plugins"`
	Migrations string `json:"migrations"`
	Database   string `json:"database"`
}

type EffectiveConfig struct {
	ConfigFile string        `json:"config_file,omitempty"`
	Config     Config        `json:"config"`
	Resolved   ResolvedPaths `json:"resolved"`
}

func newApp() *app {
	v := viper.New()
	v.SetEnvPrefix("GAMS")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	v.SetDefault("paths.plugins", "build.nosync/plugins")
	v.SetDefault("paths.migrations", "cmd/browser/data/migrations")
	v.SetDefault("paths.database", "database.sqlite")
	v.SetDefault("paths.workdir", ".")
	v.SetDefault("runtime.load_global_plugins", true)
	v.SetDefault("runtime.save_database_on_exit", true)
	v.SetDefault("logging.level", "info")

	return &app{v: v}
}

func (a *app) load() error {
	if a.loaded {
		return nil
	}

	if a.configFile != "" {
		a.v.SetConfigFile(a.configFile)
		if err := a.v.ReadInConfig(); err != nil {
			return fmt.Errorf("read config: %w", err)
		}
	} else {
		a.v.SetConfigName("gams")
		a.v.SetConfigType("yaml")
		a.v.AddConfigPath(".")
		a.v.AddConfigPath("./config")
		if home, err := os.UserHomeDir(); err == nil {
			a.v.AddConfigPath(filepath.Join(home, ".config", "gams"))
		}
		if err := a.v.ReadInConfig(); err != nil {
			var configNotFound viper.ConfigFileNotFoundError
			if !errors.As(err, &configNotFound) {
				return fmt.Errorf("read config: %w", err)
			}
		}
	}

	var cfg Config
	if err := a.v.Unmarshal(&cfg); err != nil {
		return fmt.Errorf("decode config: %w", err)
	}

	resolved, err := resolvePaths(cfg.Paths)
	if err != nil {
		return err
	}

	a.config = cfg
	a.paths = resolved
	a.loaded = true
	return nil
}

func resolvePaths(cfg PathsConfig) (ResolvedPaths, error) {
	workdir, err := resolveAbs("", cfg.Workdir)
	if err != nil {
		return ResolvedPaths{}, fmt.Errorf("resolve workdir: %w", err)
	}

	plugins, err := resolveAbs(workdir, cfg.Plugins)
	if err != nil {
		return ResolvedPaths{}, fmt.Errorf("resolve plugins path: %w", err)
	}

	migrations, err := resolveAbs(workdir, cfg.Migrations)
	if err != nil {
		return ResolvedPaths{}, fmt.Errorf("resolve migrations path: %w", err)
	}

	database, err := resolveAbs(workdir, cfg.Database)
	if err != nil {
		return ResolvedPaths{}, fmt.Errorf("resolve database path: %w", err)
	}

	return ResolvedPaths{
		Workdir:    workdir,
		Plugins:    plugins,
		Migrations: migrations,
		Database:   database,
	}, nil
}

func resolveAbs(base, value string) (string, error) {
	if value == "" {
		return "", nil
	}
	if filepath.IsAbs(value) {
		return filepath.Clean(value), nil
	}
	if base == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		base = cwd
	}
	return filepath.Clean(filepath.Join(base, value)), nil
}

func (a *app) effectiveConfig() EffectiveConfig {
	configFile := ""
	if a.v.ConfigFileUsed() != "" {
		configFile = a.v.ConfigFileUsed()
	}
	return EffectiveConfig{
		ConfigFile: configFile,
		Config:     a.config,
		Resolved:   a.paths,
	}
}

func (a *app) printJSON(value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(os.Stdout, string(data))
	return err
}

func (a *app) newRuntime() (*wasmhost.Runtime, error) {
	if err := a.load(); err != nil {
		return nil, err
	}

	return wasmhost.New(wasmhost.Config{
		PluginsDir: a.paths.Plugins,
	})
}

func sortStrings(values []string) []string {
	cloned := append([]string(nil), values...)
	sort.Strings(cloned)
	return cloned
}

func withAppRun(a *app, fn func(cmd *cobra.Command, args []string) error) func(cmd *cobra.Command, args []string) error {
	return func(cmd *cobra.Command, args []string) error {
		if err := a.load(); err != nil {
			return err
		}
		return fn(cmd, args)
	}
}
