//go:build !tinygo && !wasm

package main

func randomFloat64() float64 {
	return 0.5
}
