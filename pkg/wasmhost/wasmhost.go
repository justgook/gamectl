package wasmhost

/*
#include <stdbool.h>
typedef struct wasm_config_t wasm_config_t;
void wasmtime_config_wasm_exceptions_set(wasm_config_t*, bool);
*/
import "C"

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"unsafe"

	wasmtime "github.com/bytecodealliance/wasmtime-go/v43"
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

type HostFunction struct {
	Module   string
	Function string
	Handler  ByteHandler
}

type ByteHandler func(input []byte) (int32, []byte)

type Runtime struct {
	ctx        context.Context
	cancel     context.CancelFunc
	manager    *wasmtimeManager
	pluginsDir string
	workdir    string
	modules    []ModuleConfig
	pluginPath map[string]string
}

type CallResult struct {
	ReturnCode int32  `json:"return_code"`
	Output     []byte `json:"output"`
}

type loadedModule struct {
	Name     string
	WasmData []byte
}

func New(cfg Config) (*Runtime, error) {
	if cfg.PluginsDir == "" {
		return nil, fmt.Errorf("plugins dir is required")
	}

	ctx, cancel := context.WithCancel(context.Background())
	r := &Runtime{
		ctx:        ctx,
		cancel:     cancel,
		pluginsDir: cfg.PluginsDir,
		workdir:    cfg.Workdir,
		modules:    append([]ModuleConfig(nil), cfg.Modules...),
		pluginPath: map[string]string{},
	}

	modules, err := r.loadModules()
	if err != nil {
		cancel()
		return nil, err
	}

	manager, err := newWasmtimeManager(r, modules)
	if err != nil {
		cancel()
		return nil, err
	}
	r.manager = manager
	return r, nil
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
	return ListPlugins(r.pluginsDir)
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

func (r *Runtime) loadModules() ([]loadedModule, error) {
	modules := make([]loadedModule, 0, len(r.modules))
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
		modules = append(modules, loadedModule{Name: module.Name, WasmData: data})
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

func (r *Runtime) hostFunctions() []HostFunction {
	return []HostFunction{
		{Module: "host", Function: "log", Handler: r.hostLog},
		{Module: "fs", Function: "read", Handler: r.fsRead},
		{Module: "fs", Function: "write", Handler: r.fsWrite},
		{Module: "fs", Function: "writeJson", Handler: r.fsWriteJSON},
		{Module: "fs", Function: "writeBin", Handler: r.fsWriteBin},
		{Module: "fs", Function: "delete", Handler: r.fsDelete},
		{Module: "fs", Function: "exists", Handler: r.fsExists},
		{Module: "fs", Function: "list", Handler: r.fsList},
		{Module: "fs", Function: "mkdir", Handler: r.fsMkdir},
		{Module: "fs", Function: "rmdir", Handler: r.fsRmdir},
		{Module: "fs", Function: "stat", Handler: r.fsStat},
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
	case strings.HasPrefix(path, "image:"):
		data, err := r.readImageProtocol(path)
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

func (r *Runtime) fsWriteJSON(input []byte) (int32, []byte) {
	var payload struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(input, &payload); err != nil {
		return errorResult(err)
	}
	encoded := append([]byte(payload.Path), 0)
	encoded = append(encoded, []byte(payload.Content)...)
	return r.fsWrite(encoded)
}

func (r *Runtime) fsWriteBin(input []byte) (int32, []byte) {
	var payload struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(input, &payload); err != nil {
		return errorResult(err)
	}
	data, err := base64.StdEncoding.DecodeString(payload.Content)
	if err != nil {
		return errorResult(err)
	}
	encoded := append([]byte(payload.Path), 0)
	encoded = append(encoded, data...)
	return r.fsWrite(encoded)
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
	if trimmed == "assets" || strings.HasPrefix(trimmed, "assets/") {
		return filepath.Clean(filepath.Join(base, "cmd", "browser", trimmed))
	}
	return filepath.Clean(filepath.Join(base, trimmed))
}

func (r *Runtime) resolvePath(path string) string {
	base := r.workdir
	if base == "" {
		base, _ = os.Getwd()
	}
	cleanBase := filepath.Clean(base)
	cleanPath := filepath.Clean(path)
	if filepath.IsAbs(cleanPath) {
		if cleanPath == cleanBase || strings.HasPrefix(cleanPath, cleanBase+string(os.PathSeparator)) {
			return cleanPath
		}
		return filepath.Clean(filepath.Join(cleanBase, strings.TrimPrefix(cleanPath, string(os.PathSeparator))))
	}
	return filepath.Clean(filepath.Join(cleanBase, cleanPath))
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

type wasmtimeCallContext struct {
	moduleName string
	inputPtr   uint32
	inputLen   uint32
	outputPtr  uint32
	outputLen  uint32
}

type wasmtimeModuleState struct {
	module   *wasmtime.Module
	instance *wasmtime.Instance
}

type wasmtimeManager struct {
	engine            *wasmtime.Engine
	store             *wasmtime.Store
	linker            *wasmtime.Linker
	wasmModules       map[string]*wasmtimeModuleState
	hostFunctionDefs  map[string]map[string]HostFunction
	memoryOffsets     map[string]uint32
	currentInputPtr   uint32
	currentInputLen   uint32
	currentOutputPtr  uint32
	currentOutputLen  uint32
	callStack         []*wasmtimeCallContext
	lastCallReturn    int32
	lastCallOutputPtr uint32
	lastCallOutputLen uint32
}

func newWasmtimeManager(runtimeHost *Runtime, modules []loadedModule) (*wasmtimeManager, error) {
	cfg := wasmtime.NewConfig()
	enableWasmExceptions(cfg)
	cfg.SetWasmReferenceTypes(true)
	cfg.SetWasmMultiValue(true)
	cfg.SetWasmFunctionReferences(true)
	engine := wasmtime.NewEngineWithConfig(cfg)
	store := wasmtime.NewStore(engine)
	store.SetWasi(wasmtime.NewWasiConfig())
	linker := wasmtime.NewLinker(engine)
	if err := linker.DefineWasi(); err != nil {
		return nil, err
	}

	m := &wasmtimeManager{
		engine:           engine,
		store:            store,
		linker:           linker,
		wasmModules:      map[string]*wasmtimeModuleState{},
		hostFunctionDefs: map[string]map[string]HostFunction{},
		memoryOffsets:    map[string]uint32{},
	}

	if err := m.setupHostFunctions(runtimeHost.hostFunctions()); err != nil {
		m.Close()
		return nil, err
	}
	for _, module := range modules {
		if err := m.loadWasmModule(module); err != nil {
			m.Close()
			return nil, err
		}
	}
	return m, nil
}

func (m *wasmtimeManager) setupHostFunctions(hostFunctions []HostFunction) error {
	for _, fn := range hostFunctions {
		if m.hostFunctionDefs[fn.Module] == nil {
			m.hostFunctionDefs[fn.Module] = map[string]HostFunction{}
		}
		m.hostFunctionDefs[fn.Module][fn.Function] = fn
		handler := fn.Handler
		if err := m.linker.FuncWrap(fn.Module, fn.Function, func(c *wasmtime.Caller) int32 {
			input, err := m.readCurrentInput(c)
			if err != nil {
				return 1
			}
			returnCode, output := handler(input)
			m.currentOutputPtr = 0
			m.currentOutputLen = 0
			if len(output) > 0 {
				moduleName, err := m.moduleNameForCaller(c)
				if err != nil {
					return 1
				}
				ptr, err := m.allocateForModule(moduleName, uint32(len(output)))
				if err != nil {
					return 1
				}
				if err := m.writeModuleMemory(moduleName, ptr, output); err != nil {
					return 1
				}
				m.currentOutputPtr = ptr
				m.currentOutputLen = uint32(len(output))
			}
			return returnCode
		}); err != nil {
			return err
		}
	}

	defines := []struct {
		module string
		name   string
		fn     interface{}
	}{
		{"env", "alloc", func(c *wasmtime.Caller, size int64) int32 { return int32(m.alloc(c, uint32(size))) }},
		{"env", "free", func(int32) {}},
		{"env", "input_ptr", func() int32 { return int32(m.currentInputPtr) }},
		{"env", "input_len", func() int32 { return int32(m.currentInputLen) }},
		{"env", "set_output", func(ptr int32, length int32) { m.currentOutputPtr = uint32(ptr); m.currentOutputLen = uint32(length) }},
		{"env", "plugin_call", func(c *wasmtime.Caller, mp, ml, fp, fl, ip, il int32) int32 {
			return m.pluginCall(c, uint32(mp), uint32(ml), uint32(fp), uint32(fl), uint32(ip), uint32(il))
		}},
		{"env", "plugin_call_return", func() int32 { return m.lastCallReturn }},
		{"env", "plugin_call_output_ptr", func() int32 { return int32(m.lastCallOutputPtr) }},
		{"env", "plugin_call_output_len", func() int32 { return int32(m.lastCallOutputLen) }},
		{"env", "ng_on_node_changed", func(int32, int32) {}},
		{"env", "ng_on_run_event", func(int32, int32, int32) {}},
		{"env", "ng_on_goal_reached", func(int32, int32, int32) {}},
		{"env", "ng_host_resolve", func(int32, int32, int32, int32, int32, int32, int32) int32 { return 7 }},
		{"env", "ng_host_request", func(int32, int32, int32, int32, int32, int32, int32, int32) int32 { return 7 }},
	}
	for _, define := range defines {
		if err := m.linker.FuncWrap(define.module, define.name, define.fn); err != nil {
			return err
		}
	}

	return nil
}

func (m *wasmtimeManager) loadWasmModule(module loadedModule) error {
	compiled, err := wasmtime.NewModule(m.engine, module.WasmData)
	if err != nil {
		return fmt.Errorf("compile module %s: %w", module.Name, err)
	}
	instance, err := m.linker.Instantiate(m.store, compiled)
	if err != nil {
		return fmt.Errorf("instantiate module %s: %w", module.Name, err)
	}
	if err := m.linker.DefineInstance(m.store, module.Name, instance); err != nil {
		return fmt.Errorf("define module instance %s: %w", module.Name, err)
	}
	m.wasmModules[module.Name] = &wasmtimeModuleState{module: compiled, instance: instance}
	return nil
}

func (m *wasmtimeManager) Call(moduleName, functionName string, input []byte) (int32, []byte, error) {
	return m.callWithContext(moduleName, functionName, input)
}

func (m *wasmtimeManager) callWithContext(moduleName, functionName string, input []byte) (int32, []byte, error) {
	if _, ok := m.wasmModules[moduleName]; ok {
		return m.callWasmFunction(moduleName, functionName, input)
	}
	if _, ok := m.hostFunctionDefs[moduleName]; ok {
		return m.callHostFunction(moduleName, functionName, input)
	}
	return 0, nil, fmt.Errorf("module %s not found", moduleName)
}

func (m *wasmtimeManager) callWasmFunction(moduleName, functionName string, input []byte) (int32, []byte, error) {
	state := m.wasmModules[moduleName]
	if state == nil || state.instance == nil {
		return 0, nil, fmt.Errorf("module %s not found", moduleName)
	}

	inputPtr := uint32(0)
	if len(input) > 0 {
		ptr, err := m.allocateForModule(moduleName, uint32(len(input)))
		if err != nil {
			return 0, nil, err
		}
		if err := m.writeModuleMemory(moduleName, ptr, input); err != nil {
			return 0, nil, err
		}
		inputPtr = ptr
	}

	ctx := &wasmtimeCallContext{
		moduleName: moduleName,
		inputPtr:   m.currentInputPtr,
		inputLen:   m.currentInputLen,
		outputPtr:  m.currentOutputPtr,
		outputLen:  m.currentOutputLen,
	}
	m.callStack = append(m.callStack, ctx)
	defer func() {
		m.callStack = m.callStack[:len(m.callStack)-1]
		m.currentInputPtr = ctx.inputPtr
		m.currentInputLen = ctx.inputLen
		m.currentOutputPtr = ctx.outputPtr
		m.currentOutputLen = ctx.outputLen
	}()

	m.currentInputPtr = inputPtr
	m.currentInputLen = uint32(len(input))
	m.currentOutputPtr = 0
	m.currentOutputLen = 0

	fn := state.instance.GetFunc(m.store, functionName)
	if fn == nil {
		return 0, nil, fmt.Errorf("function %s not found in module %s", functionName, moduleName)
	}
	ft := fn.Type(m.store)
	params := ft.Params()
	var result any
	var err error
	switch len(params) {
	case 0:
		result, err = fn.Call(m.store)
	case 1:
		if params[0].Kind() != wasmtime.KindI32 {
			return 0, nil, fmt.Errorf("function %s in module %s has unsupported parameter type", functionName, moduleName)
		}
		result, err = fn.Call(m.store, int32(0))
	default:
		return 0, nil, fmt.Errorf("function %s in module %s has unsupported arity %d", functionName, moduleName, len(params))
	}
	if err != nil {
		return 0, nil, fmt.Errorf("failed to call function %s: %w", functionName, err)
	}

	var returnValue int32
	if result != nil {
		switch v := result.(type) {
		case int32:
			returnValue = v
		case int64:
			returnValue = int32(v)
		case uint32:
			returnValue = int32(v)
		case uint64:
			returnValue = int32(v)
		}
	}
	if m.currentOutputPtr == 0 || m.currentOutputLen == 0 {
		return returnValue, []byte{}, nil
	}
	output, err := m.readModuleMemory(moduleName, m.currentOutputPtr, m.currentOutputLen)
	if err != nil {
		return 0, nil, err
	}
	return returnValue, output, nil
}

func (m *wasmtimeManager) callHostFunction(moduleName, functionName string, input []byte) (int32, []byte, error) {
	functions, ok := m.hostFunctionDefs[moduleName]
	if !ok {
		return 0, nil, fmt.Errorf("host module %s not found", moduleName)
	}
	fn, ok := functions[functionName]
	if !ok {
		return 0, nil, fmt.Errorf("function %s not found in host module %s", functionName, moduleName)
	}
	returnCode, output := fn.Handler(input)
	return returnCode, output, nil
}

func (m *wasmtimeManager) Close() error {
	if m.linker != nil {
		m.linker.Close()
	}
	for _, state := range m.wasmModules {
		if state.module != nil {
			state.module.Close()
		}
	}
	if m.engine != nil {
		m.engine.Close()
	}
	return nil
}

func (m *wasmtimeManager) alloc(c *wasmtime.Caller, size uint32) uint32 {
	name, err := m.moduleNameForCaller(c)
	if err != nil {
		return 0
	}
	ptr, err := m.allocateForModule(name, size)
	if err != nil {
		return 0
	}
	return ptr
}

func (m *wasmtimeManager) pluginCall(c *wasmtime.Caller, modulePtr, moduleLen, funcPtr, funcLen, inputPtr, inputLen uint32) int32 {
	callerName, err := m.moduleNameForCaller(c)
	if err != nil {
		return 1
	}
	moduleName, err := m.readModuleMemory(callerName, modulePtr, moduleLen)
	if err != nil {
		return 1
	}
	functionName, err := m.readModuleMemory(callerName, funcPtr, funcLen)
	if err != nil {
		return 2
	}
	var input []byte
	if inputLen > 0 {
		input, err = m.readModuleMemory(callerName, inputPtr, inputLen)
		if err != nil {
			return 3
		}
	}
	if len(m.callStack) >= 32 {
		return 4
	}
	returnValue, output, err := m.callWithContext(string(moduleName), string(functionName), input)
	if err != nil {
		msg := []byte(err.Error())
		m.lastCallReturn = 1
		m.lastCallOutputPtr = 0
		m.lastCallOutputLen = 0
		if len(msg) > 0 {
			ptr, allocErr := m.allocateForModule(callerName, uint32(len(msg)))
			if allocErr == nil {
				if writeErr := m.writeModuleMemory(callerName, ptr, msg); writeErr == nil {
					m.lastCallOutputPtr = ptr
					m.lastCallOutputLen = uint32(len(msg))
				}
			}
		}
		return 0
	}
	m.lastCallReturn = returnValue
	m.lastCallOutputPtr = 0
	m.lastCallOutputLen = 0
	if len(output) > 0 {
		ptr, err := m.allocateForModule(callerName, uint32(len(output)))
		if err != nil {
			return 6
		}
		if err := m.writeModuleMemory(callerName, ptr, output); err != nil {
			return 6
		}
		m.lastCallOutputPtr = ptr
		m.lastCallOutputLen = uint32(len(output))
	}
	return 0
}

func (m *wasmtimeManager) readCurrentInput(c *wasmtime.Caller) ([]byte, error) {
	if m.currentInputLen == 0 {
		return nil, nil
	}
	name, err := m.moduleNameForCaller(c)
	if err != nil {
		return nil, err
	}
	return m.readModuleMemory(name, m.currentInputPtr, m.currentInputLen)
}

func (m *wasmtimeManager) moduleNameForCaller(c *wasmtime.Caller) (string, error) {
	callerMemory := c.GetExport("memory")
	if callerMemory == nil || callerMemory.Memory() == nil {
		return "", fmt.Errorf("caller memory not found")
	}
	callerPtr := callerMemory.Memory().Data(c)
	for name, state := range m.wasmModules {
		instanceMemory := state.instance.GetExport(m.store, "memory")
		if instanceMemory == nil || instanceMemory.Memory() == nil {
			continue
		}
		if callerPtr == instanceMemory.Memory().Data(m.store) {
			return name, nil
		}
	}
	return "", fmt.Errorf("caller module not found")
}

func (m *wasmtimeManager) moduleMemory(moduleName string) (*wasmtime.Memory, error) {
	state := m.wasmModules[moduleName]
	if state == nil || state.instance == nil {
		return nil, fmt.Errorf("module %s not found", moduleName)
	}
	extern := state.instance.GetExport(m.store, "memory")
	if extern == nil || extern.Memory() == nil {
		return nil, fmt.Errorf("module %s has no exported memory", moduleName)
	}
	return extern.Memory(), nil
}

func (m *wasmtimeManager) allocateForModule(moduleName string, size uint32) (uint32, error) {
	if size == 0 {
		size = 1
	}
	memory, err := m.moduleMemory(moduleName)
	if err != nil {
		return 0, err
	}
	pagesNeeded := uint64((size + 65535) / 65536)
	if pagesNeeded == 0 {
		pagesNeeded = 1
	}
	oldPages, err := memory.Grow(m.store, pagesNeeded)
	if err != nil {
		return 0, err
	}
	return uint32(oldPages) * 65536, nil
}

func (m *wasmtimeManager) writeModuleMemory(moduleName string, ptr uint32, data []byte) error {
	memory, err := m.moduleMemory(moduleName)
	if err != nil {
		return err
	}
	buf := memory.UnsafeData(m.store)
	start := int(ptr)
	end := start + len(data)
	if start < 0 || end > len(buf) {
		return fmt.Errorf("write exceeds memory bounds")
	}
	copy(buf[start:end], data)
	runtime.KeepAlive(memory)
	return nil
}

func (m *wasmtimeManager) readModuleMemory(moduleName string, ptr, length uint32) ([]byte, error) {
	memory, err := m.moduleMemory(moduleName)
	if err != nil {
		return nil, err
	}
	buf := memory.UnsafeData(m.store)
	start := int(ptr)
	end := start + int(length)
	if start < 0 || end > len(buf) {
		return nil, fmt.Errorf("read exceeds memory bounds")
	}
	cloned := append([]byte(nil), buf[start:end]...)
	runtime.KeepAlive(memory)
	return cloned, nil
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

func (r *Runtime) readImageProtocol(input string) ([]byte, error) {
	trimmed := strings.TrimPrefix(input, "image:")
	handleText := trimmed
	format := "qoi"
	if idx := strings.IndexByte(trimmed, '?'); idx >= 0 {
		handleText = trimmed[:idx]
		params, err := url.ParseQuery(trimmed[idx+1:])
		if err != nil {
			return nil, err
		}
		if v := params.Get("format"); v != "" {
			format = v
		}
	}
	handle, err := strconv.Atoi(handleText)
	if err != nil || handle <= 0 {
		return nil, fmt.Errorf("invalid image protocol handle: %q", handleText)
	}
	if format != "qoi" && format != "png" {
		return nil, fmt.Errorf("invalid image protocol format: %q", format)
	}
	payload, err := json.Marshal(map[string]any{"src": handle, "format": format})
	if err != nil {
		return nil, err
	}
	result, err := r.Call("image", "export", payload)
	if err != nil {
		return nil, err
	}
	if result.ReturnCode != 0 {
		return nil, fmt.Errorf("image protocol failed: %s", string(result.Output))
	}
	return result.Output, nil
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

func enableWasmExceptions(cfg *wasmtime.Config) {
	ptr := *(**C.wasm_config_t)(unsafe.Pointer(cfg))
	C.wasmtime_config_wasm_exceptions_set(ptr, true)
}
