package main

import (
	"fmt"

	"github.com/justgook/gams/pkg/tilemap"
)

// EdgeMatchContext stores information needed to extend and later restore map edges
// when using MatchOutsideMap, OverflowBorder, or WrapBorder features.
type EdgeMatchContext struct {
	OriginalWidth  int
	OriginalHeight int
	PadX           int
	PadY           int
	WasExtended    bool
}

// PrepareMapForEdgeMatching extends the input map to allow rules to match outside original boundaries.
// This implements MatchOutsideMap, OverflowBorder, and WrapBorder behaviors.
// Reads configuration directly from inputMap.Props to determine edge-matching strategy.
// Returns the extended working map and a context object needed for later restoration.
// If MatchOutsideMap is false or rules are empty, returns the original map unchanged.
func PrepareMapForEdgeMatching(
	rulesMap *tilemap.TileMap,
	inputMap *tilemap.TileMap,
	rules []*Rule,
) (*tilemap.TileMap, *EdgeMatchContext) {
	// Read edge-matching configuration from input map properties
	matchOutsideMap := parseBool(rulesMap.Props["rule_MatchOutsideMap"], false)
	overflowBorder := parseBool(rulesMap.Props["rule_OverflowBorder"], false)
	wrapBorder := parseBool(rulesMap.Props["rule_WrapBorder"], false)

	// If MatchOutsideMap is not enabled, return original map
	if !matchOutsideMap {
		return inputMap, &EdgeMatchContext{WasExtended: false}
	}

	// Calculate maximum rule bounds
	maxRuleWidth, maxRuleHeight := CalculateMaxRuleBounds(rules)

	// If no rules or rules have no size, return original map
	if maxRuleWidth == 0 || maxRuleHeight == 0 {
		return inputMap, &EdgeMatchContext{WasExtended: false}
	}

	// Determine fill strategy
	var fillStrategy string
	if wrapBorder {
		fillStrategy = "WrapBorder"
	} else if overflowBorder {
		fillStrategy = "OverflowBorder"
	} else {
		fillStrategy = "Empty"
	}

	logToConsole(fmt.Sprintf("[Automap] MatchOutsideMap enabled - max rule bounds: %dx%d, fill strategy: %s",
		maxRuleWidth, maxRuleHeight, fillStrategy))

	// Store original dimensions
	originalWidth := inputMap.Layers[0].Width
	originalHeight := inputMap.Layers[0].Height()

	// Calculate padding (rule size - 1)
	padX := maxRuleWidth - 1
	padY := maxRuleHeight - 1

	logToConsole(fmt.Sprintf("[Automap] Extending map from %dx%d to %dx%d (padding: %d, %d)",
		originalWidth, originalHeight,
		originalWidth+padX*2, originalHeight+padY*2,
		padX, padY))

	// Extend all input layers with empty tiles (0) initially
	extendedLayers := tilemap.ExtendLayers(inputMap.Layers, padX, padY, padX, padY)

	// Apply fill strategy based on config (WrapBorder takes precedence over OverflowBorder)
	if wrapBorder {
		fillWrapBorder(extendedLayers, padX, padY, originalWidth, originalHeight)
	} else if overflowBorder {
		fillOverflowBorder(extendedLayers, padX, padY, originalWidth, originalHeight)
	}
	// else: keep zeros (empty tiles) - default MatchOutsideMap behavior

	workingMap := &tilemap.TileMap{
		Layers: extendedLayers,
		Props:  inputMap.Props,
	}

	context := &EdgeMatchContext{
		OriginalWidth:  originalWidth,
		OriginalHeight: originalHeight,
		PadX:           padX,
		PadY:           padY,
		WasExtended:    true,
	}

	return workingMap, context
}

// fillOverflowBorder fills the padding regions with the nearest edge tiles.
// This implements the OverflowBorder behavior where out-of-bounds tiles
// are treated as repetition of the nearest in-bounds tile.
func fillOverflowBorder(layers []tilemap.TileLayer, padX, padY, origWidth, origHeight int) {
	for i := range layers {
		layer := &layers[i]
		newWidth := layer.Width
		newHeight := layer.Height()

		// Fill all padding positions
		for y := 0; y < newHeight; y++ {
			for x := 0; x < newWidth; x++ {
				// Skip original map region (already copied)
				if x >= padX && x < padX+origWidth && y >= padY && y < padY+origHeight {
					continue
				}

				// Calculate clamped position in original map
				origX := x - padX
				origY := y - padY

				// Clamp to original bounds
				if origX < 0 {
					origX = 0
				} else if origX >= origWidth {
					origX = origWidth - 1
				}

				if origY < 0 {
					origY = 0
				} else if origY >= origHeight {
					origY = origHeight - 1
				}

				// Get tile from clamped position (offset by padding)
				srcIdx := (origY+padY)*newWidth + (origX + padX)
				dstIdx := y*newWidth + x

				layer.Data[dstIdx] = layer.Data[srcIdx]
			}
		}
	}
}

// fillWrapBorder fills the padding regions with wrapped tiles.
// This implements the WrapBorder behavior where the map is treated as toroidal
// (wrapping around edges).
func fillWrapBorder(layers []tilemap.TileLayer, padX, padY, origWidth, origHeight int) {
	for i := range layers {
		layer := &layers[i]
		newWidth := layer.Width
		newHeight := layer.Height()

		// Fill all padding positions
		for y := 0; y < newHeight; y++ {
			for x := 0; x < newWidth; x++ {
				// Skip original map region (already copied)
				if x >= padX && x < padX+origWidth && y >= padY && y < padY+origHeight {
					continue
				}

				// Calculate position relative to original map
				origX := x - padX
				origY := y - padY

				// Wrap coordinates using modulo
				wrappedX := ((origX % origWidth) + origWidth) % origWidth
				wrappedY := ((origY % origHeight) + origHeight) % origHeight

				// Get tile from wrapped position (offset by padding)
				srcIdx := (wrappedY+padY)*newWidth + (wrappedX + padX)
				dstIdx := y*newWidth + x

				layer.Data[dstIdx] = layer.Data[srcIdx]
			}
		}
	}
}

// RestoreMapEdges crops output layers back to the original map size.
// Modifies the outputLayers map in-place.
// Does nothing if the context indicates the map was not extended.
func RestoreMapEdges(
	outputLayers map[string]*tilemap.TileLayer,
	ctx *EdgeMatchContext,
) {
	if !ctx.WasExtended {
		return
	}

	logToConsole(fmt.Sprintf("[Automap] Cropping output layers back to original size: %dx%d",
		ctx.OriginalWidth, ctx.OriginalHeight))

	for key, layer := range outputLayers {
		croppedLayers := tilemap.CropLayers(
			[]tilemap.TileLayer{*layer},
			ctx.PadX,
			ctx.PadY,
			ctx.OriginalWidth,
			ctx.OriginalHeight,
		)
		outputLayers[key] = &croppedLayers[0]
	}
}
