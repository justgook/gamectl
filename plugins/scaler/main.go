package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/justgook/gams/sdk/go/tilemap"
	"github.com/justgook/gams/sdk/go/util"
	"github.com/justgook/wpm/pdk"
)

// DoorSize represents the dimensions of a door in tiles
type DoorSize struct {
	Width  int `json:"width"`  // Width in tiles
	Height int `json:"height"` // Height in tiles
}

// DoorSizesConfig holds door sizes for each cardinal direction
type DoorSizesConfig struct {
	North DoorSize `json:"north"` // North-facing doors (top edge)
	East  DoorSize `json:"east"`  // East-facing doors (right edge)
	South DoorSize `json:"south"` // South-facing doors (bottom edge)
	West  DoorSize `json:"west"`  // West-facing doors (left edge)
}

// Input represents the plugin input structure
type Input struct {
	InputMap    string          `json:"inputMap"`            // Required: source tilemap JSON file path to scale
	OutputMap   string          `json:"outputMap"`           // Required: destination tilemap JSON file path
	ScaleFactor int             `json:"scaleFactor"`         // Required: integer multiplier (2, 3, 4, etc.)
	DoorSizes   json.RawMessage `json:"doorSizes,omitempty"` // Optional raw JSON to avoid TinyGo pointer decode issues
}

//export scale
func Scale() int32 {
	input := pdk.Input()
	if len(input) == 0 {
		pdk.Output(util.ErrorResponse("input is required"))
		return 1
	}

	var params Input
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	// Validate required parameters
	if params.InputMap == "" {
		pdk.Output(util.ErrorResponse("inputMap is required"))
		return 1
	}
	if params.OutputMap == "" {
		pdk.Output(util.ErrorResponse("outputMap is required"))
		return 1
	}
	if params.ScaleFactor <= 0 {
		pdk.Output(util.ErrorResponse("scaleFactor must be positive"))
		return 1
	}

	// Set default door sizes if not provided
	doorSizes := getDefaultDoorSizes()
	if len(params.DoorSizes) > 0 && string(params.DoorSizes) != "null" {
		var decoded DoorSizesConfig
		if err := json.Unmarshal(params.DoorSizes, &decoded); err != nil {
			pdk.Output(util.ErrorResponse("invalid doorSizes: " + err.Error()))
			return 1
		}
		doorSizes = decoded
	}

	// Load input tilemap from filesystem
	inputMap, err := getTilemap(params.InputMap)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load input map: " + err.Error()))
		return 1
	}

	// Scale the tilemap
	outputMap := scaleTilemap(inputMap, params.ScaleFactor, doorSizes)

	// Store the output map
	if err := storeTilemap(params.OutputMap, outputMap); err != nil {
		pdk.Output(util.ErrorResponse("failed to store output map: " + err.Error()))
		return 1
	}

	// Return success
	pdk.Output(util.SuccessResponse())
	return 0
}

// scaleTilemap scales a tilemap by the given factor.
// Each tile in the input becomes a scaleFactor x scaleFactor block of identical tiles in the output.
// Door layers are scaled using custom logic based on doorSizes configuration.
func scaleTilemap(
	tm *tilemap.TileMap,
	scaleFactor int,
	doorSizes DoorSizesConfig,
) *tilemap.TileMap {
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

	// Scale each layer (use specialized scalers based on layer type)
	for i, layer := range tm.Layers {
		scaled.Layers[i] = scaleLayer(layer, scaleFactor, doorSizes)
	}

	return scaled
}

// scaleLayer scales a single layer by the given factor.
// Dispatches to specialized scalers based on layer type.
func scaleLayer(
	layer tilemap.TileLayer,
	scaleFactor int,
	doorSizes DoorSizesConfig,
) tilemap.TileLayer {
	// Check if this is a door layer - use specialized scaling
	if layerType, ok := layer.Props["type"]; ok && layerType == "doors" {
		return scaleDoorLayer(layer, scaleFactor, doorSizes)
	}

	// Default: standard tile scaling (for base layers, etc.)
	return scaleStandardLayer(layer, scaleFactor)
}

// scaleStandardLayer scales a standard tile layer by duplicating tiles in a block pattern.
func scaleStandardLayer(layer tilemap.TileLayer, scaleFactor int) tilemap.TileLayer {
	originalWidth := layer.Width
	originalHeight := layer.Height()

	newWidth := originalWidth * scaleFactor
	newHeight := originalHeight * scaleFactor
	newData := make([]uint32, newWidth*newHeight)

	logToConsole(fmt.Sprintf("[Scaler] generating new layer %dx%d", newWidth, newHeight))

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
// Tilemap filesystem integration
// =============================================================================

func readFile(path string) ([]byte, error) {
	status, output, err := pdk.Call("fs", "read", []byte(path))
	if err != nil {
		return nil, err
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

	_, output, err := pdk.Call("fs", "write", input)
	if err != nil {
		return err
	}
	if len(output) > 0 && string(output) != "OK" {
		return fmt.Errorf("%s", string(output))
	}
	return nil
}

func getTilemap(path string) (*tilemap.TileMap, error) {
	jsonData, err := readFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read tilemap: %w", err)
	}

	var tm tilemap.TileMap
	if err := json.Unmarshal(jsonData, &tm); err != nil {
		return nil, fmt.Errorf(
			"failed to unmarshal tilemap (data length: %d): %w",
			len(jsonData),
			err,
		)
	}

	return &tm, nil
}

func storeTilemap(path string, tm *tilemap.TileMap) error {
	jsonStr, err := encodeTileMapJSON(tm)
	if err != nil {
		return fmt.Errorf("failed to marshal tilemap: %w", err)
	}

	if err := writeFile(path, []byte(jsonStr)); err != nil {
		return fmt.Errorf("failed to write tilemap (size: %d bytes): %w", len(jsonStr), err)
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

func logToConsole(msg string) {
	// browser does not expose the legacy generic `host.log` module to WASM
	// plugins. Keep scaling logging as a no-op until a routed logger service
	// exists, instead of making scaler depend on a host callback.
}

// =============================================================================
// Door scaling logic
// =============================================================================

// Door direction bit masks (matching minimap2 encoding)
const (
	DoorNorth uint8 = 1
	DoorEast  uint8 = 2
	DoorSouth uint8 = 4
	DoorWest  uint8 = 8
)

// getDefaultDoorSizes returns the default door sizes for each direction
func getDefaultDoorSizes() DoorSizesConfig {
	return DoorSizesConfig{
		North: DoorSize{Width: 2, Height: 1}, // Vertical door on top edge
		East:  DoorSize{Width: 1, Height: 2}, // Horizontal door on right edge
		South: DoorSize{Width: 2, Height: 1}, // Vertical door on bottom edge
		West:  DoorSize{Width: 1, Height: 2}, // Horizontal door on left edge
	}
}

// clampDoorSize ensures door size fits within the scaled tile
func clampDoorSize(size DoorSize, scaleFactor int) DoorSize {
	clamped := size
	if clamped.Width > scaleFactor {
		clamped.Width = scaleFactor
	}
	if clamped.Width < 1 {
		clamped.Width = 1
	}
	if clamped.Height > scaleFactor {
		clamped.Height = scaleFactor
	}
	if clamped.Height < 1 {
		clamped.Height = 1
	}
	return clamped
}

// scaleDoorLayer scales the door layer with custom door placement logic.
// Each original door tile is examined for its direction bitmask, and doors
// are placed on the edges of the scaled tile area with proper centering.
func scaleDoorLayer(
	layer tilemap.TileLayer,
	scaleFactor int,
	doorSizes DoorSizesConfig,
) tilemap.TileLayer {
	originalWidth := layer.Width
	originalHeight := layer.Height()

	newWidth := originalWidth * scaleFactor
	newHeight := originalHeight * scaleFactor
	newData := make([]uint32, newWidth*newHeight)

	logToConsole(
		fmt.Sprintf(
			"[Scaler] scaling door layer %dx%d with custom door placement",
			newWidth,
			newHeight,
		),
	)

	// Clamp door sizes to ensure they fit within scaled tiles
	clampedSizes := DoorSizesConfig{
		North: clampDoorSize(doorSizes.North, scaleFactor),
		East:  clampDoorSize(doorSizes.East, scaleFactor),
		South: clampDoorSize(doorSizes.South, scaleFactor),
		West:  clampDoorSize(doorSizes.West, scaleFactor),
	}

	// Process each tile in the original door layer
	for y := 0; y < originalHeight; y++ {
		for x := 0; x < originalWidth; x++ {
			srcIdx := y*originalWidth + x
			doorMask := layer.Data[srcIdx]

			if doorMask == 0 {
				continue // No doors on this tile
			}

			// For each direction bit set in the mask, place doors
			if doorMask&uint32(DoorNorth) != 0 {
				placeDoorNorth(newData, newWidth, x, y, scaleFactor, clampedSizes.North)
			}
			if doorMask&uint32(DoorEast) != 0 {
				placeDoorEast(newData, newWidth, x, y, scaleFactor, clampedSizes.East)
			}
			if doorMask&uint32(DoorSouth) != 0 {
				placeDoorSouth(newData, newWidth, x, y, scaleFactor, clampedSizes.South)
			}
			if doorMask&uint32(DoorWest) != 0 {
				placeDoorWest(newData, newWidth, x, y, scaleFactor, clampedSizes.West)
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

// placeDoorNorth places a north-facing door on the top edge, horizontally centered
func placeDoorNorth(data []uint32, width int, origX, origY, scaleFactor int, size DoorSize) {
	// Top edge (y = 0 of scaled tile), horizontally centered
	startX := origX*scaleFactor + (scaleFactor-size.Width)/2
	startY := origY * scaleFactor

	for dy := 0; dy < size.Height; dy++ {
		for dx := 0; dx < size.Width; dx++ {
			x := startX + dx
			y := startY + dy
			idx := y*width + x
			data[idx] |= uint32(DoorNorth)
		}
	}
}

// placeDoorEast places an east-facing door on the right edge, vertically centered
func placeDoorEast(data []uint32, width int, origX, origY, scaleFactor int, size DoorSize) {
	// Right edge (x = scaleFactor - width of scaled tile), vertically centered
	startX := origX*scaleFactor + (scaleFactor - size.Width)
	startY := origY*scaleFactor + (scaleFactor-size.Height)/2

	for dy := 0; dy < size.Height; dy++ {
		for dx := 0; dx < size.Width; dx++ {
			x := startX + dx
			y := startY + dy
			idx := y*width + x
			data[idx] |= uint32(DoorEast)
		}
	}
}

// placeDoorSouth places a south-facing door on the bottom edge, horizontally centered
func placeDoorSouth(data []uint32, width int, origX, origY, scaleFactor int, size DoorSize) {
	// Bottom edge (y = scaleFactor - height of scaled tile), horizontally centered
	startX := origX*scaleFactor + (scaleFactor-size.Width)/2
	startY := origY*scaleFactor + (scaleFactor - size.Height)

	for dy := 0; dy < size.Height; dy++ {
		for dx := 0; dx < size.Width; dx++ {
			x := startX + dx
			y := startY + dy
			idx := y*width + x
			data[idx] |= uint32(DoorSouth)
		}
	}
}

// placeDoorWest places a west-facing door on the left edge, vertically centered
func placeDoorWest(data []uint32, width int, origX, origY, scaleFactor int, size DoorSize) {
	// Left edge (x = 0 of scaled tile), vertically centered
	startX := origX * scaleFactor
	startY := origY*scaleFactor + (scaleFactor-size.Height)/2

	for dy := 0; dy < size.Height; dy++ {
		for dx := 0; dx < size.Width; dx++ {
			x := startX + dx
			y := startY + dy
			idx := y*width + x
			data[idx] |= uint32(DoorWest)
		}
	}
}

// Required main function for WASM
func main() {}
