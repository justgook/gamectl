package wasmhost

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type Config struct {
	PluginsDir string
}

type Runtime struct {
	pluginsDir string
}

type CallResult struct {
	ReturnCode int32  `json:"return_code"`
	Output     []byte `json:"output"`
	Status     string `json:"status"`
}

func New(cfg Config) (*Runtime, error) {
	if cfg.PluginsDir == "" {
		return nil, fmt.Errorf("plugins dir is required")
	}
	return &Runtime{pluginsDir: cfg.PluginsDir}, nil
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
	path := filepath.Join(r.pluginsDir, name+".wasm")
	info, err := os.Stat(path)
	if err != nil {
		if errorsIsNotExist(err) {
			return "", fmt.Errorf("plugin %q not found in %s", name, r.pluginsDir)
		}
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("plugin %q resolves to a directory", name)
	}
	return path, nil
}

func (r *Runtime) Call(pluginName, functionName string, input []byte) (CallResult, error) {
	pluginPath, err := r.PluginPath(pluginName)
	if err != nil {
		return CallResult{}, err
	}

	return CallResult{
		ReturnCode: -1,
		Output:     input,
		Status: fmt.Sprintf(
			"runtime call not implemented yet; resolved %s and prepared function %s",
			pluginPath,
			functionName,
		),
	}, nil
}

func errorsIsNotExist(err error) bool {
	return err != nil && (os.IsNotExist(err) || err == fs.ErrNotExist)
}
