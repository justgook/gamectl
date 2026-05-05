package main

import (
	"encoding/json"
	"fmt"

	"github.com/justgook/gams/pkg/util"
	"github.com/justgook/gams/plugins/treegen/treegen"
	"github.com/justgook/wpm/pdk"
)

type Input = struct {
	Src                         string `json:"src"`
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

func writeFile(path string, data []byte) error {
	input := make([]byte, 0, len(path)+1+len(data))
	input = append(input, path...)
	input = append(input, 0)
	input = append(input, data...)

	_, output, callErr := pdk.Call("fs", "write", input)
	if callErr != nil {
		return callErr
	}
	if len(output) > 0 && string(output) != "OK" {
		return fmt.Errorf("%s", string(output))
	}
	return nil
}

//export gen
func Gen() uint32 {
	input := pdk.Input()
	params := Input{}
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.Src == "" {
		pdk.Output(util.ErrorResponse("src is required"))
		return 1
	}

	theTree, err := treegen.GenerateTree(&MyRandom{}, params.GenerateTreeConfig)
	if err != nil {
		pdk.Output(util.ErrorResponse(err.Error()))
		return 1
	}

	treeJSON, err := json.Marshal(theTree)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tree: " + err.Error()))
		return 1
	}

	if err := writeFile(params.Src, treeJSON); err != nil {
		pdk.Output(util.ErrorResponse("failed to write tree: " + err.Error()))
		return 1
	}

	pdk.Output(util.SuccessResponse())
	return 0
}
