package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gams/pkg/tree"
	"github.com/justgook/gams/pkg/util"
	"github.com/justgook/gams/plugins/keylock/keylock"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	TreeId         string  `json:"treeId"`         // Required: tree to read/write from tree_storage
	KeysQuery      string  `json:"keysQuery"`      // SQL query to get keys (e.g., "SELECT name FROM keys LIMIT 15")
	KeyChance      float64 `json:"keyChance"`      // Base probability to place key (0.0-1.0, default 0.5)
	LockChance     float64 `json:"lockChance"`     // Probability to lock (0.0-1.0, default 0.7)
	MaxKeysPerLock int     `json:"maxKeysPerLock"` // Max keys per lock requirement (default 2)
}

// MyRandom implements Random interface using WASM imports
type MyRandom struct{}

//go:wasmimport random float64
func rndF64() float64

//go:wasmimport random intn
func rndIntn(n uint32) uint32

func (rng *MyRandom) Float64() float64 {
	return rndF64()
}

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
	if params.KeysQuery == "" {
		pdk.Output(util.ErrorResponse("keysQuery is required"))
		return 1
	}

	// Apply defaults
	cfg := keylock.DefaultConfig()
	if params.KeyChance > 0 {
		cfg.KeyChance = params.KeyChance
	}
	if params.LockChance > 0 {
		cfg.LockChance = params.LockChance
	}
	if params.MaxKeysPerLock > 0 {
		cfg.MaxKeysPerLock = params.MaxKeysPerLock
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

	logToConsole(fmt.Sprintf("[Keylock] Loaded tree with %d nodes", len(theTree)))

	// Query keys from SQL
	status, keysOutput, callErr := pdk.Call("sql", "query", []byte(params.KeysQuery))
	if callErr != nil {
		pdk.Output(util.ErrorResponse("failed to query keys: " + callErr.Error()))
		return 1
	}
	if status != 0 {
		pdk.Output(util.ErrorResponse("keys SQL query failed"))
		return 1
	}

	// Parse keys from CSV response
	keysCSV := string(keysOutput)
	keysLines := util.ParseCSVLines(keysCSV)
	if len(keysLines) < 2 {
		pdk.Output(util.ErrorResponse("no keys found from query"))
		return 1
	}

	// Extract key names (first column of each row, skip header)
	keys := make([]string, 0, len(keysLines)-1)
	for i := 1; i < len(keysLines); i++ {
		if len(keysLines[i]) > 0 && keysLines[i][0] != "" {
			keys = append(keys, keysLines[i][0])
		}
	}

	if len(keys) == 0 {
		pdk.Output(util.ErrorResponse("no keys extracted from query result"))
		return 1
	}

	logToConsole(fmt.Sprintf("[Keylock] Loaded %d keys", len(keys)))

	// Assign keys and locks
	rng := &MyRandom{}
	if err := keylock.AssignKeysAndLocks(&theTree, keys, cfg, rng); err != nil {
		pdk.Output(util.ErrorResponse("failed to assign keys and locks: " + err.Error()))
		return 1
	}

	// Count results for logging
	keysPlaced := 0
	locksPlaced := 0
	for _, node := range theTree {
		if nodeKeys := keylock.GetNodeKeys(node); len(nodeKeys) > 0 {
			keysPlaced += len(nodeKeys)
		}
		if nodeLocks := keylock.GetNodeLocks(node); len(nodeLocks) > 0 {
			locksPlaced++
		}
	}

	logToConsole(fmt.Sprintf("[Keylock] Placed %d keys, %d locks", keysPlaced, locksPlaced))

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

	logToConsole("[Keylock] Tree updated successfully")

	// Return success
	pdk.Output(util.SuccessResponse())
	return 0
}
