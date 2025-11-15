// Package main implements the minimap2 WASM plugin for GameCtl.
//
// This plugin generates 2D spatial layouts from tree3 structures for Metroidvania-style
// minimap generation. It follows the treegen pattern with clean separation between
// plugin wrapper logic (main.go) and pure generation logic (gen.go).
//
// Features:
//   - Reads tree3.Tree from tree-storage2 by ID
//   - Generates 2D spatial layout with room placement and door connections
//   - Stores resulting tilemap in tilemap-storage
//   - Clean architecture with dependency injection for testability
//
// Input:
//   - treeId: ID to read tree from tree-storage2
//   - mapId: ID to save generated minimap into tilemap-storage
//   - config: Optional generation configuration
//
// Output:
//   - Success/error response
//   - Minimap stored in tilemap-storage under specified mapId
package main

import (
	"encoding/json"

	"github.com/justgook/gamectl/pkg/minimap"
	"github.com/justgook/gamectl/pkg/tree3"
	"github.com/justgook/gamectl/plugins/minimap2/minimap2"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	TreeId string                         `json:"treeId"`           // Required: tree to read from tree-storage2
	MapId  string                         `json:"mapId"`            // Required: map ID to save in tilemap-storage
	Config minimap2.GenerateMinimapConfig `json:"config,omitempty"` // Optional: generation configuration
}

// SuccessResponse represents the plugin output
type SuccessResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
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
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	// Validate required parameters
	if params.TreeId == "" {
		pdk.Output(errorResponse("treeId is required"))
		return 1
	}
	if params.MapId == "" {
		pdk.Output(errorResponse("mapId is required"))
		return 1
	}

	// Get tree from tree-storage2
	getTreeReq := struct {
		ID string `json:"id"`
	}{ID: params.TreeId}

	getTreeJSON, err := json.Marshal(getTreeReq)
	if err != nil {
		pdk.Output(errorResponse("failed to marshal tree request: " + err.Error()))
		return 1
	}

	status, treeOutput, callErr := pdk.Call("tree-storage2", "get", getTreeJSON)
	if callErr != nil {
		pdk.Output(errorResponse("failed to call tree-storage2: " + callErr.Error()))
		return 1
	}
	if status != 0 {
		pdk.Output(errorResponse("tree-storage2 returned error status"))
		return 1
	}

	// Parse tree from storage
	var tree tree3.Tree
	if err := json.Unmarshal(treeOutput, &tree); err != nil {
		pdk.Output(errorResponse("failed to parse tree: " + err.Error()))
		return 1
	}

	// Generate minimap using pure generation logic
	rng := &MyRandom{}
	tileMap, err := minimap2.GenerateMinimap(tree, params.Config, rng, getRoomShape)
	if err != nil {
		pdk.Output(errorResponse("minimap generation failed: " + err.Error()))
		return 1
	}

	// Store tilemap in tilemap-storage
	storeReq := struct {
		ID  string           `json:"id"`
		Map *minimap.TileMap `json:"map"`
	}{
		ID:  params.MapId,
		Map: tileMap,
	}

	storeJSON, err := json.Marshal(storeReq)
	if err != nil {
		pdk.Output(errorResponse("failed to marshal tilemap: " + err.Error()))
		return 1
	}

	status, _, callErr = pdk.Call("tilemap-storage", "set", storeJSON)
	if callErr != nil {
		pdk.Output(errorResponse("failed to call tilemap-storage: " + callErr.Error()))
		return 1
	}
	if status != 0 {
		pdk.Output(errorResponse("tilemap-storage returned error status"))
		return 1
	}

	// Return success
	pdk.Output(successResponse())
	return 0
}

// getRoomShape selects a room shape for a given tree3 node
// This is plugin-level logic that will eventually be extracted to a dedicated plugin
func getRoomShape(node *tree3.Node) minimap.RoomShape {
	// Use same room shape selection logic as original minimap
	// Pick random shape variant using WASM random import
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

// Helper functions for response formatting
func successResponse() []byte {
	resp := SuccessResponse{Success: true}
	data, _ := json.Marshal(resp)
	return data
}

func errorResponse(msg string) []byte {
	resp := SuccessResponse{Success: false, Error: msg}
	data, _ := json.Marshal(resp)
	return data
}

// Required main function for WASM
func main() {}
