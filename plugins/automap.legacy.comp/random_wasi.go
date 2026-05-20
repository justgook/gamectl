//go:build tinygo || wasm

package main

import wasirandom "github.com/kkgams/automap/internal/wasi/random/random"

func randomFloat64() float64 {
	return float64(wasirandom.GetRandomU64()>>11) / (1 << 53)
}
