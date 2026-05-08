package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/justgook/gams/pkg/tilemap"
	"github.com/justgook/wpm/pdk"
)

type AutomapConfig struct {
	RulesMap  string `json:"rulesMap"`  // Path to the rules tilemap JSON file
	InputMap  string `json:"inputMap"`  // Path to the input tilemap JSON file
	OutputMap string `json:"outputMap"` // Path to the output tilemap JSON file
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

	rulesMapFile := configPath(config.RulesMap)
	inputMapFile := configPath(config.InputMap)
	outputMapFile := configPath(config.OutputMap)

	if rulesMapFile == "" {
		pdk.Output(errorResponse("missing rules map path"))

		return 1
	}

	if inputMapFile == "" {
		pdk.Output(errorResponse("missing input map path"))

		return 1
	}

	if outputMapFile == "" {
		pdk.Output(errorResponse("missing output map path"))

		return 1
	}

	// Load tilemaps from filesystem storage.
	rulesMap, err := getTilemap(rulesMapFile)
	if err != nil {
		pdk.Output(errorResponse("failed to load rules map: " + err.Error()))
		return 1
	}

	inputMap, err := getTilemap(inputMapFile)
	if err != nil {
		pdk.Output(errorResponse("failed to load input map: " + err.Error()))
		return 1
	}
	if len(inputMap.Layers) == 0 {
		pdk.Output(errorResponse("input map have no layers"))
		return 1
	}

	// Resolve automap target mode:
	// - same input/output path: update in place
	// - different output path: create a fresh target map from the current input.
	// Pipeline runs must be deterministic and repeatable; reusing a previous
	// generated output as the next target makes repeated browser graph runs feed
	// stale generated state back into automap.
	targetMap := inputMap
	if inputMapFile != outputMapFile {
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
	if err := storeTilemap(outputMapFile, outputMap); err != nil {
		pdk.Output(errorResponse("failed to store output map: " + err.Error()))
		return 1
	}

	// Return success with the output path. Keep this hand-encoded instead of using
	// encoding/json here: TinyGo's JSON encoder can panic on repeated browser
	// runs after this stateful automap path updates an existing output map.
	pdk.Output([]byte(`{"success":true,"outputMap":` + strconv.Quote(outputMapFile) + `}`))

	return 0
}

// =============================================================================
// Tilemap storage integration
// =============================================================================

func fsRead(path string) ([]byte, error) {
	status, data, err := pdk.Call("fs", "read", []byte(path))
	if err != nil {
		return nil, fmt.Errorf("fs read error: %w", err)
	}
	if status != 0 {
		return nil, fmt.Errorf("fs read failed: %s", string(data))
	}
	return data, nil
}

func fsWrite(path string, data []byte) error {
	input := make([]byte, len(path)+1+len(data))
	copy(input, path)
	input[len(path)] = 0
	copy(input[len(path)+1:], data)

	status, output, err := pdk.Call("fs", "write", input)
	if err != nil {
		return fmt.Errorf("fs write error: %w", err)
	}
	if status != 0 {
		return fmt.Errorf("fs write failed: %s", string(output))
	}
	return nil
}

func storeTilemap(path string, tm *tilemap.TileMap) error {
	tilemapJSON, err := encodeTileMapJSON(tm)
	if err != nil {
		return fmt.Errorf("failed to marshal tilemap: %w", err)
	}

	if err := fsWrite(path, []byte(tilemapJSON+"\n")); err != nil {
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

func getTilemap(path string) (*tilemap.TileMap, error) {
	dataJSON, err := fsRead(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read tilemap %s: %w", path, err)
	}

	var tm tilemap.TileMap
	if err := json.Unmarshal(dataJSON, &tm); err != nil {
		return nil, fmt.Errorf("failed to unmarshal tilemap %s: %w", path, err)
	}

	return &tm, nil
}

// =============================================================================
// Helper functions
// =============================================================================

func errorResponse(msg string) []byte {
	return []byte(`{"success":false,"error":` + strconv.Quote(msg) + `}`)
}

func configPath(value string) string {
	path := strings.TrimSpace(value)
	return string(append([]byte(nil), path...))
}

// Required main function for WASM
func main() {}
