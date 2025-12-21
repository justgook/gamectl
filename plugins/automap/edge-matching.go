package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
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
// This implements the MatchOutsideMap behavior where rules can partially extend beyond map edges.
// Returns the extended working map and a context object needed for later restoration.
// If rules is empty or have no bounds, returns the original map unchanged.
func PrepareMapForEdgeMatching(
	inputMap *tilemap.TileMap,
	rules []*Rule,
) (*tilemap.TileMap, *EdgeMatchContext) {
	// Calculate maximum rule bounds
	maxRuleWidth, maxRuleHeight := CalculateMaxRuleBounds(rules)

	// If no rules or rules have no size, return original map
	if maxRuleWidth == 0 || maxRuleHeight == 0 {
		return inputMap, &EdgeMatchContext{WasExtended: false}
	}

	logToConsole(fmt.Sprintf("[Automap] MatchOutsideMap enabled - max rule bounds: %dx%d", maxRuleWidth, maxRuleHeight))

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

	// Extend all input layers with empty tiles (0)
	extendedLayers := tilemap.ExtendLayers(inputMap.Layers, padX, padY, padX, padY)

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
