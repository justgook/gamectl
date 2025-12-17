package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/wpm/pdk"
)

type AutomapConfig struct {
	RulesMapID  string `json:"rulesMapId"`  // ID of the rules tilemap
	InputMapID  string `json:"inputMapId"`  // ID of the input tilemap
	OutputMapID string `json:"outputMapId"` // ID of the output tilemap
}

type Response struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

//go:wasmexport automap
func Automap() int32 {
	input := pdk.Input()
	var config AutomapConfig
	if err := json.Unmarshal(input, &config); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))

		return 1
	}

	if config.RulesMapID == "" {
		pdk.Output(errorResponse("missing rules map id"))

		return 1
	}

	if config.InputMapID == "" {
		pdk.Output(errorResponse("missing input map id"))

		return 1
	}

	if config.OutputMapID == "" {
		pdk.Output(errorResponse("missing output map id"))

		return 1
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
	// outputMap, err := getTilemap(config.OutputMapID)
	// if err != nil {
	// 	panic("Output map should be based not on input but on result of output of rules, or even better generated inside AutomapApply, and reutrned here to merge if tilemap exists!")
	// 	// Output map doesn't exist - create a copy of input map with all tiles set to 0
	// 	outputMap = tilemap.NewTileMap()
	// 	outputMap.Props = make(map[string]string)
	// 	for k, v := range inputMap.Props {
	// 		outputMap.Props[k] = v
	// 	}
	//
	// 	// Copy layers structure but zero out all tile data
	// 	for _, inputLayer := range inputMap.Layers {
	// 		outputLayer := tilemap.NewTileLayer(inputLayer.Width, inputLayer.Height())
	// 		outputLayer.Props = make(map[string]string)
	// 		for k, v := range inputLayer.Props {
	// 			outputLayer.Props[k] = v
	// 		}
	// 		outputMap.Layers = append(outputMap.Layers, *outputLayer)
	// 	}
	// }

	// Apply automapping
	outputMap, err := AutomapApply(rulesMap, inputMap)
	if err != nil {
		pdk.Output(errorResponse("automapping failed: " + err.Error()))
		return 1
	}

	// TODO: merge output map with existing (if it exists)
	// Store the output map back
	if err := storeTilemap(config.OutputMapID, outputMap); err != nil {
		pdk.Output(errorResponse("failed to store output map: " + err.Error()))
		return 1
	}

	// Return success with the map IDs
	output, _ := json.Marshal(Response{Success: true})
	pdk.Output(output)

	return 0
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
