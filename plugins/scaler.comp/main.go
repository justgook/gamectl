//go:generate go tool wit-bindgen-go generate --world scaler-plugin --out internal ./gams:scaler@1.0.0.wasm

package main

import (
	"sort"

	scalerwit "github.com/kkgams/scaler/internal/gams/scaler/scaler"
	"github.com/kkgams/sdk/go/tilemap"
	"go.bytecodealliance.org/cm"
)

// DoorSize represents the dimensions of a door in tiles.
type DoorSize struct {
	Width  int
	Height int
}

// DoorSizesConfig holds door sizes for each cardinal direction.
type DoorSizesConfig struct {
	North DoorSize
	East  DoorSize
	South DoorSize
	West  DoorSize
}

func init() {
	scalerwit.Exports.Scale = func(src scalerwit.TileMap, config scalerwit.ScaleConfig) cm.Result[scalerwit.TileMapShape, scalerwit.TileMap, string] {
		if config.ScaleFactor == 0 {
			return cm.Err[cm.Result[scalerwit.TileMapShape, scalerwit.TileMap, string]]("scale-factor must be positive")
		}

		doorSizes := getDefaultDoorSizes()
		if configuredDoorSizes := config.DoorSizes.Some(); configuredDoorSizes != nil {
			doorSizes = fromWITDoorSizes(*configuredDoorSizes)
		}

		scaled := scaleTilemap(fromWITTileMap(src), int(config.ScaleFactor), doorSizes)
		return cm.OK[cm.Result[scalerwit.TileMapShape, scalerwit.TileMap, string]](toWITTileMap(scaled))
	}
}

func fromWITTileMap(input scalerwit.TileMap) *tilemap.TileMap {
	witLayers := input.Layers.Slice()
	layers := make([]tilemap.TileLayer, len(witLayers))
	for i, layer := range witLayers {
		layers[i] = tilemap.TileLayer{
			Width: int(layer.Width),
			Data:  append([]uint32(nil), layer.Data.Slice()...),
			Props: fromWITData(layer.Props),
		}
	}
	return &tilemap.TileMap{
		Layers: layers,
		Props:  fromWITData(input.Props),
	}
}

func toWITTileMap(tm *tilemap.TileMap) scalerwit.TileMap {
	layers := make([]scalerwit.TileLayer, len(tm.Layers))
	for i, layer := range tm.Layers {
		layers[i] = scalerwit.TileLayer{
			Width: uint32(layer.Width),
			Data:  cm.ToList(layer.Data),
			Props: toWITData(layer.Props),
		}
	}
	return scalerwit.TileMap{
		Layers: cm.ToList(layers),
		Props:  toWITData(tm.Props),
	}
}

func fromWITData(entries cm.List[scalerwit.DataEntry]) map[string]string {
	data := make(map[string]string, entries.Len())
	for _, entry := range entries.Slice() {
		data[entry[0]] = entry[1]
	}
	return data
}

func toWITData(data map[string]string) cm.List[scalerwit.DataEntry] {
	entries := make([]scalerwit.DataEntry, 0, len(data))
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		entries = append(entries, scalerwit.DataEntry{key, data[key]})
	}
	return cm.ToList(entries)
}

func fromWITDoorSizes(config scalerwit.DoorSizesConfig) DoorSizesConfig {
	return DoorSizesConfig{
		North: fromWITDoorSize(config.North),
		East:  fromWITDoorSize(config.East),
		South: fromWITDoorSize(config.South),
		West:  fromWITDoorSize(config.West),
	}
}

func fromWITDoorSize(size scalerwit.DoorSize) DoorSize {
	return DoorSize{Width: int(size.Width), Height: int(size.Height)}
}

// scaleTilemap scales a tilemap by the given factor.
// Each tile in the input becomes a scaleFactor x scaleFactor block of identical tiles in the output.
// Door layers are scaled using custom logic based on doorSizes configuration.
func scaleTilemap(
	tm *tilemap.TileMap,
	scaleFactor int,
	doorSizes DoorSizesConfig,
) *tilemap.TileMap {
	scaled := &tilemap.TileMap{
		Layers: make([]tilemap.TileLayer, len(tm.Layers)),
		Props:  make(map[string]string),
	}

	for k, v := range tm.Props {
		scaled.Props[k] = v
	}

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
	if layerType, ok := layer.Props["type"]; ok && layerType == "doors" {
		return scaleDoorLayer(layer, scaleFactor, doorSizes)
	}

	return scaleStandardLayer(layer, scaleFactor)
}

// scaleStandardLayer scales a standard tile layer by duplicating tiles in a block pattern.
func scaleStandardLayer(layer tilemap.TileLayer, scaleFactor int) tilemap.TileLayer {
	originalWidth := layer.Width
	originalHeight := layer.Height()

	newWidth := originalWidth * scaleFactor
	newHeight := originalHeight * scaleFactor
	newData := make([]uint32, newWidth*newHeight)

	for y := 0; y < originalHeight; y++ {
		for x := 0; x < originalWidth; x++ {
			srcIdx := y*originalWidth + x
			tileValue := layer.Data[srcIdx]

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

// Door direction bit masks (matching minimap2 encoding).
const (
	DoorNorth uint8 = 1
	DoorEast  uint8 = 2
	DoorSouth uint8 = 4
	DoorWest  uint8 = 8
)

// getDefaultDoorSizes returns the default door sizes for each direction.
func getDefaultDoorSizes() DoorSizesConfig {
	return DoorSizesConfig{
		North: DoorSize{Width: 2, Height: 1},
		East:  DoorSize{Width: 1, Height: 2},
		South: DoorSize{Width: 2, Height: 1},
		West:  DoorSize{Width: 1, Height: 2},
	}
}

// clampDoorSize ensures door size fits within the scaled tile.
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

	clampedSizes := DoorSizesConfig{
		North: clampDoorSize(doorSizes.North, scaleFactor),
		East:  clampDoorSize(doorSizes.East, scaleFactor),
		South: clampDoorSize(doorSizes.South, scaleFactor),
		West:  clampDoorSize(doorSizes.West, scaleFactor),
	}

	for y := 0; y < originalHeight; y++ {
		for x := 0; x < originalWidth; x++ {
			srcIdx := y*originalWidth + x
			doorMask := layer.Data[srcIdx]

			if doorMask == 0 {
				continue
			}

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

// placeDoorNorth places a north-facing door on the top edge, horizontally centered.
func placeDoorNorth(data []uint32, width int, origX, origY, scaleFactor int, size DoorSize) {
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

// placeDoorEast places an east-facing door on the right edge, vertically centered.
func placeDoorEast(data []uint32, width int, origX, origY, scaleFactor int, size DoorSize) {
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

// placeDoorSouth places a south-facing door on the bottom edge, horizontally centered.
func placeDoorSouth(data []uint32, width int, origX, origY, scaleFactor int, size DoorSize) {
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

// placeDoorWest places a west-facing door on the left edge, vertically centered.
func placeDoorWest(data []uint32, width int, origX, origY, scaleFactor int, size DoorSize) {
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

// main is required for the `wasi` target, even if it isn't used.
func main() {}
