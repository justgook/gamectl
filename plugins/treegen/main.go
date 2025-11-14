package main

import (
	"encoding/json"

	"github.com/justgook/wpm/pdk"
)

type Input = struct {
	Name               string `json:"name"`
	GenerateTreeConfig `json:",inline"`
}

type SuccessResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

//go:wasmimport random next
func nextRand() float32

type MyRandom struct{}

func (rng *MyRandom) Float64() float64 {
	return float64(nextRand())
}

func (rng *MyRandom) Intn(n int) int {
	return int(nextRand()*float32(n) + 0.5)
}

// func (r *Rand) Int63n(n int64) int64 {
// 	if n <= 0 {
// 		panic("invalid argument to Int63n")
// 	}
// 	if n&(n-1) == 0 { // n is power of two, can mask
// 		return r.Int63() & (n - 1)
// 	}
// 	max := int64((1 << 63) - 1 - (1<<63)%uint64(n))
// 	v := r.Int63()
// 	for v > max {
// 		v = r.Int63()
// 	}
// 	return v % n
// }

//export gen
func Gen() uint32 {
	input := pdk.Input()

	params := Input{}
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	rng := &MyRandom{}
	GenerateTree(params.GenerateTreeConfig, rng)

	pdk.Output(successResponse())
	return 0
}

func successResponse() []byte {
	resp := SuccessResponse{Success: true}
	data, _ := json.Marshal(resp)
	return data
}

func errorResponse(msg string) []byte {
	resp := SuccessResponse{Success: false, Error: msg}
	data, _ := json.Marshal(resp)
	return data
}
