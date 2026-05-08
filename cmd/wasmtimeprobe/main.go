package main

// #include <wasm.h>
// #include <wasmtime/config.h>
import "C"

import (
	"fmt"
	"os"
	"unsafe"

	wasmtime "github.com/bytecodealliance/wasmtime-go/v43"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: wasmtimeprobe <wasm-path>")
		os.Exit(2)
	}

	wasmPath := os.Args[1]
	wasm, err := os.ReadFile(wasmPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read wasm: %v\n", err)
		os.Exit(1)
	}

	config := wasmtime.NewConfig()
	enableWasmExceptions(config)
	engine := wasmtime.NewEngineWithConfig(config)
	store := wasmtime.NewStore(engine)
	store.SetWasi(wasmtime.NewWasiConfig())

	module, err := wasmtime.NewModule(engine, wasm)
	if err != nil {
		fmt.Fprintf(os.Stderr, "compile module: %v\n", err)
		os.Exit(1)
	}

	linker := wasmtime.NewLinker(engine)
	if err := linker.DefineWasi(); err != nil {
		fmt.Fprintf(os.Stderr, "define wasi: %v\n", err)
		os.Exit(1)
	}

	linker.FuncWrap("env", "ng_on_node_changed", func(int32, int32) {})
	linker.FuncWrap("env", "ng_on_run_event", func(int32, int32, int32) {})
	linker.FuncWrap("env", "ng_on_goal_reached", func(int32, int32, int32) {})
	linker.FuncWrap("env", "input_len", func() int32 { return 0 })
	linker.FuncWrap("env", "input_ptr", func() int32 { return 0 })
	linker.FuncWrap("env", "set_output", func(int32, int32) {})
	linker.FuncWrap("env", "ng_host_resolve", func(int32, int32, int32, int32, int32, int32, int32) int32 { return 7 })
	linker.FuncWrap("env", "ng_host_request", func(int32, int32, int32, int32, int32, int32, int32, int32) int32 { return 7 })

	instance, err := linker.Instantiate(store, module)
	if err != nil {
		fmt.Fprintf(os.Stderr, "instantiate module: %v\n", err)
		os.Exit(1)
	}

	run := instance.GetFunc(store, "run")
	if run == nil {
		fmt.Fprintln(os.Stderr, "run export not found")
		os.Exit(1)
	}

	result, err := run.Call(store)
	if err != nil {
		fmt.Fprintf(os.Stderr, "call run: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("ok: compiled and instantiated %s\n", wasmPath)
	if result != nil {
		fmt.Printf("run result: %#v\n", result)
	}
}

func enableWasmExceptions(cfg *wasmtime.Config) {
	ptr := *(**C.wasm_config_t)(unsafe.Pointer(cfg))
	C.wasmtime_config_wasm_exceptions_set(ptr, true)
}
