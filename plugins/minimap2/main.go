package main

import (
	"encoding/json"
	"fmt"

	"github.com/justgook/gams/pkg/tree"
	"github.com/justgook/gams/pkg/util"
	"github.com/justgook/gams/plugins/minimap2/placement"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	Tree string `json:"tree"` // Required: tree JSON file path to read through fs
	Map  string `json:"map"`  // Required: tilemap JSON file path to write through fs
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

func logToConsole(msg string) {
	// browser does not expose the legacy generic `host.log` module to WASM
	// plugins. Keep generation logging as a no-op until a routed logger service
	// exists, instead of making minimap2 depend on a host callback.
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
	if params.Tree == "" {
		pdk.Output(util.ErrorResponse("tree is required"))
		return 1
	}
	if params.Map == "" {
		pdk.Output(util.ErrorResponse("map is required"))
		return 1
	}

	treeData, err := readFile(params.Tree)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to read tree: " + err.Error()))
		return 1
	}

	// Parse tree from JSON data
	var t tree.Tree
	if err := json.Unmarshal(treeData, &t); err != nil {
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

	tilemapJSON, err := json.Marshal(tileMap)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tilemap: " + err.Error()))
		return 1
	}

	if err := writeFile(params.Map, tilemapJSON); err != nil {
		pdk.Output(util.ErrorResponse("failed to write tilemap: " + err.Error()))
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
