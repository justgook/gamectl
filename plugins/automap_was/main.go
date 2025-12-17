// Package main implements the automap WASM plugin for GameCtl.
//
// This plugin provides automapping functionality similar to Tiled's automapping feature.
// It takes input tilemaps and applies transformation rules to generate output tilemaps.
//
// The plugin demonstrates plugin-to-plugin communication by using the SQL
// plugin to store and retrieve tilemaps.
//
// Current implementation (v1):
//   - Creates three example tilemaps: rules, input, and output
//   - Stores them in SQL storage for later use
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
	"strings"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/util"
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

	// Load tilemaps from storage
	rulesMap, err := getTilemap(config.RulesMapID)
	if err != nil {
		pdk.Output(errorResponse("failed to load rules map: " + err.Error()))
		return 1
	}

	inputMap, err := getTilemap(config.InputMapID)
	if err != nil {
		pdk.Output(errorResponse("failed to load input map: " + err.Error()))
		return 1
	}

	// Try to load output map, or create a copy of input map if it doesn't exist
	outputMap, err := getTilemap(config.OutputMapID)
	if err != nil {
		// Output map doesn't exist - create a copy of input map with all tiles set to 0
		outputMap = tilemap.NewTileMap()
		outputMap.Props = make(map[string]string)
		for k, v := range inputMap.Props {
			outputMap.Props[k] = v
		}

		// Copy layers structure but zero out all tile data
		for _, inputLayer := range inputMap.Layers {
			outputLayer := tilemap.NewTileLayer(inputLayer.Width, inputLayer.Height())
			outputLayer.Props = make(map[string]string)
			for k, v := range inputLayer.Props {
				outputLayer.Props[k] = v
			}
			outputMap.Layers = append(outputMap.Layers, *outputLayer)
		}
	}

	// Apply automapping
	engine := &AutomapEngine{}
	if err := engine.Apply(rulesMap, inputMap, outputMap); err != nil {
		pdk.Output(errorResponse("automapping failed: " + err.Error()))
		return 1
	}

	// Store the output map back
	if err := storeTilemap(config.OutputMapID, outputMap); err != nil {
		pdk.Output(errorResponse("failed to store output map: " + err.Error()))
		return 1
	}

	// Return success with the map IDs
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
	// List all automap-related tilemaps by querying tilemap_storage table
	// Since we simplified to basic get/set, we just return the known automap map IDs
	mapIDs := []string{"rules-basic-walls", "input-test-map", "output-result-map"}

	resp := Response{
		Success: true,
		MapIDs:  mapIDs,
	}
	output, _ := json.Marshal(resp)
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
	rulesMap.Props["name"] = "Basic Wall Rules"
	rulesMap.Props["type"] = "automap"
	rulesMap.Props["category"] = "rules"
	rulesMap.Props["tileWidth"] = "32"
	rulesMap.Props["tileHeight"] = "32"
	rulesMap.Props["description"] = "Example rules for wall corner detection"

	// Layer 0: Input pattern layer (what to match)
	patternLayer := tilemap.NewTileLayer(8, 8)
	patternLayer.Props["name"] = "pattern-input"
	patternLayer.Props["description"] = "Pattern to match in the input"
	// Simple 3x3 pattern: corners
	// 1 = wall, 0 = empty
	patternLayer.Data[0*8+0] = 1 // top-left corner
	patternLayer.Data[0*8+1] = 1
	patternLayer.Data[1*8+0] = 1
	rulesMap.Layers = append(rulesMap.Layers, *patternLayer)

	// Layer 1: Output transformation layer (what to place)
	outputLayer := tilemap.NewTileLayer(8, 8)
	outputLayer.Props["name"] = "pattern-output"
	outputLayer.Props["description"] = "Tiles to place when pattern matches"
	// Place specific corner tile
	outputLayer.Data[0*8+0] = 10 // corner tile ID
	rulesMap.Layers = append(rulesMap.Layers, *outputLayer)

	return storeTilemap(mapID, rulesMap)
}

func createInputMap(mapID string) error {
	// Create an input tilemap with some basic wall layout
	inputMap := tilemap.NewTileMap()
	inputMap.Props["name"] = "Test Input Map"
	inputMap.Props["type"] = "automap"
	inputMap.Props["category"] = "input"
	inputMap.Props["tileWidth"] = "32"
	inputMap.Props["tileHeight"] = "32"
	inputMap.Props["description"] = "Example input map for automapping"

	// Create a 20x15 map with a simple room outline
	layer := tilemap.NewTileLayer(20, 15)
	layer.Props["name"] = "walls"
	layer.Props["collision"] = "true"

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
	outputMap.Props["name"] = "Automap Output"
	outputMap.Props["type"] = "automap"
	outputMap.Props["category"] = "output"
	outputMap.Props["tileWidth"] = "32"
	outputMap.Props["tileHeight"] = "32"
	outputMap.Props["description"] = "Result of automapping transformation"

	// Create empty layer matching input size
	layer := tilemap.NewTileLayer(20, 15)
	layer.Props["name"] = "generated"
	layer.Props["generated"] = "true"

	outputMap.Layers = append(outputMap.Layers, *layer)

	return storeTilemap(mapID, outputMap)
}

// =============================================================================
// Tilemap storage integration
// =============================================================================

func storeTilemap(mapID string, tm *tilemap.TileMap) error {
	// Store tilemap in SQL storage
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

	// Parse CSV response properly to handle quoted/escaped fields
	csv := string(csvOutput)
	lines := util.ParseCSVLines(csv)
	if len(lines) < 2 || len(lines[1]) < 1 {
		return nil, fmt.Errorf("tilemap not found: %s", mapID)
	}

	// Get data field (first column of second row)
	dataJSON := lines[1][0]

	// Parse JSON data
	var tm tilemap.TileMap
	if err := json.Unmarshal([]byte(dataJSON), &tm); err != nil {
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
