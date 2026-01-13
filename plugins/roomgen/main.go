package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/gamectl/plugins/roomgen/gen"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	InputMapID  string `json:"inputMapId"`  // Required: source tilemap ID (from scaler)
	OutputMapID string `json:"outputMapId"` // Required: destination tilemap ID

	// Player abilities (optional - defaults apply)
	JumpHeight   int `json:"jumpHeight,omitempty"`   // Max tiles player can jump up
	JumpDistance int `json:"jumpDistance,omitempty"` // Max horizontal jump distance

	// Special abilities (all optional, default false)
	CanUseLadders    bool `json:"canUseLadders,omitempty"`
	CanDropThrough   bool `json:"canDropThrough,omitempty"`
	CanWallJump      bool `json:"canWallJump,omitempty"`
	CanGrapple       bool `json:"canGrapple,omitempty"`
	CanDoubleJump    bool `json:"canDoubleJump,omitempty"`
	DoubleJumpHeight int  `json:"doubleJumpHeight,omitempty"`
	WallJumpHeight   int  `json:"wallJumpHeight,omitempty"`
	WallJumpDistance int  `json:"wallJumpDistance,omitempty"`
	GrappleRange     int  `json:"grappleRange,omitempty"`

	// Variety level (0=none, 1=low, 2=medium, 3=high)
	VarietyLevel int `json:"varietyLevel,omitempty"`

	// Tile IDs for output (optional - defaults apply)
	TileIDPlatform       uint32 `json:"tileIdPlatform,omitempty"`
	TileIDOnewayPlatform uint32 `json:"tileIdOnewayPlatform,omitempty"`
	TileIDLadder         uint32 `json:"tileIdLadder,omitempty"`
	TileIDWallJumpLeft   uint32 `json:"tileIdWallJumpLeft,omitempty"`
	TileIDWallJumpRight  uint32 `json:"tileIdWallJumpRight,omitempty"`
	TileIDGrapplePoint   uint32 `json:"tileIdGrapplePoint,omitempty"`
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

//go:wasmexport gen
func Gen() int32 {
	input := pdk.Input()
	var params Input
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	// Validate required parameters
	if params.InputMapID == "" {
		pdk.Output(util.ErrorResponse("inputMapId is required"))
		return 1
	}
	if params.OutputMapID == "" {
		pdk.Output(util.ErrorResponse("outputMapId is required"))
		return 1
	}

	// Load input tilemap
	inputMap, err := getTilemap(params.InputMapID)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load input map: " + err.Error()))
		return 1
	}

	// Build abilities from params
	abilities := buildAbilities(params)

	// Build variety config
	variety := gen.GetVarietyConfig(gen.VarietyLevel(params.VarietyLevel))

	// Build tile ID config
	tileIDs := buildTileIDs(params)

	// Create random number generator
	rng := &MyRandom{}

	logToConsole(fmt.Sprintf("[RoomGen] Starting generation with abilities: jump=%d/%d, ladders=%v, walls=%v",
		abilities.JumpHeight, abilities.JumpDistance, abilities.CanUseLadders, abilities.CanWallJump))

	// Generate traversal geometry
	geometryLayer, err := gen.RenderAllRoomsToTilemap(inputMap, abilities, variety, tileIDs, rng)
	if err != nil {
		pdk.Output(util.ErrorResponse("generation failed: " + err.Error()))
		return 1
	}

	// Create output tilemap with geometry layer added
	outputMap := &tilemap.TileMap{
		Layers: make([]tilemap.TileLayer, 0, len(inputMap.Layers)+1),
		Props:  make(map[string]string),
	}

	// Copy original layers
	for _, layer := range inputMap.Layers {
		outputMap.Layers = append(outputMap.Layers, layer)
	}

	// Add geometry layer
	outputMap.Layers = append(outputMap.Layers, *geometryLayer)

	// Copy properties
	for k, v := range inputMap.Props {
		outputMap.Props[k] = v
	}

	// Store output tilemap
	if err := storeTilemap(params.OutputMapID, outputMap); err != nil {
		pdk.Output(util.ErrorResponse("failed to store output map: " + err.Error()))
		return 1
	}

	logToConsole("[RoomGen] Generation completed successfully")
	pdk.Output(util.SuccessResponse())
	return 0
}

// buildAbilities constructs PlayerAbilities from input params
func buildAbilities(params Input) gen.PlayerAbilities {
	abilities := gen.DefaultAbilities()

	// Override defaults if specified
	if params.JumpHeight > 0 {
		abilities.JumpHeight = params.JumpHeight
	}
	if params.JumpDistance > 0 {
		abilities.JumpDistance = params.JumpDistance
	}
	if params.DoubleJumpHeight > 0 {
		abilities.DoubleJumpHeight = params.DoubleJumpHeight
	}
	if params.WallJumpHeight > 0 {
		abilities.WallJumpHeight = params.WallJumpHeight
	}
	if params.WallJumpDistance > 0 {
		abilities.WallJumpDistance = params.WallJumpDistance
	}
	if params.GrappleRange > 0 {
		abilities.GrappleRange = params.GrappleRange
	}

	// Boolean abilities - only set if explicitly true in input
	// (JSON unmarshals missing bools as false, so we need explicit check)
	abilities.CanUseLadders = params.CanUseLadders
	abilities.CanDropThrough = params.CanDropThrough
	abilities.CanWallJump = params.CanWallJump
	abilities.CanGrapple = params.CanGrapple
	abilities.CanDoubleJump = params.CanDoubleJump

	return abilities
}

// buildTileIDs constructs TileIDConfig from input params
func buildTileIDs(params Input) gen.TileIDConfig {
	tileIDs := gen.DefaultTileIDs()

	if params.TileIDPlatform > 0 {
		tileIDs.Platform = params.TileIDPlatform
	}
	if params.TileIDOnewayPlatform > 0 {
		tileIDs.OnewayPlatform = params.TileIDOnewayPlatform
	}
	if params.TileIDLadder > 0 {
		tileIDs.Ladder = params.TileIDLadder
	}
	if params.TileIDWallJumpLeft > 0 {
		tileIDs.WallJumpLeft = params.TileIDWallJumpLeft
	}
	if params.TileIDWallJumpRight > 0 {
		tileIDs.WallJumpRight = params.TileIDWallJumpRight
	}
	if params.TileIDGrapplePoint > 0 {
		tileIDs.GrapplePoint = params.TileIDGrapplePoint
	}

	return tileIDs
}

// =============================================================================
// Tilemap storage integration
// =============================================================================

func getTilemap(mapID string) (*tilemap.TileMap, error) {
	escapedMapID := strings.ReplaceAll(mapID, "'", "''")
	sqlQuery := fmt.Sprintf("SELECT data FROM tilemap_storage WHERE name = '%s'", escapedMapID)
	status, csvOutput, err := pdk.Call("sql", "query", []byte(sqlQuery))
	if err != nil {
		return nil, fmt.Errorf("failed to query tilemap: %w", err)
	}

	if status != 0 {
		return nil, fmt.Errorf("SQL query failed")
	}

	csv := string(csvOutput)
	lines := util.ParseCSVLines(csv)
	if len(lines) < 2 || len(lines[1]) < 1 {
		return nil, fmt.Errorf("tilemap not found: %s", mapID)
	}

	jsonData := lines[1][0]

	var tm tilemap.TileMap
	if err := json.Unmarshal([]byte(jsonData), &tm); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tilemap: %w", err)
	}

	return &tm, nil
}

func storeTilemap(mapID string, tm *tilemap.TileMap) error {
	tilemapJSON, err := json.Marshal(tm)
	if err != nil {
		return fmt.Errorf("failed to marshal tilemap: %w", err)
	}

	jsonStr := string(tilemapJSON)
	escapedMapID := strings.ReplaceAll(mapID, "'", "''")
	escapedData := strings.ReplaceAll(jsonStr, "'", "''")

	sqlQuery := fmt.Sprintf("INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES ('%s', '%s')",
		escapedMapID, escapedData)

	status, output, err := pdk.Call("sql", "exec", []byte(sqlQuery))
	if err != nil {
		return fmt.Errorf("failed to store tilemap: %w", err)
	}

	if status != 0 || (len(output) > 0 && string(output) != "OK") {
		return fmt.Errorf("SQL execution failed: %s", string(output))
	}

	return nil
}

// Required main function for WASM
func main() {}
