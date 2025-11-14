package main

import (
	"encoding/json"

	"github.com/justgook/gamectl/pkg/tree3"
	"github.com/justgook/wpm/pdk"
)

type Input = struct {
	Name               string `json:"name"`
	GenerateTreeConfig `json:",inline"`
}

type SuccessResponse struct {
	Success bool        `json:"success"`
	Error   string      `json:"error,omitempty"`
	Data    *tree3.Tree `json:"data,omitempty"`
}

//go:wasmimport random next
func nextRand() float32

//go:wasmimport random float64
func rndF64() float64

//go:wasmimport random intn
func rndIntn(n uint32) uint32

type MyRandom struct{}

func (rng *MyRandom) Float64() float64 {
	return rndF64()
}
func (rng *MyRandom) Intn(n int) int {
	return int(rndIntn(uint32(n)))
}

//export gen
func Gen() uint32 {
	input := pdk.Input()
	params := Input{}
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}
	var req struct {
		ID   string     `json:"id"`
		Tree tree3.Tree `json:"tree"`
	}

	req.ID = params.Name
	req.Tree = GenerateTree(params.GenerateTreeConfig, &MyRandom{})

	storeJSON, err := json.Marshal(req)
	if err != nil {
		pdk.Output(errorResponse(err.Error()))
		return 1
	}

	_, _, callErr := pdk.Call("tree-storage2", "set", storeJSON)
	if callErr != nil {
		pdk.Output(errorResponse(callErr.Error()))
		return 1
	}

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
