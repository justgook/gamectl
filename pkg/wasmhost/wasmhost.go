package wasmhost

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/justgook/wpm/sdk"
)

type Config struct {
	PluginsDir string
	Workdir    string
	Modules    []ModuleConfig
}

type ModuleConfig struct {
	Name   string
	Source string
}

type Runtime struct {
	ctx        context.Context
	cancel     context.CancelFunc
	manager    sdk.PluginManager
	pluginsDir string
	workdir    string
	modules    []ModuleConfig
	pluginPath map[string]string
}

type CallResult struct {
	ReturnCode int32  `json:"return_code"`
	Output     []byte `json:"output"`
}

func New(cfg Config) (*Runtime, error) {
	if cfg.PluginsDir == "" {
		return nil, fmt.Errorf("plugins dir is required")
	}

	ctx, cancel := context.WithCancel(context.Background())
	runtime := &Runtime{
		ctx:        ctx,
		cancel:     cancel,
		pluginsDir: cfg.PluginsDir,
		workdir:    cfg.Workdir,
		modules:    append([]ModuleConfig(nil), cfg.Modules...),
		pluginPath: map[string]string{},
	}

	modules, err := runtime.loadModules()
	if err != nil {
		cancel()
		return nil, err
	}

	manager, err := sdk.New(ctx, sdk.Config{
		EnableWASI:    true,
		EnvModuleName: "env",
		MaxCallDepth:  32,
	}, modules, runtime.hostFunctions())
	if err != nil {
		cancel()
		return nil, err
	}

	runtime.manager = manager
	return runtime, nil
}

func (r *Runtime) Close() error {
	if r.cancel != nil {
		defer r.cancel()
	}
	if r.manager == nil {
		return nil
	}
	return r.manager.Close()
}

func (r *Runtime) Call(pluginName, functionName string, input []byte) (CallResult, error) {
	if _, err := r.pluginLocation(pluginName); err != nil {
		return CallResult{}, err
	}

	returnCode, output, err := r.manager.Call(pluginName, functionName, input)
	if err != nil {
		return CallResult{}, err
	}

	return CallResult{ReturnCode: returnCode, Output: output}, nil
}

func (r *Runtime) ListPlugins() ([]string, error) {
	entries, err := os.ReadDir(r.pluginsDir)
	if err != nil {
		return nil, err
	}

	plugins := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if filepath.Ext(name) != ".wasm" {
			continue
		}
		plugins = append(plugins, strings.TrimSuffix(name, ".wasm"))
	}

	sort.Strings(plugins)
	return plugins, nil
}

func (r *Runtime) PluginPath(name string) (string, error) {
	return r.pluginLocation(name)
}

func (r *Runtime) pluginLocation(name string) (string, error) {
	if path, ok := r.pluginPath[name]; ok {
		return path, nil
	}
	path := filepath.Join(r.pluginsDir, name+".wasm")
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("plugin %q not found in %s", name, r.pluginsDir)
		}
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("plugin %q resolves to a directory", name)
	}
	return path, nil
}

func (r *Runtime) loadModules() ([]sdk.Module, error) {
	modules := make([]sdk.Module, 0, len(r.modules))
	for _, module := range r.modules {
		if strings.TrimSpace(module.Name) == "" {
			return nil, fmt.Errorf("module name is required")
		}
		resolved, err := r.resolveModuleSource(module.Source)
		if err != nil {
			return nil, fmt.Errorf("resolve plugin %s: %w", module.Name, err)
		}
		data, err := loadBytesFromSource(resolved)
		if err != nil {
			return nil, fmt.Errorf("read plugin %s: %w", module.Name, err)
		}
		r.pluginPath[module.Name] = resolved
		modules = append(modules, sdk.Module{Name: module.Name, WasmData: data})
	}

	return modules, nil
}

func ListPlugins(pluginsDir string) ([]string, error) {
	entries, err := os.ReadDir(pluginsDir)
	if err != nil {
		return nil, err
	}

	plugins := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if filepath.Ext(name) != ".wasm" {
			continue
		}
		plugins = append(plugins, strings.TrimSuffix(name, ".wasm"))
	}

	sort.Strings(plugins)
	return plugins, nil
}

func (r *Runtime) hostFunctions() []sdk.HostFunction {
	return []sdk.HostFunction{
		{Module: "host", Function: "log", Handler: sdk.ByteHandler(r.hostLog)},
		{Module: "fs", Function: "read", Handler: sdk.ByteHandler(r.fsRead)},
		{Module: "fs", Function: "write", Handler: sdk.ByteHandler(r.fsWrite)},
		{Module: "fs", Function: "delete", Handler: sdk.ByteHandler(r.fsDelete)},
		{Module: "fs", Function: "exists", Handler: sdk.ByteHandler(r.fsExists)},
		{Module: "fs", Function: "list", Handler: sdk.ByteHandler(r.fsList)},
		{Module: "fs", Function: "mkdir", Handler: sdk.ByteHandler(r.fsMkdir)},
		{Module: "fs", Function: "rmdir", Handler: sdk.ByteHandler(r.fsRmdir)},
		{Module: "fs", Function: "stat", Handler: sdk.ByteHandler(r.fsStat)},
	}
}

func (r *Runtime) hostLog(input []byte) (int32, []byte) {
	_, _ = fmt.Fprintln(os.Stderr, "[plugin]", string(input))
	return 0, []byte{}
}

func (r *Runtime) fsRead(input []byte) (int32, []byte) {
	path := string(input)
	switch {
	case strings.HasPrefix(path, "base64:"):
		data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(path, "base64:"))
		return resultBytes(data, err)
	case strings.HasPrefix(path, "data:"):
		return resultBytes(readDataURI(path))
	case strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://"):
		return resultBytes(readHTTP(path))
	case strings.HasPrefix(path, "local:"):
		resolved := r.resolveLocal(strings.TrimPrefix(path, "local:"))
		data, err := os.ReadFile(resolved)
		return resultBytes(data, err)
	default:
		resolved := r.resolvePath(path)
		data, err := os.ReadFile(resolved)
		return resultBytes(data, err)
	}
}

func (r *Runtime) fsWrite(input []byte) (int32, []byte) {
	path, data, err := splitWriteInput(input)
	if err != nil {
		return errorResult(err)
	}
	resolved := r.resolvePath(path)
	if err := os.MkdirAll(filepath.Dir(resolved), 0o755); err != nil {
		return errorResult(err)
	}
	if err := os.WriteFile(resolved, data, 0o644); err != nil {
		return errorResult(err)
	}
	return 0, []byte("OK")
}

func (r *Runtime) fsDelete(input []byte) (int32, []byte) {
	if err := os.Remove(r.resolvePath(string(input))); err != nil {
		return errorResult(err)
	}
	return 0, []byte("OK")
}

func (r *Runtime) fsExists(input []byte) (int32, []byte) {
	_, err := os.Stat(r.resolvePath(string(input)))
	if err == nil {
		return 0, []byte("true")
	}
	if os.IsNotExist(err) {
		return 0, []byte("false")
	}
	return errorResult(err)
}

func (r *Runtime) fsList(input []byte) (int32, []byte) {
	path := strings.TrimSpace(string(input))
	if path == "" {
		path = "/"
	}
	entries, err := os.ReadDir(r.resolvePath(path))
	if err != nil {
		return errorResult(err)
	}
	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	data, err := json.Marshal(names)
	return resultBytes(data, err)
}

func (r *Runtime) fsMkdir(input []byte) (int32, []byte) {
	if err := os.MkdirAll(r.resolvePath(string(input)), 0o755); err != nil {
		return errorResult(err)
	}
	return 0, []byte("OK")
}

func (r *Runtime) fsRmdir(input []byte) (int32, []byte) {
	if err := os.Remove(r.resolvePath(string(input))); err != nil {
		return errorResult(err)
	}
	return 0, []byte("OK")
}

func (r *Runtime) fsStat(input []byte) (int32, []byte) {
	info, err := os.Stat(r.resolvePath(string(input)))
	if err != nil {
		return errorResult(err)
	}
	type statResult struct {
		Size int64  `json:"size"`
		Type string `json:"type"`
	}
	kind := "file"
	if info.IsDir() {
		kind = "directory"
	}
	data, err := json.Marshal(statResult{Size: info.Size(), Type: kind})
	return resultBytes(data, err)
}

func (r *Runtime) resolveLocal(path string) string {
	trimmed := strings.TrimPrefix(path, "/")
	base := r.workdir
	if base == "" {
		base, _ = os.Getwd()
	}
	return filepath.Clean(filepath.Join(base, trimmed))
}

func (r *Runtime) resolvePath(path string) string {
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	base := r.workdir
	if base == "" {
		base, _ = os.Getwd()
	}
	return filepath.Clean(filepath.Join(base, path))
}

func (r *Runtime) resolveModuleSource(source string) (string, error) {
	trimmed := strings.TrimSpace(source)
	if trimmed == "" {
		return "", fmt.Errorf("module source is required")
	}
	switch {
	case strings.HasPrefix(trimmed, "base64:"), strings.HasPrefix(trimmed, "data:"), strings.HasPrefix(trimmed, "http://"), strings.HasPrefix(trimmed, "https://"):
		return trimmed, nil
	case strings.HasPrefix(trimmed, "local:"):
		localPath := strings.TrimPrefix(trimmed, "local:")
		if strings.HasPrefix(localPath, "/plugins/") {
			return filepath.Clean(filepath.Join(r.pluginsDir, strings.TrimPrefix(localPath, "/plugins/"))), nil
		}
		return r.resolveLocal(localPath), nil
	case filepath.IsAbs(trimmed):
		return filepath.Clean(trimmed), nil
	default:
		return r.resolvePath(trimmed), nil
	}
}

func splitWriteInput(input []byte) (string, []byte, error) {
	idx := bytesIndex(input, 0)
	if idx < 0 {
		return "", nil, fmt.Errorf("invalid format: missing null byte separator between path and data")
	}
	return string(input[:idx]), input[idx+1:], nil
}

func bytesIndex(data []byte, target byte) int {
	for i, b := range data {
		if b == target {
			return i
		}
	}
	return -1
}

func readHTTP(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("http read failed: %s", resp.Status)
	}
	return io.ReadAll(resp.Body)
}

func loadBytesFromSource(source string) ([]byte, error) {
	switch {
	case strings.HasPrefix(source, "base64:"):
		return base64.StdEncoding.DecodeString(strings.TrimPrefix(source, "base64:"))
	case strings.HasPrefix(source, "data:"):
		return readDataURI(source)
	case strings.HasPrefix(source, "http://") || strings.HasPrefix(source, "https://"):
		return readHTTP(source)
	default:
		return os.ReadFile(source)
	}
}

func readDataURI(input string) ([]byte, error) {
	comma := strings.IndexByte(input, ',')
	if comma < 0 {
		return nil, fmt.Errorf("invalid data URI: missing comma separator")
	}
	meta := input[5:comma]
	data := input[comma+1:]
	if strings.HasSuffix(meta, ";base64") {
		return base64.StdEncoding.DecodeString(data)
	}
	return []byte(data), nil
}

func resultBytes(data []byte, err error) (int32, []byte) {
	if err != nil {
		return errorResult(err)
	}
	return 0, data
}

func errorResult(err error) (int32, []byte) {
	return 1, []byte(err.Error())
}
