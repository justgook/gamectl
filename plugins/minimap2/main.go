package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gams/pkg/tree"
	"github.com/justgook/gams/pkg/util"
	"github.com/justgook/gams/plugins/minimap2/placement"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	TreeId string `json:"treeId"` // Required: tree to read from tree-storage
	MapId  string `json:"mapId"`  // Required: map ID to save in tilemap-storage
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
	if params.MapId == "" {
		pdk.Output(util.ErrorResponse("mapId is required"))
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
	var t tree.Tree
	if err := json.Unmarshal([]byte(lines[1][0]), &t); err != nil {
		pdk.Output(util.ErrorResponse("failed to parse tree: " + err.Error()))
		return 1
	}

	// Generate minimap using the new placement algorithm
	logToConsole(fmt.Sprintf("[Minimap2] Starting generation for tree with %d nodes", len(t)))

	rng := &MyRandom{}
	gen := placement.NewGenerator(&t, getRoomShape, rng)

	p, err := gen.Generate()
	if err != nil {
		logToConsole(fmt.Sprintf("[Minimap2] Generation failed: %v", err))
		pdk.Output(util.ErrorResponse("minimap generation failed: " + err.Error()))
		return 1
	}

	// Convert to tilemap
	tileMap := p.ToTileMap()
	logToConsole("[Minimap2] Generation completed successfully")

	// Store tilemap in SQL storage
	tilemapJSON, err := json.Marshal(tileMap)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tilemap: " + err.Error()))
		return 1
	}

	// Escape SQL string and insert
	escapedData := strings.ReplaceAll(string(tilemapJSON), "'", "''")
	sqlQuery = fmt.Sprintf("INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES ('%s', '%s')",
		params.MapId, escapedData)

	var output []byte
	status, output, callErr = pdk.Call("sql", "exec", []byte(sqlQuery))
	if callErr != nil {
		pdk.Output(util.ErrorResponse("failed to store tilemap: " + callErr.Error()))
		return 1
	}

	// Check if SQL execution was successful
	if len(output) > 0 && string(output) != "OK" {
		pdk.Output(util.ErrorResponse("SQL execution failed: " + string(output)))
		return 1
	}

	// Return success
	pdk.Output(util.SuccessResponse())
	return 0
}

func getRoomShape(node *tree.Node) placement.RoomShape {
	rng := &MyRandom{}
	idx := rng.Intn(len(roomShapesToChooseFrom))
	return roomShapesToChooseFrom[idx]
}

// Room shapes available for selection
var roomShapesToChooseFrom = []placement.RoomShape{
	// Single tiles - most flexible for tight spaces
	{{X: 0, Y: 0}},
	// 2-tile shapes
	{{X: 0, Y: 0}, {X: 0, Y: -1}},
	{{X: 0, Y: 0}, {X: 0, Y: 1}},
	{{X: 0, Y: 0}, {X: 1, Y: 0}},
	{{X: 0, Y: 0}, {X: -1, Y: 0}},
	// Small L-shapes
	{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 0, Y: 1}},
	{{X: 0, Y: 0}, {X: -1, Y: 0}, {X: 0, Y: 1}},
	// Larger rooms
	{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 0, Y: 1}, {X: 1, Y: 1}},
	{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 0, Y: 1}, {X: 1, Y: 1}, {X: 0, Y: 2}, {X: 1, Y: 2}},
	{{X: 0, Y: 0}, {X: 0, Y: 1}, {X: 1, Y: 0}, {X: 1, Y: 1}, {X: 2, Y: 0}, {X: 2, Y: 1}},
	{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 0, Y: 1}, {X: 0, Y: 2}},
	{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 1, Y: 1}, {X: 1, Y: 2}},
	{{X: 0, Y: 0}, {X: 0, Y: 1}, {X: 1, Y: 1}, {X: 2, Y: 1}},
	{{X: 0, Y: 0}, {X: 0, Y: 1}, {X: -1, Y: 1}, {X: -2, Y: 1}},
	{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 2, Y: 0}, {X: 1, Y: 1}},
	{{X: 0, Y: 0}, {X: 0, Y: 1}, {X: 0, Y: 2}, {X: -1, Y: 1}},
}

func main() {}
