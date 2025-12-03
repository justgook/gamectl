package main

import (
	"encoding/json"
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/gamectl/plugins/minimap/minimap"
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
	var tree tree.Tree
	if err := json.Unmarshal([]byte(lines[1][0]), &tree); err != nil {
		pdk.Output(util.ErrorResponse("failed to parse tree: " + err.Error()))
		return 1
	}

	// Generate minimap using pure generation logic
	rng := &MyRandom{}
	tileMap, err := minimap.GenerateMinimap(rng, &tree, getRoomShape)
	if err != nil {
		pdk.Output(util.ErrorResponse("minimap generation failed: " + err.Error()))
		return 1
	}

	// Store tilemap in tilemap-storage
	storeReq := struct {
		ID  string           `json:"id"`
		Map *tilemap.TileMap `json:"map"`
	}{
		ID:  params.MapId,
		Map: tileMap,
	}

	storeJSON, err := json.Marshal(storeReq)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tilemap: " + err.Error()))
		return 1
	}

	status, _, callErr = pdk.Call("tilemap-storage", "set", storeJSON)
	if callErr != nil {
		pdk.Output(util.ErrorResponse("failed to call tilemap-storage: " + callErr.Error()))
		return 1
	}
	if status != 0 {
		pdk.Output(util.ErrorResponse("tilemap-storage returned error status"))
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
