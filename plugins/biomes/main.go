package main

import (
	"encoding/json"
	"fmt"

	"github.com/justgook/gams/pkg/tree"
	"github.com/justgook/gams/pkg/util"
	"github.com/justgook/gams/plugins/biomes/biomes"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	Src         string `json:"src"`         // Required: tree JSON file path to read/write through fs
	BiomesQuery string `json:"biomesQuery"` // SQL query to get biomes (e.g., "SELECT name FROM biomes ORDER BY RANDOM() LIMIT 25")
}

// MyRandom implements Random interface using WASM imports
type MyRandom struct{}

//go:wasmimport random intn
func rndIntn(n uint32) uint32

func (rng *MyRandom) Intn(n int) int {
	if n <= 0 {
		return 0
	}
	return int(rndIntn(uint32(n)))
}

func logToConsole(msg string) {
	pdk.Call("host", "log", []byte(msg))
}

func readFile(path string) ([]byte, error) {
	status, output, callErr := pdk.Call("fs", "read", []byte(path))
	if callErr != nil {
		return nil, callErr
	}
	if status != 0 {
		return nil, fmt.Errorf("%s", string(output))
	}
	return output, nil
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

	// Validate required parameters
	if params.Src == "" {
		pdk.Output(util.ErrorResponse("src is required"))
		return 1
	}
	if params.BiomesQuery == "" {
		pdk.Output(util.ErrorResponse("biomesQuery is required"))
		return 1
	}

	treeData, err := readFile(params.Src)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to read tree: " + err.Error()))
		return 1
	}

	// Parse tree from JSON data
	var theTree tree.Tree
	if err := json.Unmarshal(treeData, &theTree); err != nil {
		pdk.Output(util.ErrorResponse("failed to parse tree: " + err.Error()))
		return 1
	}

	logToConsole(fmt.Sprintf("[Biomes] Loaded tree with %d nodes", len(theTree)))

	// Query biomes from SQL
	status, biomesOutput, callErr := pdk.Call("sql", "query", []byte(params.BiomesQuery))
	if callErr != nil {
		pdk.Output(util.ErrorResponse("failed to query biomes: " + callErr.Error()))
		return 1
	}
	if status != 0 {
		pdk.Output(util.ErrorResponse("biomes SQL query failed"))
		return 1
	}

	// Parse biomes from CSV response
	biomesCSV := string(biomesOutput)
	biomesLines := util.ParseCSVLines(biomesCSV)
	if len(biomesLines) < 2 {
		pdk.Output(util.ErrorResponse("no biomes found from query"))
		return 1
	}

	// Extract biome names (first column of each row, skip header)
	biomeNames := make([]string, 0, len(biomesLines)-1)
	for i := 1; i < len(biomesLines); i++ {
		if len(biomesLines[i]) > 0 && biomesLines[i][0] != "" {
			biomeNames = append(biomeNames, biomesLines[i][0])
		}
	}

	if len(biomeNames) == 0 {
		pdk.Output(util.ErrorResponse("no biomes extracted from query result"))
		return 1
	}

	logToConsole(fmt.Sprintf("[Biomes] Loaded %d biomes", len(biomeNames)))

	// Assign biomes
	rng := &MyRandom{}
	if err := biomes.AssignBiomes(&theTree, biomeNames, rng); err != nil {
		pdk.Output(util.ErrorResponse("failed to assign biomes: " + err.Error()))
		return 1
	}

	// Count results for logging
	assigned := 0
	for _, node := range theTree {
		if biomes.GetNodeBiome(node) != "" {
			assigned++
		}
	}

	logToConsole(fmt.Sprintf("[Biomes] Assigned %d biomes to nodes", assigned))

	treeJSON, err := json.Marshal(theTree)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tree: " + err.Error()))
		return 1
	}

	if err := writeFile(params.Src, treeJSON); err != nil {
		pdk.Output(util.ErrorResponse("failed to write tree: " + err.Error()))
		return 1
	}

	logToConsole("[Biomes] Tree updated successfully")

	// Return success
	pdk.Output(util.SuccessResponse())
	return 0
}
