package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gams/pkg/util"
	"github.com/justgook/gams/plugins/treegen/treegen"
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

func execSQL(sqlQuery string) error {
	_, output, callErr := pdk.Call("sql", "exec", []byte(sqlQuery))
	if callErr != nil {
		return callErr
	}
	if len(output) > 0 && string(output) != "OK" {
		return fmt.Errorf(string(output))
	}
	return nil
}

//export __sql_init
func SqlInit() uint32 {
	err := execSQL(`CREATE TABLE IF NOT EXISTS tree_storage (
		name TEXT PRIMARY KEY,
		data TEXT NOT NULL
	)`)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to initialize treegen SQL state: " + err.Error()))
		return 1
	}

	pdk.Output(util.SuccessResponse())
	return 0
}

//export gen
func Gen() uint32 {
	input := pdk.Input()
	params := Input{}
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	theTree, err := treegen.GenerateTree(&MyRandom{}, params.GenerateTreeConfig)
	if err != nil {
		pdk.Output(util.ErrorResponse(err.Error()))
		return 1
	}

	// Prepare tree JSON for SQL storage
	treeJSON, err := json.Marshal(theTree)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tree: " + err.Error()))
		return 1
	}

	// Escape SQL string and insert
	escapedData := strings.ReplaceAll(string(treeJSON), "'", "''")
	sqlQuery := fmt.Sprintf("INSERT OR REPLACE INTO tree_storage (name, data) VALUES ('%s', '%s')",
		params.Name, escapedData)

	if err := execSQL(sqlQuery); err != nil {
		pdk.Output(util.ErrorResponse("failed to store tree: " + err.Error()))
		return 1
	}

	pdk.Output(util.SuccessResponse())
	return 0
}
