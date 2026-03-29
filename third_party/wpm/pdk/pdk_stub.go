//go:build !js || !wasm

package pdk

import "fmt"

func Alloc(size uint64) uint32 { return 0 }

func Free(ptr uint32) {}

func InputPtr() uint32 { return 0 }

func InputLen() uint32 { return 0 }

func SetOutput(ptr uint32, len uint32) {}

func InputInfo() (ptr uint32, len uint32) {
	return 0, 0
}

func Input() []byte { return nil }

func Output(data []byte) {}

func Call(moduleName, functionName string, input []byte) (int32, []byte, error) {
	return 0, nil, fmt.Errorf("pdk is only available in wasm runtime")
}

func CallPlugin(pluginName, functionName string, input []byte) (int32, []byte, error) {
	return Call(pluginName, functionName, input)
}

func CallHost(functionName string, input []byte) (int32, []byte, error) {
	return Call("host", functionName, input)
}
