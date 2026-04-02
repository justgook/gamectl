package internal

import (
	"context"
	"fmt"
	"io/fs"

	"github.com/tetratelabs/wazero"
	"github.com/tetratelabs/wazero/api"
	"github.com/tetratelabs/wazero/imports/wasi_snapshot_preview1"
)

type PluginManager interface {
	Call(moduleName, functionName string, input []byte) (int32, []byte, error)
	Close() error
}

type Config struct {
	EnableWASI    bool
	EnvModuleName string
	MaxCallDepth  int
}

type Module struct {
	Name     string
	WasmData []byte
}

type HostFunction struct {
	ModuleName   string
	FunctionName string
	Handler      any
}

type ByteHandler func(input []byte) (int32, []byte)

type callContext struct {
	moduleName string
	inputPtr   uint32
	inputLen   uint32
	outputPtr  uint32
	outputLen  uint32
}

type manager struct {
	runtime           wazero.Runtime
	wasmModules       map[string]api.Module
	hostModules       map[string]api.Module
	hostFunctionDefs  map[string]map[string]HostFunction
	envModuleName     string
	config            Config
	memoryOffsets     map[string]uint32
	currentInputPtr   uint32
	currentInputLen   uint32
	currentOutputPtr  uint32
	currentOutputLen  uint32
	callStack         []*callContext
	lastCallReturn    int32
	lastCallOutputPtr uint32
	lastCallOutputLen uint32
}

func NewManager(ctx context.Context, config Config, wasmModules []Module, hostFunctions []HostFunction) (PluginManager, error) {
	r := wazero.NewRuntime(ctx)
	if config.EnableWASI {
		wasi_snapshot_preview1.MustInstantiate(ctx, r)
	}
	envName := config.EnvModuleName
	if envName == "" {
		envName = "env"
	}
	mgr := &manager{
		runtime:          r,
		wasmModules:      map[string]api.Module{},
		hostModules:      map[string]api.Module{},
		hostFunctionDefs: map[string]map[string]HostFunction{},
		envModuleName:    envName,
		config:           config,
		memoryOffsets:    map[string]uint32{},
	}
	if err := mgr.setupHostFunctions(ctx, hostFunctions); err != nil {
		_ = r.Close(ctx)
		return nil, err
	}
	for _, module := range wasmModules {
		if err := mgr.loadWasmModule(ctx, module); err != nil {
			_ = r.Close(ctx)
			return nil, err
		}
	}
	return mgr, nil
}

func (m *manager) setupHostFunctions(ctx context.Context, hostFunctions []HostFunction) error {
	byModule := map[string][]HostFunction{}
	for _, fn := range hostFunctions {
		byModule[fn.ModuleName] = append(byModule[fn.ModuleName], fn)
		if m.hostFunctionDefs[fn.ModuleName] == nil {
			m.hostFunctionDefs[fn.ModuleName] = map[string]HostFunction{}
		}
		m.hostFunctionDefs[fn.ModuleName][fn.FunctionName] = fn
	}
	if _, ok := byModule[m.envModuleName]; !ok {
		byModule[m.envModuleName] = nil
	}
	for moduleName, functions := range byModule {
		builder := m.runtime.NewHostModuleBuilder(moduleName)
		if moduleName == m.envModuleName {
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.allocFunc), []api.ValueType{api.ValueTypeI64}, []api.ValueType{api.ValueTypeI32}).Export("alloc")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.freeFunc), []api.ValueType{api.ValueTypeI32}, nil).Export("free")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.inputPtrFunc), nil, []api.ValueType{api.ValueTypeI32}).Export("input_ptr")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.inputLenFunc), nil, []api.ValueType{api.ValueTypeI32}).Export("input_len")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.setOutputFunc), []api.ValueType{api.ValueTypeI32, api.ValueTypeI32}, nil).Export("set_output")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.pluginCallFunc), []api.ValueType{api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32}, []api.ValueType{api.ValueTypeI32}).Export("plugin_call")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.pluginCallReturnFunc), nil, []api.ValueType{api.ValueTypeI32}).Export("plugin_call_return")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.pluginCallOutputPtrFunc), nil, []api.ValueType{api.ValueTypeI32}).Export("plugin_call_output_ptr")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.pluginCallOutputLenFunc), nil, []api.ValueType{api.ValueTypeI32}).Export("plugin_call_output_len")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.noopNodeChangedFunc), []api.ValueType{api.ValueTypeI32, api.ValueTypeI32}, nil).Export("ng_on_node_changed")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.noopRunEventFunc), []api.ValueType{api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32}, nil).Export("ng_on_run_event")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.noopGoalReachedFunc), []api.ValueType{api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32}, nil).Export("ng_on_goal_reached")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.ngHostResolveFunc), []api.ValueType{api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32}, []api.ValueType{api.ValueTypeI32}).Export("ng_host_resolve")
			builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(m.ngHostRequestFunc), []api.ValueType{api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32, api.ValueTypeI32}, []api.ValueType{api.ValueTypeI32}).Export("ng_host_request")
		} else {
			for _, fn := range functions {
				byteHandler, ok := fn.Handler.(ByteHandler)
				if !ok {
					return fmt.Errorf("host function %s.%s must use ByteHandler", fn.ModuleName, fn.FunctionName)
				}
				builder.NewFunctionBuilder().WithGoModuleFunction(api.GoModuleFunc(func(ctx context.Context, mod api.Module, stack []uint64) {
					var input []byte
					if m.currentInputLen > 0 {
						callingMod := mod
						if len(m.callStack) > 0 {
							if wasmMod, exists := m.wasmModules[m.callStack[len(m.callStack)-1].moduleName]; exists {
								callingMod = wasmMod
							}
						}
						if buf, ok := callingMod.Memory().Read(m.currentInputPtr, m.currentInputLen); ok {
							input = buf
						}
					}
					returnCode, output := byteHandler(input)
					m.currentOutputPtr = 0
					m.currentOutputLen = 0
					if len(output) > 0 {
						callingMod := mod
						if len(m.callStack) > 0 {
							if wasmMod, exists := m.wasmModules[m.callStack[len(m.callStack)-1].moduleName]; exists {
								callingMod = wasmMod
							}
						}
						outputPtr := m.allocate(callingMod, uint32(len(output)))
						if outputPtr != 0 && callingMod.Memory().Write(outputPtr, output) {
							m.currentOutputPtr = outputPtr
							m.currentOutputLen = uint32(len(output))
						}
					}
					stack[0] = uint64(uint32(returnCode))
				}), nil, []api.ValueType{api.ValueTypeI32}).Export(fn.FunctionName)
			}
		}
		inst, err := builder.Instantiate(ctx)
		if err != nil {
			return err
		}
		m.hostModules[moduleName] = inst
	}
	return nil
}

func (m *manager) loadWasmModule(ctx context.Context, module Module) error {
	config := wazero.NewModuleConfig().WithName(module.Name)
	if m.config.EnableWASI {
		config = config.WithFS(emptyFS{})
	}
	mod, err := m.runtime.InstantiateWithConfig(ctx, module.WasmData, config)
	if err != nil {
		return fmt.Errorf("instantiate module %s: %w", module.Name, err)
	}
	if initFn := mod.ExportedFunction("_initialize"); initFn != nil {
		if _, err := initFn.Call(ctx); err != nil {
			return fmt.Errorf("initialize module %s: %w", module.Name, err)
		}
	}
	m.wasmModules[module.Name] = mod
	return nil
}

type emptyFS struct{}

func (emptyFS) Open(string) (fs.File, error) { return nil, fs.ErrNotExist }

func (m *manager) Call(moduleName, functionName string, input []byte) (int32, []byte, error) {
	return m.callWithContext(context.Background(), moduleName, functionName, input)
}

func (m *manager) callWithContext(ctx context.Context, moduleName, functionName string, input []byte) (int32, []byte, error) {
	if mod, ok := m.wasmModules[moduleName]; ok {
		return m.callWasmFunction(ctx, mod, functionName, input)
	}
	if _, ok := m.hostModules[moduleName]; ok {
		return m.callHostFunction(moduleName, functionName, input)
	}
	return 0, nil, fmt.Errorf("module %s not found", moduleName)
}

func (m *manager) callWasmFunction(ctx context.Context, mod api.Module, functionName string, input []byte) (int32, []byte, error) {
	inputPtr := uint32(0)
	if len(input) > 0 {
		inputPtr = m.allocate(mod, uint32(len(input)))
		if inputPtr == 0 || !mod.Memory().Write(inputPtr, input) {
			return 0, nil, fmt.Errorf("failed to write input to memory")
		}
	}
	m.currentInputPtr = inputPtr
	m.currentInputLen = uint32(len(input))
	m.currentOutputPtr = 0
	m.currentOutputLen = 0
	fn := mod.ExportedFunction(functionName)
	if fn == nil {
		return 0, nil, fmt.Errorf("function %s not found in module %s", functionName, mod.Name())
	}
	results, err := fn.Call(ctx)
	if err != nil {
		return 0, nil, fmt.Errorf("failed to call function %s: %w", functionName, err)
	}
	var returnValue int32
	if len(results) > 0 {
		returnValue = int32(results[0])
	}
	if m.currentOutputPtr == 0 || m.currentOutputLen == 0 {
		return returnValue, []byte{}, nil
	}
	output, ok := mod.Memory().Read(m.currentOutputPtr, m.currentOutputLen)
	if !ok {
		return 0, nil, fmt.Errorf("failed to read output from memory")
	}
	cloned := append([]byte(nil), output...)
	return returnValue, cloned, nil
}

func (m *manager) callHostFunction(moduleName, functionName string, input []byte) (int32, []byte, error) {
	functions, ok := m.hostFunctionDefs[moduleName]
	if !ok {
		return 0, nil, fmt.Errorf("host module %s not found", moduleName)
	}
	fn, ok := functions[functionName]
	if !ok {
		return 0, nil, fmt.Errorf("function %s not found in host module %s", functionName, moduleName)
	}
	byteHandler, ok := fn.Handler.(ByteHandler)
	if !ok {
		return 0, nil, fmt.Errorf("host function %s.%s must use ByteHandler", moduleName, functionName)
	}
	returnCode, output := byteHandler(input)
	return returnCode, output, nil
}

func (m *manager) Close() error {
	for _, mod := range m.wasmModules {
		_ = mod.Close(context.Background())
	}
	for _, mod := range m.hostModules {
		_ = mod.Close(context.Background())
	}
	return m.runtime.Close(context.Background())
}

func (m *manager) allocFunc(ctx context.Context, mod api.Module, stack []uint64) {
	stack[0] = uint64(m.allocate(mod, uint32(stack[0])))
}

func (m *manager) freeFunc(context.Context, api.Module, []uint64) {}

func (m *manager) inputPtrFunc(ctx context.Context, mod api.Module, stack []uint64) {
	stack[0] = uint64(m.currentInputPtr)
}

func (m *manager) inputLenFunc(ctx context.Context, mod api.Module, stack []uint64) {
	stack[0] = uint64(m.currentInputLen)
}

func (m *manager) setOutputFunc(ctx context.Context, mod api.Module, stack []uint64) {
	m.currentOutputPtr = uint32(stack[0])
	m.currentOutputLen = uint32(stack[1])
}

func (m *manager) pluginCallFunc(ctx context.Context, mod api.Module, stack []uint64) {
	memory := mod.Memory()
	moduleName, ok := memory.Read(uint32(stack[0]), uint32(stack[1]))
	if !ok {
		stack[0] = 1
		return
	}
	functionName, ok := memory.Read(uint32(stack[2]), uint32(stack[3]))
	if !ok {
		stack[0] = 2
		return
	}
	var input []byte
	if stack[5] > 0 {
		input, ok = memory.Read(uint32(stack[4]), uint32(stack[5]))
		if !ok {
			stack[0] = 3
			return
		}
	}
	maxDepth := m.config.MaxCallDepth
	if maxDepth == 0 {
		maxDepth = 10
	}
	if len(m.callStack) >= maxDepth {
		stack[0] = 4
		return
	}
	currentCtx := &callContext{moduleName: mod.Name(), inputPtr: m.currentInputPtr, inputLen: m.currentInputLen, outputPtr: m.currentOutputPtr, outputLen: m.currentOutputLen}
	m.callStack = append(m.callStack, currentCtx)
	returnValue, output, err := m.callWithContext(ctx, string(moduleName), string(functionName), input)
	m.callStack = m.callStack[:len(m.callStack)-1]
	m.currentInputPtr = currentCtx.inputPtr
	m.currentInputLen = currentCtx.inputLen
	m.currentOutputPtr = currentCtx.outputPtr
	m.currentOutputLen = currentCtx.outputLen
	if err != nil {
		stack[0] = 5
		return
	}
	m.lastCallReturn = returnValue
	m.lastCallOutputPtr = 0
	m.lastCallOutputLen = 0
	if len(output) > 0 {
		outputPtr := m.allocate(mod, uint32(len(output)))
		if outputPtr == 0 || !memory.Write(outputPtr, output) {
			stack[0] = 6
			return
		}
		m.lastCallOutputPtr = outputPtr
		m.lastCallOutputLen = uint32(len(output))
	}
	stack[0] = 0
}

func (m *manager) pluginCallReturnFunc(ctx context.Context, mod api.Module, stack []uint64) {
	stack[0] = uint64(uint32(m.lastCallReturn))
}

func (m *manager) pluginCallOutputPtrFunc(ctx context.Context, mod api.Module, stack []uint64) {
	stack[0] = uint64(m.lastCallOutputPtr)
}

func (m *manager) pluginCallOutputLenFunc(ctx context.Context, mod api.Module, stack []uint64) {
	stack[0] = uint64(m.lastCallOutputLen)
}

func (m *manager) noopNodeChangedFunc(ctx context.Context, mod api.Module, stack []uint64) {}

func (m *manager) noopRunEventFunc(ctx context.Context, mod api.Module, stack []uint64) {}

func (m *manager) noopGoalReachedFunc(ctx context.Context, mod api.Module, stack []uint64) {}

func (m *manager) ngHostResolveFunc(ctx context.Context, mod api.Module, stack []uint64) {
	stack[0] = 7
}

func (m *manager) ngHostRequestFunc(ctx context.Context, mod api.Module, stack []uint64) {
	stack[0] = 7
}

func (m *manager) allocate(mod api.Module, size uint32) uint32 {
	if size == 0 {
		size = 1
	}
	memory := mod.Memory()
	if memory == nil {
		return 0
	}
	name := mod.Name()
	offset := m.memoryOffsets[name]
	currentSize := memory.Size()
	if currentSize == 0 {
		pages, _ := memory.Grow(0)
		currentSize = pages * 65536
	}
	if offset == 0 {
		offset = currentSize
	}
	required := uint64(offset) + uint64(size)
	if required > uint64(currentSize) {
		deltaPages := uint32((required - uint64(currentSize) + 65535) / 65536)
		if _, ok := memory.Grow(deltaPages); !ok {
			return 0
		}
	}
	m.memoryOffsets[name] = offset + size
	return offset
}
