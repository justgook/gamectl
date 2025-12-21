package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/wpm/pdk"
)

// Input represents the plugin input structure
type Input struct {
	InputMapID  string `json:"inputMapId"`  // Required: source tilemap ID to scale
	OutputMapID string `json:"outputMapId"` // Required: destination tilemap ID
	ScaleFactor int    `json:"scaleFactor"` // Required: integer multiplier (2, 3, 4, etc.)
}

//go:wasmexport scale
func Scale() int32 {
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
	if params.ScaleFactor <= 0 {
		pdk.Output(util.ErrorResponse("scaleFactor must be positive"))
		return 1
	}

	// Load input tilemap from storage
	inputMap, err := getTilemap(params.InputMapID)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load input map: " + err.Error()))
		return 1
	}

	// Scale the tilemap
	outputMap := scaleTilemap(inputMap, params.ScaleFactor)

	// Store the output map
	if err := storeTilemap(params.OutputMapID, outputMap); err != nil {
		pdk.Output(util.ErrorResponse("failed to store output map: " + err.Error()))
		return 1
	}

	// Return success
	pdk.Output(util.SuccessResponse())
	return 0
}

// scaleTilemap scales a tilemap by the given factor.
// Each tile in the input becomes a scaleFactor x scaleFactor block of identical tiles in the output.
func scaleTilemap(tm *tilemap.TileMap, scaleFactor int) *tilemap.TileMap {
	if scaleFactor <= 0 {
		return tm
	}

	scaled := &tilemap.TileMap{
		Layers: make([]tilemap.TileLayer, len(tm.Layers)),
		Props:  make(map[string]string),
	}

	// Copy map-level properties (no need to update dimension references)
	for k, v := range tm.Props {
		scaled.Props[k] = v
	}

	// Scale each layer
	for i, layer := range tm.Layers {
		scaled.Layers[i] = scaleLayer(layer, scaleFactor)
	}

	return scaled
}

// scaleLayer scales a single layer by the given factor.
func scaleLayer(layer tilemap.TileLayer, scaleFactor int) tilemap.TileLayer {
	originalWidth := layer.Width
	originalHeight := layer.Height()

	newWidth := originalWidth * scaleFactor
	newHeight := originalHeight * scaleFactor
	newData := make([]uint32, newWidth*newHeight)

	// For each tile in the original layer
	for y := 0; y < originalHeight; y++ {
		for x := 0; x < originalWidth; x++ {
			// Get the original tile value
			srcIdx := y*originalWidth + x
			tileValue := layer.Data[srcIdx]

			// Fill a scaleFactor x scaleFactor block with this value
			for dy := 0; dy < scaleFactor; dy++ {
				for dx := 0; dx < scaleFactor; dx++ {
					newX := x*scaleFactor + dx
					newY := y*scaleFactor + dy
					dstIdx := newY*newWidth + newX
					newData[dstIdx] = tileValue
				}
			}
		}
	}

	// Copy layer properties
	newProps := make(map[string]string)
	for k, v := range layer.Props {
		newProps[k] = v
	}

	return tilemap.TileLayer{
		Width: newWidth,
		Data:  newData,
		Props: newProps,
	}
}

// =============================================================================
// Tilemap storage integration
// =============================================================================

func getTilemap(mapID string) (*tilemap.TileMap, error) {
	// Query tilemap from SQL storage
	sqlQuery := fmt.Sprintf("SELECT data FROM tilemap_storage WHERE name = '%s'", mapID)
	status, csvOutput, err := pdk.Call("sql", "query", []byte(sqlQuery))
	if err != nil {
		return nil, fmt.Errorf("failed to query tilemap: %w", err)
	}

	if status != 0 {
		return nil, fmt.Errorf("SQL query failed")
	}

	// Parse CSV response to get JSON data
	csv := string(csvOutput)
	lines := util.ParseCSVLines(csv)
	if len(lines) < 2 || len(lines[1]) < 1 {
		return nil, fmt.Errorf("tilemap not found: %s", mapID)
	}

	// Parse tilemap from JSON data
	var tm tilemap.TileMap
	if err := json.Unmarshal([]byte(lines[1][0]), &tm); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tilemap: %w", err)
	}

	return &tm, nil
}

func storeTilemap(mapID string, tm *tilemap.TileMap) error {
	// Marshal tilemap to JSON
	tilemapJSON, err := json.Marshal(tm)
	if err != nil {
		return fmt.Errorf("failed to marshal tilemap: %w", err)
	}

	// Escape SQL string and insert
	escapedData := strings.ReplaceAll(string(tilemapJSON), "'", "''")
	sqlQuery := fmt.Sprintf("INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES ('%s', '%s')",
		mapID, escapedData)

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
