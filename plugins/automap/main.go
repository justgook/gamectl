// Package main implements the automap WASM plugin for GameCtl.
//
// This plugin provides automapping functionality similar to Tiled's automapping feature.
// It takes input tilemaps and applies transformation rules to generate output tilemaps.
//
// The plugin demonstrates plugin-to-plugin communication by using the tilemap-storage
// plugin to store and retrieve tilemaps.
//
// Current implementation (v1):
//   - Creates three example tilemaps: rules, input, and output
//   - Stores them in tilemap-storage for later use
//   - Provides foundation for future automapping logic
//
// Future implementation will include:
//   - Pattern matching against rules
//   - Tile transformation based on neighbor analysis
//   - Multiple rule sets and layers
//   - Probability-based tile placement
package main

import (
	"encoding/json"
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/wpm/pdk"
)

// AutomapConfig represents the configuration for automapping operations
type AutomapConfig struct {
	RulesMapID  string `json:"rulesMapId"`  // ID of the rules tilemap
	InputMapID  string `json:"inputMapId"`  // ID of the input tilemap
	OutputMapID string `json:"outputMapId"` // ID of the output tilemap
}

// Response types
type Response struct {
	Success     bool     `json:"success"`
	Error       string   `json:"error,omitempty"`
	RulesMapID  string   `json:"rulesMapId,omitempty"`
	InputMapID  string   `json:"inputMapId,omitempty"`
	OutputMapID string   `json:"outputMapId,omitempty"`
	MapIDs      []string `json:"mapIds,omitempty"`
}

//go:wasmexport automap
func Automap() int32 {
	input := pdk.Input()
	var config AutomapConfig
	if err := json.Unmarshal(input, &config); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	// For now, just create the three example tilemaps
	// Future: implement actual automapping logic here

	// Generate default IDs if not provided
	if config.RulesMapID == "" {
		config.RulesMapID = "rules-basic-walls"
	}
	if config.InputMapID == "" {
		config.InputMapID = "input-test-map"
	}
	if config.OutputMapID == "" {
		config.OutputMapID = "output-result-map"
	}

	// Create and store the three tilemaps
	if err := createRulesMap(config.RulesMapID); err != nil {
		pdk.Output(errorResponse("failed to create rules map: " + err.Error()))
		return 1
	}

	if err := createInputMap(config.InputMapID); err != nil {
		pdk.Output(errorResponse("failed to create input map: " + err.Error()))
		return 1
	}

	if err := createOutputMap(config.OutputMapID); err != nil {
		pdk.Output(errorResponse("failed to create output map: " + err.Error()))
		return 1
	}

	// Return success with the created map IDs
	resp := Response{
		Success:     true,
		RulesMapID:  config.RulesMapID,
		InputMapID:  config.InputMapID,
		OutputMapID: config.OutputMapID,
	}
	output, _ := json.Marshal(resp)
	pdk.Output(output)
	return 0
}

//go:wasmexport init
func Init() int32 {
	// Initialize automap plugin - create default tilemaps
	rulesID := "rules-basic-walls"
	inputID := "input-test-map"
	outputID := "output-result-map"

	if err := createRulesMap(rulesID); err != nil {
		pdk.Output(errorResponse("failed to create default rules map: " + err.Error()))
		return 1
	}

	if err := createInputMap(inputID); err != nil {
		pdk.Output(errorResponse("failed to create default input map: " + err.Error()))
		return 1
	}

	if err := createOutputMap(outputID); err != nil {
		pdk.Output(errorResponse("failed to create default output map: " + err.Error()))
		return 1
	}

	resp := Response{
		Success:     true,
		RulesMapID:  rulesID,
		InputMapID:  inputID,
		OutputMapID: outputID,
		MapIDs:      []string{rulesID, inputID, outputID},
	}
	output, _ := json.Marshal(resp)
	pdk.Output(output)
	return 0
}

//go:wasmexport listMaps
func ListMaps() int32 {
	// Query tilemap-storage for all maps with automap metadata
	queryInput := map[string]string{
		"query": "type=automap",
	}
	queryJSON, _ := json.Marshal(queryInput)

	status, output, err := pdk.Call("tilemap-storage", "select", queryJSON)
	if err != nil {
		pdk.Output(errorResponse("failed to query tilemap-storage: " + err.Error()))
		return 1
	}

	if status != 0 {
		pdk.Output(errorResponse(fmt.Sprintf("tilemap-storage returned error status: %d", status)))
		return 1
	}

	pdk.Output(output)
	return 0
}

// =============================================================================
// Helper functions for creating example tilemaps
// =============================================================================

func createRulesMap(mapID string) error {
	// Create a rules tilemap with example pattern matching rules
	// In future: this will contain patterns and their transformations
	rulesMap := tilemap.NewTileMap()
	rulesMap.Meta["name"] = "Basic Wall Rules"
	rulesMap.Meta["type"] = "automap"
	rulesMap.Meta["category"] = "rules"
	rulesMap.Meta["tileWidth"] = "32"
	rulesMap.Meta["tileHeight"] = "32"
	rulesMap.Meta["description"] = "Example rules for wall corner detection"

	// Layer 0: Input pattern layer (what to match)
	patternLayer := tilemap.NewTileLayer(8, 8)
	patternLayer.Meta["name"] = "pattern-input"
	patternLayer.Meta["description"] = "Pattern to match in the input"
	// Simple 3x3 pattern: corners
	// 1 = wall, 0 = empty
	patternLayer.Data[0*8+0] = 1 // top-left corner
	patternLayer.Data[0*8+1] = 1
	patternLayer.Data[1*8+0] = 1
	rulesMap.Layers = append(rulesMap.Layers, *patternLayer)

	// Layer 1: Output transformation layer (what to place)
	outputLayer := tilemap.NewTileLayer(8, 8)
	outputLayer.Meta["name"] = "pattern-output"
	outputLayer.Meta["description"] = "Tiles to place when pattern matches"
	// Place specific corner tile
	outputLayer.Data[0*8+0] = 10 // corner tile ID
	rulesMap.Layers = append(rulesMap.Layers, *outputLayer)

	return storeTilemap(mapID, rulesMap)
}

func createInputMap(mapID string) error {
	// Create an input tilemap with some basic wall layout
	inputMap := tilemap.NewTileMap()
	inputMap.Meta["name"] = "Test Input Map"
	inputMap.Meta["type"] = "automap"
	inputMap.Meta["category"] = "input"
	inputMap.Meta["tileWidth"] = "32"
	inputMap.Meta["tileHeight"] = "32"
	inputMap.Meta["description"] = "Example input map for automapping"

	// Create a 20x15 map with a simple room outline
	layer := tilemap.NewTileLayer(20, 15)
	layer.Meta["name"] = "walls"
	layer.Meta["collision"] = "true"

	// Draw a room border (simple rectangle)
	for x := 0; x < 20; x++ {
		layer.Data[0*20+x] = 1  // top wall
		layer.Data[14*20+x] = 1 // bottom wall
	}
	for y := 0; y < 15; y++ {
		layer.Data[y*20+0] = 1  // left wall
		layer.Data[y*20+19] = 1 // right wall
	}

	inputMap.Layers = append(inputMap.Layers, *layer)

	return storeTilemap(mapID, inputMap)
}

func createOutputMap(mapID string) error {
	// Create an output tilemap (initially empty, will be filled by automapping)
	outputMap := tilemap.NewTileMap()
	outputMap.Meta["name"] = "Automap Output"
	outputMap.Meta["type"] = "automap"
	outputMap.Meta["category"] = "output"
	outputMap.Meta["tileWidth"] = "32"
	outputMap.Meta["tileHeight"] = "32"
	outputMap.Meta["description"] = "Result of automapping transformation"

	// Create empty layer matching input size
	layer := tilemap.NewTileLayer(20, 15)
	layer.Meta["name"] = "generated"
	layer.Meta["generated"] = "true"

	outputMap.Layers = append(outputMap.Layers, *layer)

	return storeTilemap(mapID, outputMap)
}

// =============================================================================
// Tilemap storage integration
// =============================================================================

func storeTilemap(mapID string, tm *tilemap.TileMap) error {
	// Call tilemap-storage plugin to store the map
	setInput := map[string]interface{}{
		"id":  mapID,
		"map": tm,
	}
	inputJSON, err := json.Marshal(setInput)
	if err != nil {
		return fmt.Errorf("failed to marshal tilemap: %w", err)
	}

	status, output, err := pdk.Call("tilemap-storage", "set", inputJSON)
	if err != nil {
		return fmt.Errorf("failed to call tilemap-storage: %w", err)
	}

	if status != 0 {
		return fmt.Errorf("tilemap-storage returned error: %s", string(output))
	}

	return nil
}

func getTilemap(mapID string) (*tilemap.TileMap, error) {
	// Call tilemap-storage plugin to retrieve a map
	getInput := map[string]string{
		"id": mapID,
	}
	inputJSON, err := json.Marshal(getInput)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	status, output, err := pdk.Call("tilemap-storage", "get", inputJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to call tilemap-storage: %w", err)
	}

	if status != 0 {
		return nil, fmt.Errorf("tilemap-storage returned error: %s", string(output))
	}

	var tm tilemap.TileMap
	if err := json.Unmarshal(output, &tm); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tilemap: %w", err)
	}

	return &tm, nil
}

// =============================================================================
// Helper functions
// =============================================================================

func errorResponse(msg string) []byte {
	resp := Response{Success: false, Error: msg}
	data, _ := json.Marshal(resp)
	return data
}

// Required main function for WASM
func main() {}
