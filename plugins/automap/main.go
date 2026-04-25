package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/justgook/gams/pkg/tilemap"
	"github.com/justgook/gams/pkg/util"
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

//export automap
func Automap() int32 {
	input := pdk.Input()
	var config AutomapConfig
	if err := json.Unmarshal(input, &config); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))

		return 1
	}

	rulesMapID := cloneString(config.RulesMapID)
	inputMapID := cloneString(config.InputMapID)
	outputMapID := cloneString(config.OutputMapID)

	if rulesMapID == "" {
		pdk.Output(errorResponse("missing rules map id"))

		return 1
	}

	if inputMapID == "" {
		pdk.Output(errorResponse("missing input map id"))

		return 1
	}

	if outputMapID == "" {
		pdk.Output(errorResponse("missing output map id"))

		return 1
	}

	// Load tilemaps from storage
	rulesMap, err := getTilemap(rulesMapID)
	if err != nil {
		pdk.Output(errorResponse("failed to load rules map: " + err.Error()))
		return 1
	}

	inputMap, err := getTilemap(inputMapID)
	if err != nil {
		pdk.Output(errorResponse("failed to load input map: " + err.Error()))
		return 1
	}
	if len(inputMap.Layers) == 0 {
		pdk.Output(errorResponse("input map have no layers"))
		return 1
	}

	// Resolve automap target mode:
	// - same input/output ID: update in place
	// - different output ID: create a fresh target map from the current input.
	// Pipeline runs must be deterministic and repeatable; reusing a previous
	// generated output as the next target makes repeated browser2 graph runs feed
	// stale generated state back into automap.
	targetMap := inputMap
	if inputMapID != outputMapID {
		targetMap = tilemap.NewTileMap()
		targetMap.Props = cloneStringMap(inputMap.Props)
	}

	// Apply automapping
	outputMap, err := AutomapApplyToTarget(rulesMap, inputMap, targetMap)
	if err != nil {
		pdk.Output(errorResponse("automapping failed: " + err.Error()))
		return 1
	}

	// Store the output map back
	if err := storeTilemap(outputMapID, outputMap); err != nil {
		pdk.Output(errorResponse("failed to store output map: " + err.Error()))
		return 1
	}

	// Return success with the map IDs. Keep this hand-encoded instead of using
	// encoding/json here: TinyGo's JSON encoder can panic on repeated browser2
	// runs after this stateful automap path updates an existing output map.
	pdk.Output([]byte(`{"success":true}`))

	return 0
}

// =============================================================================
// Tilemap storage integration
// =============================================================================

func execSQL(sqlQuery string) error {
	status, output, err := pdk.Call("sql", "exec", []byte(sqlQuery))
	if err != nil {
		return err
	}
	if status != 0 || (len(output) > 0 && string(output) != "OK") {
		return fmt.Errorf("%s", string(output))
	}
	return nil
}

//export __sql_init
func SqlInit() uint32 {
	err := execSQL(`CREATE TABLE IF NOT EXISTS tilemap_storage (
		name TEXT PRIMARY KEY,
		data TEXT NOT NULL
	)`)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to initialize automap SQL state: " + err.Error()))
		return 1
	}

	pdk.Output(util.SuccessResponse())
	return 0
}

func storeTilemap(mapID string, tm *tilemap.TileMap) error {
	// Store tilemap in SQL storage
	tilemapJSON, err := encodeTileMapJSON(tm)
	if err != nil {
		return fmt.Errorf("failed to marshal tilemap: %w", err)
	}

	// Escape SQL string and insert
	escapedMapID := strings.ReplaceAll(mapID, "'", "''")
	escapedData := strings.ReplaceAll(tilemapJSON, "'", "''")
	sqlQuery := fmt.Sprintf(
		"INSERT OR REPLACE INTO tilemap_storage (name, data) VALUES ('%s', '%s')",
		escapedMapID,
		escapedData,
	)

	if err := execSQL(sqlQuery); err != nil {
		return fmt.Errorf("failed to store tilemap: %w", err)
	}

	return nil
}

func encodeJSONString(value string) string {
	return strconv.Quote(value)
}

func encodeStringMapJSON(m map[string]string) string {
	if len(m) == 0 {
		return "{}"
	}
	parts := make([]string, 0, len(m))
	for k, v := range m {
		parts = append(parts, encodeJSONString(k)+":"+encodeJSONString(v))
	}
	return "{" + strings.Join(parts, ",") + "}"
}

func encodeUint32SliceJSON(values []uint32) string {
	if len(values) == 0 {
		return "[]"
	}
	parts := make([]string, len(values))
	for i, v := range values {
		parts[i] = strconv.FormatUint(uint64(v), 10)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func encodeTileMapJSON(tm *tilemap.TileMap) (string, error) {
	if tm == nil {
		return "", fmt.Errorf("tilemap is nil")
	}
	layerParts := make([]string, len(tm.Layers))
	for i, layer := range tm.Layers {
		layerParts[i] = "{" +
			"\"width\":" + strconv.Itoa(layer.Width) + "," +
			"\"data\":" + encodeUint32SliceJSON(layer.Data)
		if len(layer.Props) > 0 {
			layerParts[i] += ",\"props\":" + encodeStringMapJSON(layer.Props)
		}
		layerParts[i] += "}"
	}
	result := "{" +
		"\"layers\":[" + strings.Join(layerParts, ",") + "]"
	if len(tm.Props) > 0 {
		result += ",\"props\":" + encodeStringMapJSON(tm.Props)
	}
	result += "}"
	return result, nil
}

func getTilemap(mapID string) (*tilemap.TileMap, error) {
	// Query tilemap from SQL storage
	escapedMapID := strings.ReplaceAll(mapID, "'", "''")
	sqlQuery := fmt.Sprintf("SELECT data FROM tilemap_storage WHERE name = '%s'", escapedMapID)
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
	return []byte(`{"success":false,"error":` + strconv.Quote(msg) + `}`)
}

func cloneString(value string) string {
	return string(append([]byte(nil), value...))
}

func isTilemapNotFound(err error) bool {
	return err != nil && strings.Contains(err.Error(), "tilemap not found:")
}

// Required main function for WASM
func main() {}
