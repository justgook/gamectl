package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/gamectl/plugins/biomes/biomes"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	TreeId      string `json:"treeId"`      // Required: tree to read/write from tree_storage
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

//export gen
func Gen() uint32 {
	input := pdk.Input()
	params := Input{}
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	// Validate required parameters
	if params.TreeId == "" {
		pdk.Output(util.ErrorResponse("treeId is required"))
		return 1
	}
	if params.BiomesQuery == "" {
		pdk.Output(util.ErrorResponse("biomesQuery is required"))
		return 1
	}

	// Query tree from SQL storage
	sqlQuery := fmt.Sprintf("SELECT data FROM tree_storage WHERE name = '%s'", params.TreeId)
	status, csvOutput, callErr := pdk.Call("sql", "query", []byte(sqlQuery))
	if callErr != nil {
		pdk.Output(util.ErrorResponse("failed to query tree: " + callErr.Error()))
		return 1
	}
	if status != 0 {
		pdk.Output(util.ErrorResponse("SQL query failed"))
		return 1
	}

	// Parse CSV response to get JSON data
	csv := string(csvOutput)
	lines := util.ParseCSVLines(csv)
	if len(lines) < 2 || len(lines[1]) < 1 {
		pdk.Output(util.ErrorResponse("tree not found: " + params.TreeId))
		return 1
	}

	// Parse tree from JSON data
	var theTree tree.Tree
	if err := json.Unmarshal([]byte(lines[1][0]), &theTree); err != nil {
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

	// Store tree back in SQL storage
	treeJSON, err := json.Marshal(theTree)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tree: " + err.Error()))
		return 1
	}

	// Escape SQL string and insert
	escapedData := strings.ReplaceAll(string(treeJSON), "'", "''")
	sqlQuery = fmt.Sprintf("INSERT OR REPLACE INTO tree_storage (name, data) VALUES ('%s', '%s')",
		params.TreeId, escapedData)

	var output []byte
	status, output, callErr = pdk.Call("sql", "exec", []byte(sqlQuery))
	if callErr != nil {
		pdk.Output(util.ErrorResponse("failed to store tree: " + callErr.Error()))
		return 1
	}

	// Check if SQL execution was successful
	if len(output) > 0 && string(output) != "OK" {
		pdk.Output(util.ErrorResponse("SQL execution failed: " + string(output)))
		return 1
	}

	logToConsole("[Biomes] Tree updated successfully")

	// Return success
	pdk.Output(util.SuccessResponse())
	return 0
}
