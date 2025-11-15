// Package main implements the minimap WASM plugin for GameCtl.
//
// This plugin generates 2D spatial layouts from tree structures for Metroidvania-style
// minimap generation. It follows the treegen pattern with clean separation between
// plugin wrapper logic (main.go) and pure generation logic (gen.go).
//
// Features:
//   - Reads tree.Tree from tree-storage by ID
//   - Generates 2D spatial layout with room placement and door connections
//   - Stores resulting tilemap in tilemap-storage
//   - Clean architecture with dependency injection for testability
//
// Input:
//   - treeId: ID to read tree from tree-storage
//   - mapId: ID to save generated minimap into tilemap-storage
//   - config: Optional generation configuration
//
// Output:
//   - Success/error response
//   - Minimap stored in tilemap-storage under specified mapId
package main

import (
	"encoding/json"

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

	// Get tree from tree-storage
	getTreeReq := struct {
		ID string `json:"id"`
	}{ID: params.TreeId}

	getTreeJSON, err := json.Marshal(getTreeReq)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tree request: " + err.Error()))
		return 1
	}

	status, treeOutput, callErr := pdk.Call("tree-storage", "get", getTreeJSON)
	if callErr != nil {
		pdk.Output(util.ErrorResponse("failed to call tree-storage: " + callErr.Error()))
		return 1
	}
	if status != 0 {
		pdk.Output(util.ErrorResponse("tree-storage returned error status"))
		return 1
	}

	// Parse tree from storage
	var tree tree.Tree
	if err := json.Unmarshal(treeOutput, &tree); err != nil {
		pdk.Output(util.ErrorResponse("failed to parse tree: " + err.Error()))
		return 1
	}

	// Generate minimap using pure generation logic
	rng := &MyRandom{}
	tileMap, err := minimap.GenerateMinimap(rng, tree, getRoomShape)
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
