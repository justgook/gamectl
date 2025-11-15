package main

import (
	"encoding/json"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/gamectl/plugins/treegen/treegen"
	"github.com/justgook/wpm/pdk"
)

type Input = struct {
	Name                        string `json:"name"`
	*treegen.GenerateTreeConfig `json:",inline"`
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
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}
	var req struct {
		ID   string    `json:"id"`
		Tree tree.Tree `json:"tree"`
	}

	req.ID = params.Name
	req.Tree = treegen.GenerateTree(&MyRandom{}, params.GenerateTreeConfig)

	storeJSON, err := json.Marshal(req)
	if err != nil {
		pdk.Output(util.ErrorResponse(err.Error()))
		return 1
	}

	_, _, callErr := pdk.Call("tree-storage", "set", storeJSON)
	if callErr != nil {
		pdk.Output(util.ErrorResponse(callErr.Error()))
		return 1
	}

	pdk.Output(util.SuccessResponse())
	return 0
}
