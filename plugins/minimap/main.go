package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gams/pkg/tree"
	"github.com/justgook/gams/pkg/util"
	"github.com/justgook/gams/plugins/minimap/minimap"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	Src   string `json:"src"`   // Required: tree JSON file path to read through fs
	MapId string `json:"mapId"` // Required: map ID to save in tilemap-storage
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
	if params.MapId == "" {
		pdk.Output(util.ErrorResponse("mapId is required"))
		return 1
	}

	treeData, err := readFile(params.Src)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to read tree: " + err.Error()))
		return 1
	}

	// Parse tree from JSON data
	var tree tree.Tree
	if err := json.Unmarshal(treeData, &tree); err != nil {
		pdk.Output(util.ErrorResponse("failed to parse tree: " + err.Error()))
		return 1
	}

	// Generate minimap using pure generation logic
	logToConsole(fmt.Sprintf("[Minimap] Starting generation for tree with %d nodes", len(tree)))

	tileMap, err := minimap.GenerateMinimap(&tree, getRoomShape)
	if err != nil {
		logToConsole(fmt.Sprintf("[Minimap] Generation failed: %v", err))
		pdk.Output(util.ErrorResponse("minimap generation failed: " + err.Error()))
		return 1
	}
	logToConsole("[Minimap] Generation completed successfully")

	// Store tilemap in SQL storage
	tilemapJSON, err := json.Marshal(tileMap)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tilemap: " + err.Error()))
		return 1
	}

	// Escape SQL string and insert
	escapedData := strings.ReplaceAll(string(tilemapJSON), "'", "''")
	sqlQuery := fmt.Sprintf("INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES ('%s', '%s')",
		params.MapId, escapedData)

	_, output, callErr := pdk.Call("sql", "exec", []byte(sqlQuery))
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

func getRoomShape(node *tree.Node) minimap.RoomShape {
	rng := &MyRandom{}
	idx := rng.Intn(len(roomShapesToChooseFrom))
	return roomShapesToChooseFrom[idx]
}

// Room shapes available for selection (same as original minimap)
var roomShapesToChooseFrom = []minimap.RoomShape{
	// Single tiles - most flexible for tight spaces
	{{0, 0}},
	// 2-tile shapes
	{{0, 0}, {0, -1}},
	{{0, 0}, {0, 1}},
	{{0, 0}, {1, 0}},
	{{0, 0}, {-1, 0}},
	// Small L-shapes
	{{0, 0}, {1, 0}, {0, 1}},
	{{0, 0}, {-1, 0}, {0, 1}},
	// Larger rooms
	{{0, 0}, {1, 0}, {0, 1}, {1, 1}},
	{{0, 0}, {1, 0}, {0, 1}, {1, 1}, {0, 2}, {1, 2}},
	{{0, 0}, {0, 1}, {1, 0}, {1, 1}, {2, 0}, {2, 1}},
	{{0, 0}, {1, 0}, {0, 1}, {0, 2}},
	{{0, 0}, {1, 0}, {1, 1}, {1, 2}},
	{{0, 0}, {0, 1}, {1, 1}, {2, 1}},
	{{0, 0}, {0, 1}, {-1, 1}, {-2, 1}},
	{{0, 0}, {1, 0}, {2, 0}, {1, 1}},
	{{0, 0}, {0, 1}, {0, 2}, {-1, 1}},
}
