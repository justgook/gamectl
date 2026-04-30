package main

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
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
	Paths   PathsConfig       `mapstructure:"paths" json:"paths"`
	Runtime RuntimeConfig     `mapstructure:"runtime" json:"runtime"`
	Logging LoggingConfig     `mapstructure:"logging" json:"logging"`
	Aliases map[string]string `mapstructure:"aliases" json:"aliases,omitempty"`
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

type bootstrapStatus struct {
	DatabasePath    string   `json:"database_path"`
	DatabaseExists  bool     `json:"database_exists"`
	SchemaVersion   int      `json:"schema_version"`
	AppliedVersions []int    `json:"applied_versions"`
	AppliedNames    []string `json:"applied_names"`
}

type pluginRecord struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Enabled bool   `json:"enabled"`
	Type    string `json:"type"`
	Scope   string `json:"scope"`
}

type migrationIndex struct {
	Version    string           `json:"version"`
	Migrations []migrationEntry `json:"migrations"`
}

type migrationEntry struct {
	Version int    `json:"version"`
	Name    string `json:"name"`
	File    string `json:"file"`
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
	v.SetDefault("aliases", map[string]string{})

	return &app{v: v}
}

func newConfiguredApp(configFile string) *app {
	a := newApp()
	a.configFile = configFile
	return a
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
	a.config.Aliases = a.v.GetStringMapString("aliases")
	if a.config.Aliases == nil {
		a.config.Aliases = map[string]string{}
	}
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

func (a *app) configFilePath() string {
	if used := a.v.ConfigFileUsed(); used != "" {
		return used
	}
	if a.configFile != "" {
		return a.configFile
	}
	return filepath.Join(a.paths.Workdir, "gams.yaml")
}

func (a *app) setConfigValue(key, value string) error {
	if err := a.load(); err != nil {
		return err
	}
	a.v.Set(key, value)
	if strings.HasPrefix(key, "aliases.") {
		name := strings.TrimPrefix(key, "aliases.")
		if a.config.Aliases == nil {
			a.config.Aliases = map[string]string{}
		}
		a.config.Aliases[name] = value
	}
	return a.writeConfig()
}

func (a *app) unsetConfigValue(key string) error {
	if err := a.load(); err != nil {
		return err
	}
	a.v.Set(key, nil)
	if strings.HasPrefix(key, "aliases.") {
		name := strings.TrimPrefix(key, "aliases.")
		delete(a.config.Aliases, name)
	}
	return a.writeConfig()
}

func (a *app) getConfigValue(key string) any {
	if strings.HasPrefix(key, "aliases.") {
		name := strings.TrimPrefix(key, "aliases.")
		value, ok := a.config.Aliases[name]
		if !ok {
			return nil
		}
		return value
	}
	return a.v.Get(key)
}

func (a *app) writeConfig() error {
	path := a.configFilePath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	if _, err := os.Stat(path); err == nil {
		return a.v.WriteConfigAs(path)
	} else if !os.IsNotExist(err) {
		return err
	}
	return a.v.WriteConfigAs(path)
}

func (a *app) aliasCommand(name string) (string, bool) {
	if err := a.load(); err != nil {
		return "", false
	}
	value, ok := a.config.Aliases[name]
	return strings.TrimSpace(value), ok && strings.TrimSpace(value) != ""
}

func (a *app) printJSON(value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	_, err = fmt.Fprintln(os.Stdout, string(data))
	return err
}

func (a *app) newRuntime(modules ...wasmhost.ModuleConfig) (*wasmhost.Runtime, error) {
	if err := a.load(); err != nil {
		return nil, err
	}

	return wasmhost.New(wasmhost.Config{
		PluginsDir: a.paths.Plugins,
		Workdir:    a.paths.Workdir,
		Modules:    modules,
	})
}

func (a *app) bootstrapDatabase(runtime *wasmhost.Runtime) (bootstrapStatus, error) {
	status := bootstrapStatus{DatabasePath: a.paths.Database}

	if _, err := os.Stat(a.paths.Database); err == nil {
		status.DatabaseExists = true
	} else if !os.IsNotExist(err) {
		return status, err
	}

	if status.DatabaseExists {
		if _, err := a.callPlugin(runtime, "sql", "load_binary", []byte(a.paths.Database)); err != nil {
			return status, err
		}
	}

	if err := a.ensureSchemaVersionTable(runtime); err != nil {
		return status, err
	}

	currentVersion, err := a.getSchemaVersion(runtime)
	if err != nil {
		return status, err
	}

	index, err := a.loadMigrationIndex()
	if err != nil {
		return status, err
	}

	for _, migration := range index.Migrations {
		if migration.Version <= currentVersion {
			continue
		}
		sql, err := os.ReadFile(filepath.Join(a.paths.Migrations, migration.File))
		if err != nil {
			return status, fmt.Errorf("read migration %s: %w", migration.File, err)
		}
		if _, err := a.callPlugin(runtime, "sql", "restore", sql); err != nil {
			return status, fmt.Errorf("apply migration %d (%s): %w", migration.Version, migration.Name, err)
		}
		if err := a.recordMigration(runtime, migration); err != nil {
			return status, err
		}
		status.AppliedVersions = append(status.AppliedVersions, migration.Version)
		status.AppliedNames = append(status.AppliedNames, migration.Name)
		currentVersion = migration.Version
	}

	status.SchemaVersion = currentVersion

	if a.config.Runtime.SaveDatabaseOnExit && (!status.DatabaseExists || len(status.AppliedVersions) > 0) {
		if err := a.saveDatabase(runtime); err != nil {
			return status, err
		}
	}

	return status, nil
}

func (a *app) saveDatabase(runtime *wasmhost.Runtime) error {
	_, err := a.callPlugin(runtime, "sql", "save_binary", []byte(a.paths.Database))
	return err
}

func (a *app) loadMigrationIndex() (migrationIndex, error) {
	data, err := os.ReadFile(filepath.Join(a.paths.Migrations, "index.json"))
	if err != nil {
		return migrationIndex{}, err
	}
	var index migrationIndex
	if err := json.Unmarshal(data, &index); err != nil {
		return migrationIndex{}, err
	}
	sort.Slice(index.Migrations, func(i, j int) bool {
		return index.Migrations[i].Version < index.Migrations[j].Version
	})
	return index, nil
}

func (a *app) ensureSchemaVersionTable(runtime *wasmhost.Runtime) error {
	const query = `
		CREATE TABLE IF NOT EXISTS schema_version (
		  version INTEGER PRIMARY KEY,
		  name TEXT NOT NULL,
		  applied_at TEXT DEFAULT (datetime('now'))
		);
	`
	_, err := a.callPlugin(runtime, "sql", "exec", []byte(query))
	return err
}

func (a *app) getSchemaVersion(runtime *wasmhost.Runtime) (int, error) {
	rows, err := a.queryCSV(runtime, "SELECT COALESCE(MAX(version), 0) as version FROM schema_version")
	if err != nil {
		return 0, err
	}
	if len(rows) < 2 || len(rows[1]) == 0 {
		return 0, nil
	}
	value, err := strconv.Atoi(strings.TrimSpace(rows[1][0]))
	if err != nil {
		return 0, err
	}
	return value, nil
}

func (a *app) recordMigration(runtime *wasmhost.Runtime, migration migrationEntry) error {
	query := fmt.Sprintf(
		"INSERT INTO schema_version (version, name) VALUES (%d, '%s');",
		migration.Version,
		strings.ReplaceAll(migration.Name, "'", "''"),
	)
	_, err := a.callPlugin(runtime, "sql", "exec", []byte(query))
	return err
}

func (a *app) enabledGlobalPlugins(runtime *wasmhost.Runtime) ([]pluginRecord, error) {
	rows, err := a.queryCSV(runtime, "SELECT name, url, enabled, type, scope FROM plugins WHERE enabled = 1 AND scope = 'global' ORDER BY type, rowid")
	if err != nil {
		return nil, err
	}
	plugins := make([]pluginRecord, 0, len(rows))
	seen := map[string]struct{}{}
	for _, row := range rows[1:] {
		if len(row) < 5 {
			continue
		}
		name := strings.TrimSpace(row[0])
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		plugins = append(plugins, pluginRecord{
			Name:    name,
			URL:     strings.TrimSpace(row[1]),
			Enabled: strings.TrimSpace(row[2]) == "1",
			Type:    strings.TrimSpace(row[3]),
			Scope:   strings.TrimSpace(row[4]),
		})
	}
	return plugins, nil
}

func (a *app) pluginByName(runtime *wasmhost.Runtime, name string) (pluginRecord, error) {
	quoted := strings.ReplaceAll(strings.TrimSpace(name), "'", "''")
	rows, err := a.queryCSV(runtime, fmt.Sprintf("SELECT name, url, enabled, type, scope FROM plugins WHERE name = '%s' ORDER BY rowid LIMIT 1", quoted))
	if err != nil {
		return pluginRecord{}, err
	}
	if len(rows) < 2 || len(rows[1]) < 5 {
		return pluginRecord{}, fmt.Errorf("plugin %q is not registered in database", name)
	}
	row := rows[1]
	return pluginRecord{
		Name:    strings.TrimSpace(row[0]),
		URL:     strings.TrimSpace(row[1]),
		Enabled: strings.TrimSpace(row[2]) == "1",
		Type:    strings.TrimSpace(row[3]),
		Scope:   strings.TrimSpace(row[4]),
	}, nil
}

func pluginModuleConfigs(plugins []pluginRecord) []wasmhost.ModuleConfig {
	modules := make([]wasmhost.ModuleConfig, 0, len(plugins))
	seen := map[string]struct{}{}
	for _, plugin := range plugins {
		if plugin.Name == "" || plugin.URL == "" {
			continue
		}
		if _, ok := seen[plugin.Name]; ok {
			continue
		}
		seen[plugin.Name] = struct{}{}
		modules = append(modules, wasmhost.ModuleConfig{Name: plugin.Name, Source: plugin.URL})
	}
	return modules
}

func (a *app) queryCSV(runtime *wasmhost.Runtime, query string) ([][]string, error) {
	output, err := a.callPlugin(runtime, "sql", "query", []byte(query))
	if err != nil {
		return nil, err
	}
	text := strings.TrimSpace(string(output))
	if text == "" {
		return [][]string{}, nil
	}
	reader := csv.NewReader(strings.NewReader(text))
	return reader.ReadAll()
}

func (a *app) callPlugin(runtime *wasmhost.Runtime, moduleName, functionName string, input []byte) ([]byte, error) {
	result, err := runtime.Call(moduleName, functionName, input)
	if err != nil {
		return nil, err
	}
	if result.ReturnCode != 0 {
		message := strings.TrimSpace(string(result.Output))
		if message == "" {
			message = fmt.Sprintf("plugin %s.%s failed with code %d", moduleName, functionName, result.ReturnCode)
		}
		return nil, errors.New(message)
	}
	return result.Output, nil
}

func (a *app) prepareRuntimeForRun(pluginName string) (*wasmhost.Runtime, []string, bootstrapStatus, error) {
	bootstrapRuntime, err := a.newRuntime(wasmhost.ModuleConfig{Name: "sql", Source: "local:/plugins/sql.wasm"})
	if err != nil {
		return nil, nil, bootstrapStatus{}, err
	}
	defer bootstrapRuntime.Close()

	status, err := a.bootstrapDatabase(bootstrapRuntime)
	if err != nil {
		return nil, nil, status, err
	}

	requested, err := a.pluginByName(bootstrapRuntime, pluginName)
	if err != nil {
		return nil, nil, status, err
	}

	plugins := []pluginRecord{{Name: "sql", URL: "local:/plugins/sql.wasm", Enabled: true, Type: "base", Scope: "global"}}
	if a.config.Runtime.LoadGlobalPlugins {
		globals, err := a.enabledGlobalPlugins(bootstrapRuntime)
		if err != nil {
			return nil, nil, status, err
		}
		plugins = append(plugins, globals...)
	}
	plugins = append(plugins, requested)
	moduleConfigs := pluginModuleConfigs(plugins)
	moduleNames := make([]string, 0, len(moduleConfigs))
	for _, module := range moduleConfigs {
		moduleNames = append(moduleNames, module.Name)
	}

	runtime, err := a.newRuntime(moduleConfigs...)
	if err != nil {
		return nil, nil, status, err
	}

	status, err = a.bootstrapDatabase(runtime)
	if err != nil {
		runtime.Close()
		return nil, nil, status, err
	}

	return runtime, moduleNames, status, nil
}

func sortStrings(values []string) []string {
	cloned := append([]string(nil), values...)
	sort.Strings(cloned)
	return cloned
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func detectConfigFileArg(args []string) string {
	for i := 0; i < len(args); i++ {
		arg := args[i]
		if arg == "--config" && i+1 < len(args) {
			return args[i+1]
		}
		if strings.HasPrefix(arg, "--config=") {
			return strings.TrimPrefix(arg, "--config=")
		}
	}
	return ""
}

func expandAliasArgs(args []string) ([]string, bool, error) {
	if len(args) == 0 {
		return args, false, nil
	}
	commandIndex := firstCommandIndex(args)
	if commandIndex < 0 {
		return args, false, nil
	}
	name := args[commandIndex]
	if isBuiltInRootCommand(name) {
		return args, false, nil
	}
	app := newConfiguredApp(detectConfigFileArg(args))
	alias, ok := app.aliasCommand(name)
	if !ok {
		return args, false, nil
	}
	expanded := strings.Fields(alias)
	if len(expanded) == 0 {
		return args, false, fmt.Errorf("alias %q is empty", name)
	}
	if expanded[0] == name {
		return args, false, fmt.Errorf("alias %q is recursive", name)
	}
	result := make([]string, 0, len(args)-1+len(expanded))
	result = append(result, args[:commandIndex]...)
	result = append(result, expanded...)
	result = append(result, args[commandIndex+1:]...)
	return result, true, nil
}

func isBuiltInRootCommand(name string) bool {
	switch name {
	case "help", "config", "plugins", "db", "run", "init":
		return true
	default:
		return false
	}
}

func firstCommandIndex(args []string) int {
	flagsWithValue := map[string]struct{}{
		"--config":         {},
		"--workdir":        {},
		"--plugins-dir":    {},
		"--migrations-dir": {},
		"--database":       {},
		"--log-level":      {},
	}
	for i := 0; i < len(args); i++ {
		arg := args[i]
		if arg == "--" {
			if i+1 < len(args) {
				return i + 1
			}
			return -1
		}
		if !strings.HasPrefix(arg, "-") || arg == "-h" || arg == "--help" {
			return i
		}
		if _, ok := flagsWithValue[arg]; ok {
			i++
			continue
		}
	}
	return -1
}

func withAppRun(a *app, fn func(cmd *cobra.Command, args []string) error) func(cmd *cobra.Command, args []string) error {
	return func(cmd *cobra.Command, args []string) error {
		if err := a.load(); err != nil {
			return err
		}
		return fn(cmd, args)
	}
}
