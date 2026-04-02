package sdk

import (
	"context"

	"github.com/justgook/wpm/sdk/internal"
)

type PluginManager = internal.PluginManager

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
	Module   string
	Function string
	Handler  any
}

type ByteHandler func(input []byte) (int32, []byte)

func New(ctx context.Context, config Config, wasmModules []Module, hostFunctions []HostFunction) (PluginManager, error) {
	internalModules := make([]internal.Module, len(wasmModules))
	for i, m := range wasmModules {
		internalModules[i] = internal.Module{Name: m.Name, WasmData: m.WasmData}
	}

	internalHostFunctions := make([]internal.HostFunction, len(hostFunctions))
	for i, f := range hostFunctions {
		var handler any = f.Handler
		if bh, ok := f.Handler.(ByteHandler); ok {
			handler = internal.ByteHandler(bh)
		}
		internalHostFunctions[i] = internal.HostFunction{
			ModuleName:   f.Module,
			FunctionName: f.Function,
			Handler:      handler,
		}
	}

	return internal.NewManager(ctx, internal.Config{
		EnableWASI:    config.EnableWASI,
		EnvModuleName: config.EnvModuleName,
		MaxCallDepth:  config.MaxCallDepth,
	}, internalModules, internalHostFunctions)
}
