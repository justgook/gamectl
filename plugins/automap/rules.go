package main

import (
	"fmt"
	"sort"

	"github.com/justgook/gams/pkg/tilemap"
)

// rulePropsToExclude lists all rule-specific properties
var rulePropsToExclude = map[string]bool{
	"name":      true,
	"rule_role": true, "rule_target_layer": true, "rule_input_index": true,
	"rule_input_not": true, "rule_layer_IgnoreHorizontalFlip": true,
	"rule_layer_IgnoreVerticalFlip": true, "rule_layer_IgnoreDiagonalFlip": true,
	"rule_layer_AutoEmpty": true, "rule_output_index": true,
	"rule_output_Probability": true, "rule_ModX": true, "rule_ModY": true,
	"rule_OffsetX": true, "rule_OffsetY": true, "rule_Probability": true,
	"rule_Disabled": true, "rule_MatchOutsideMap": true, "rule_OverflowBorder": true,
	"rule_WrapBorder": true, "rule_NoOverlappingOutput": true,
	"rule_DeleteTiles": true, "rule_Empty": true, "rule_NonEmpty": true,
	"rule_Other": true, "rule_Ignore": true, "rule_Negate": true,
	"rule_Different": true, "rule_Same": true,
}

// shouldCopyProp checks if a property should be copied
func shouldCopyProp(key string) bool {
	return !rulePropsToExclude[key]
}

// Rule represents one pattern alternative (one input_index)
// Contains multiple InputLayers that define the matching conditions
type Rule struct {
	InputGroups []*InputGroup
	Outputs     *RuleOutputs

	// Rule constraints (inherited from first input or global)
	ModX, ModY       int
	OffsetX, OffsetY int
	Probability      float64
	OrderX, OrderY   int

	// Configuration for special tiles and matching behavior
	Config *GlobalConfig
}

func (r *Rule) Match(inputMap *tilemap.TileMap, index int) bool {
	if !r.matchesPositionConstraints(inputMap, index) {
		return false
	}

	width := inputMap.Layers[0].Width
	height := inputMap.Layers[0].Height()

	for _, inputGroup := range r.InputGroups {
		targetLayer := findLayerOrEmpty(inputMap, inputGroup.TargetSelector, width, height)
		if !inputGroup.Match(targetLayer, index, width, height, r.Config) {
			return false
		}
	}

	return true
}

func (r *Rule) matchesPositionConstraints(inputMap *tilemap.TileMap, index int) bool {
	if len(inputMap.Layers) == 0 {
		return false
	}

	width := inputMap.Layers[0].Width
	x := index % width
	y := index / width

	modX := max(r.ModX, 1)
	modY := max(r.ModY, 1)

	if (x-r.OffsetX)%modX != 0 {
		return false
	}
	if (y-r.OffsetY)%modY != 0 {
		return false
	}

	if r.Probability <= 0 {
		return false
	}
	if r.Probability >= 1 {
		return true
	}

	return randomFloat64() <= r.Probability
}

// InputLayer represents one input pattern layer
// Tiles are stored as coordinate+value pairs (no bounding box assumption)
type InputLayer struct {
	// Tile positions and values (0 = empty)
	Tiles []Tile

	// Which layer to match against in target map
	TargetSelector string
	InputIndex     string

	// Matching flags
	IsNegated bool
}

type InputMatcher struct {
	Value     uint32
	IsNegated bool
}

type InputCell struct {
	Point    Point
	Matchers []InputMatcher
}

type InputGroup struct {
	TargetSelector  string
	InputIndex      string
	Cells           []InputCell
	HasEmptyMatcher bool
}

func (g *InputGroup) Match(targetLayer *tilemap.TileLayer, index, width, height int, config *GlobalConfig) bool {
	referenceTile := uint32(0)
	hasReference := false

	for _, cell := range g.Cells {
		absIndex := RelativeToAbsoluteIndex(index, width, height, cell.Point.X, cell.Point.Y)
		if absIndex < 0 {
			return false
		}

		inputTileValue := targetLayer.Data[absIndex]
		hasNegateTile := false
		matched := false
		bindReference := false

		for _, matcher := range cell.Matchers {
			if matcher.Value == config.SpecialTiles.Negate {
				hasNegateTile = true
				continue
			}

			cellMatched := matchTile(matcher.Value, inputTileValue, config, g, referenceTile, hasReference)
			if matcher.IsNegated {
				cellMatched = !cellMatched
			}

			if cellMatched {
				matched = true
				if !hasReference && !matcher.IsNegated && isReferenceBinder(matcher.Value, config) {
					bindReference = true
				}
			}
		}

		if hasNegateTile {
			matched = !matched
			bindReference = false
		}

		if !matched {
			return false
		}

		if bindReference {
			referenceTile = inputTileValue
			hasReference = true
		}
	}

	return true
}

// OutputLayer represents tiles to place when rule matches
type OutputLayer struct {
	// Tile positions and values to write
	Tiles []Tile

	// Which layer to write to
	TargetSelector string

	// For probability-based selection
	OutputIndex string
	Probability float64

	// Custom properties from the source layer (excluding rule_* properties)
	Props map[string]string
}

type OutputVariant struct {
	Index       string
	Probability float64
	Layers      []*OutputLayer
}

type RuleOutputs struct {
	Always   []*OutputLayer
	Variants []*OutputVariant
}

// ExtractRules converts rules map into Rule objects using single-pass recursive extraction
func ExtractRules(rulesMap *tilemap.TileMap, config *GlobalConfig) ([]*Rule, error) {
	if len(rulesMap.Layers) == 0 {
		return nil, fmt.Errorf("no layers in rules map")
	}

	width := rulesMap.Layers[0].Width
	height := rulesMap.Layers[0].Height()

	// Global tracking: which positions are already in a rule
	used := make([]bool, width*height)
	var rules []*Rule

	// Scan all positions
	for idx := 0; idx < width*height; idx++ {
		if used[idx] {
			continue
		}

		// Check if any layer has a tile here
		if !hasAnyTile(rulesMap, idx) {
			continue
		}

		// Found a rule start - collect all tiles recursively
		// ruleTiles[layerIdx] = []Tile
		ruleTiles := make(map[int][]Tile)

		collectRuleTiles(rulesMap, idx, width, height, used, ruleTiles)

		var inputLayers []*InputLayer
		var outputLayers []*OutputLayer

		// First pass: find global minimum coordinates across ALL layers in this rule
		globalMinX, globalMinY := int(^uint(0)>>1), int(^uint(0)>>1) // Max int
		for _, tiles := range ruleTiles {
			if len(tiles) == 0 {
				continue
			}
			for _, tile := range tiles {
				if tile.Point.X < globalMinX {
					globalMinX = tile.Point.X
				}
				if tile.Point.Y < globalMinY {
					globalMinY = tile.Point.Y
				}
			}
		}

		// Second pass: normalize all tiles using the same global reference point
		for layerIdx, tiles := range ruleTiles {
			if len(tiles) == 0 {
				continue
			}

			layer := &rulesMap.Layers[layerIdx]
			role := layer.Props["rule_role"]
			targetLayer := layer.Props["rule_target_layer"]

			// Validate required properties
			if role == "" {
				return nil, fmt.Errorf("layer %d missing rule_role property", layerIdx)
			}
			if targetLayer == "" {
				return nil, fmt.Errorf("layer %d missing rule_target_layer property", layerIdx)
			}

			// Normalize tiles relative to global minimum
			normalized := make([]Tile, len(tiles))
			for i, t := range tiles {
				normalized[i] = Tile{
					Point: Point{X: t.Point.X - globalMinX, Y: t.Point.Y - globalMinY},
					Value: t.Value,
				}
			}

			if role == "input" {
				inputLayers = append(inputLayers, &InputLayer{
					Tiles:          normalized,
					TargetSelector: targetLayer,
					InputIndex:     layer.Props["rule_input_index"],
					IsNegated:      parseBool(layer.Props["rule_input_not"], false),
				})
			} else if role == "output" {
				// Copy non-rule properties from source layer
				props := make(map[string]string)
				for key, value := range layer.Props {
					if shouldCopyProp(key) {
						props[key] = value
					}
				}

				outputLayers = append(outputLayers, &OutputLayer{
					Tiles:          normalized,
					TargetSelector: targetLayer,
					OutputIndex:    layer.Props["rule_output_index"],
					Probability:    parseFloat(layer.Props["rule_output_Probability"], 1.0),
					Props:          props,
				})
			}
		}

		// Only create rule if has both inputs and outputs
		if len(inputLayers) > 0 && len(outputLayers) > 0 {
			inputGroups, err := buildInputGroups(inputLayers, config)
			if err != nil {
				return nil, fmt.Errorf("rule at position %d: %w", idx, err)
			}

			rules = append(rules, &Rule{
				InputGroups: inputGroups,
				Outputs:     buildRuleOutputs(outputLayers),
				ModX:        max(parseInt(firstNonEmptyLayerProp(inputLayers, rulesMap, "rule_ModX"), config.ModX), 1),
				ModY:        max(parseInt(firstNonEmptyLayerProp(inputLayers, rulesMap, "rule_ModY"), config.ModY), 1),
				OffsetX:     parseInt(firstNonEmptyLayerProp(inputLayers, rulesMap, "rule_OffsetX"), config.OffsetX),
				OffsetY:     parseInt(firstNonEmptyLayerProp(inputLayers, rulesMap, "rule_OffsetY"), config.OffsetY),
				Probability: config.Probability,
				OrderX:      globalMinX,
				OrderY:      globalMinY,
				Config:      config,
			})
		} else {
			return nil, fmt.Errorf("rule at position %d has only inputs=%d or only outputs=%d (need both)",
				idx, len(inputLayers), len(outputLayers))
		}
	}

	sort.SliceStable(rules, func(i, j int) bool {
		if rules[i].OrderY != rules[j].OrderY {
			return rules[i].OrderY < rules[j].OrderY
		}
		return rules[i].OrderX < rules[j].OrderX
	})

	return rules, nil
}

// collectRuleTiles recursively collects all tiles connected to idx (4-way)
// Marks positions as used and stores tiles by layer index
func collectRuleTiles(rulesMap *tilemap.TileMap, idx, width, height int,
	used []bool, ruleTiles map[int][]Tile) {
	// Already used? Stop recursion
	if used[idx] {
		return
	}

	// Mark as used immediately
	used[idx] = true

	// Calculate x,y for this position
	x := idx % width
	y := idx / width

	// Check all layers at this position and collect non-zero tiles
	hasAnyTileHere := false
	for layerIdx := range rulesMap.Layers {
		tileValue := rulesMap.Layers[layerIdx].Data[idx]

		if tileValue != 0 {
			hasAnyTileHere = true
			ruleTiles[layerIdx] = append(ruleTiles[layerIdx], Tile{
				Point: Point{X: x, Y: y},
				Value: tileValue,
			})
		}
	}

	// If no tiles here, don't recurse
	if !hasAnyTileHere {
		return
	}

	for dy := -1; dy <= 1; dy++ {
		for dx := -1; dx <= 1; dx++ {
			if dx == 0 && dy == 0 {
				continue
			}

			nx := x + dx
			ny := y + dy
			if nx < 0 || nx >= width || ny < 0 || ny >= height {
				continue
			}

			collectRuleTiles(rulesMap, ny*width+nx, width, height, used, ruleTiles)
		}
	}
}

// hasAnyTile checks if any layer has a non-zero tile at index
func hasAnyTile(rulesMap *tilemap.TileMap, idx int) bool {
	for i := range rulesMap.Layers {
		if rulesMap.Layers[i].Data[idx] != 0 {
			return true
		}
	}
	return false
}

// matchTile compares a rule tile value against an input tile value.
// Returns true if they match according to special tile rules.
func matchTile(ruleTileValue, inputTileValue uint32, config *GlobalConfig, group *InputGroup, referenceTile uint32, hasReference bool) bool {
	// Special case: Ignore - always matches
	if ruleTileValue == config.SpecialTiles.Ignore {
		return true
	}

	// Special case: Empty - matches only tile value 0
	if ruleTileValue == config.SpecialTiles.Empty {
		return inputTileValue == 0
	}

	// Special case: NonEmpty - matches any non-zero tile
	if ruleTileValue == config.SpecialTiles.NonEmpty {
		return inputTileValue != 0
	}

	// Special case: Other - matches tiles NOT used in this rule
	if ruleTileValue == config.SpecialTiles.Other {
		return group.matchesOther(inputTileValue, config)
	}

	// Special case: Different - matches any tile not equal to the bound reference tile
	if ruleTileValue == config.SpecialTiles.Different {
		return hasReference && inputTileValue != referenceTile
	}

	// Special case: Same - matches any tile equal to the bound reference tile
	if ruleTileValue == config.SpecialTiles.Same {
		return hasReference && inputTileValue == referenceTile
	}

	// Regular match: exact value comparison
	return ruleTileValue == inputTileValue
}

func isReferenceBinder(ruleTileValue uint32, config *GlobalConfig) bool {
	if ruleTileValue == config.SpecialTiles.Empty ||
		ruleTileValue == config.SpecialTiles.Other ||
		ruleTileValue == config.SpecialTiles.Negate ||
		ruleTileValue == config.SpecialTiles.Different ||
		ruleTileValue == config.SpecialTiles.Same {
		return false
	}

	return true
}

// containsTileValue checks if a tile value is used anywhere in this input group
// Excludes special tiles from the check
func (g *InputGroup) containsTileValue(tileValue uint32, config *GlobalConfig) bool {
	// Zero is never "used" for Other matching
	if tileValue == 0 {
		return false
	}

	for _, cell := range g.Cells {
		for _, matcher := range cell.Matchers {
			if matcher.Value == 0 || config.SpecialTiles.IsSpecial(matcher.Value) {
				continue
			}
			if matcher.Value == tileValue {
				return true
			}
		}
	}

	return false
}

func (g *InputGroup) matchesOther(inputTileValue uint32, config *GlobalConfig) bool {
	if inputTileValue == 0 {
		return !g.HasEmptyMatcher
	}

	return !g.containsTileValue(inputTileValue, config)
}

// Bounds returns the maximum width and height needed for this rule's input region.
// Returns (maxWidth, maxHeight) representing the bounding box of the rule pattern.
// These values indicate how far from the origin (0,0) the rule extends.
func (r *Rule) Bounds() (width, height int) {
	maxX, maxY := 0, 0

	// Check all input layers
	for _, inputGroup := range r.InputGroups {
		for _, cell := range inputGroup.Cells {
			if cell.Point.X > maxX {
				maxX = cell.Point.X
			}
			if cell.Point.Y > maxY {
				maxY = cell.Point.Y
			}
		}
	}

	// Convert from max coordinates to dimensions (add 1)
	return maxX + 1, maxY + 1
}

// CalculateMaxRuleBounds finds the largest rule dimensions across all rules.
// Returns (maxWidth, maxHeight) representing the maximum bounding box needed
// to accommodate any rule in the set. Used for MatchOutsideMap padding calculation.
func CalculateMaxRuleBounds(rules []*Rule) (maxWidth, maxHeight int) {
	for _, rule := range rules {
		w, h := rule.Bounds()
		if w > maxWidth {
			maxWidth = w
		}
		if h > maxHeight {
			maxHeight = h
		}
	}
	return maxWidth, maxHeight
}

func buildInputGroups(inputLayers []*InputLayer, config *GlobalConfig) ([]*InputGroup, error) {
	groupMap := make(map[string]*InputGroup)
	order := make([]string, 0, len(inputLayers))

	for _, inputLayer := range inputLayers {
		key := inputLayer.TargetSelector + "\x00" + inputLayer.InputIndex
		group, ok := groupMap[key]
		if !ok {
			group = &InputGroup{
				TargetSelector: inputLayer.TargetSelector,
				InputIndex:     inputLayer.InputIndex,
			}
			groupMap[key] = group
			order = append(order, key)
		}

		cellMap := make(map[Point]int)
		for idx, cell := range group.Cells {
			cellMap[cell.Point] = idx
		}

		for _, tile := range inputLayer.Tiles {
			cellIdx, exists := cellMap[tile.Point]
			if !exists {
				group.Cells = append(group.Cells, InputCell{Point: tile.Point})
				cellIdx = len(group.Cells) - 1
				cellMap[tile.Point] = cellIdx
			}

			group.Cells[cellIdx].Matchers = append(group.Cells[cellIdx].Matchers, InputMatcher{
				Value:     tile.Value,
				IsNegated: inputLayer.IsNegated,
			})
		}
	}

	groups := make([]*InputGroup, 0, len(order))
	for _, key := range order {
		group := groupMap[key]
		for _, cell := range group.Cells {
			for _, matcher := range cell.Matchers {
				if matcher.Value == config.SpecialTiles.Empty {
					group.HasEmptyMatcher = true
				}
			}
		}
		sort.Slice(group.Cells, func(i, j int) bool {
			if group.Cells[i].Point.Y != group.Cells[j].Point.Y {
				return group.Cells[i].Point.Y < group.Cells[j].Point.Y
			}
			return group.Cells[i].Point.X < group.Cells[j].Point.X
		})
		if err := group.validateRelativeReferences(config); err != nil {
			return nil, err
		}

		groups = append(groups, group)
	}

	return groups, nil
}

func (g *InputGroup) validateRelativeReferences(config *GlobalConfig) error {
	hasReferenceBinder := false

	for _, cell := range g.Cells {
		cellHasRelative := false
		cellHasBinder := false
		for _, matcher := range cell.Matchers {
			if matcher.Value == config.SpecialTiles.Different || matcher.Value == config.SpecialTiles.Same {
				cellHasRelative = true
			}
			if !matcher.IsNegated && isReferenceBinder(matcher.Value, config) {
				cellHasBinder = true
			}
		}

		if cellHasRelative && !hasReferenceBinder {
			return fmt.Errorf("relative matcher at (%d,%d) used before reference established", cell.Point.X, cell.Point.Y)
		}
		if cellHasBinder {
			hasReferenceBinder = true
		}
	}

	return nil
}

func buildRuleOutputs(outputLayers []*OutputLayer) *RuleOutputs {
	outputs := &RuleOutputs{}
	variantMap := make(map[string]*OutputVariant)
	order := make([]string, 0)

	for _, outputLayer := range outputLayers {
		if outputLayer.OutputIndex == "" {
			outputs.Always = append(outputs.Always, outputLayer)
			continue
		}

		variant, ok := variantMap[outputLayer.OutputIndex]
		if !ok {
			variant = &OutputVariant{Index: outputLayer.OutputIndex, Probability: outputLayer.Probability}
			variantMap[outputLayer.OutputIndex] = variant
			order = append(order, outputLayer.OutputIndex)
		}

		variant.Layers = append(variant.Layers, outputLayer)
		variant.Probability = outputLayer.Probability
	}

	for _, key := range order {
		outputs.Variants = append(outputs.Variants, variantMap[key])
	}

	return outputs
}

func firstNonEmptyLayerProp(inputLayers []*InputLayer, rulesMap *tilemap.TileMap, key string) string {
	for _, inputLayer := range inputLayers {
		for i := range rulesMap.Layers {
			layer := &rulesMap.Layers[i]
			if layer.Props["rule_role"] != "input" {
				continue
			}
			if layer.Props["rule_target_layer"] != inputLayer.TargetSelector {
				continue
			}
			if layer.Props["rule_input_index"] != inputLayer.InputIndex {
				continue
			}
			if value := layer.Props[key]; value != "" {
				return value
			}
		}
	}

	return ""
}
