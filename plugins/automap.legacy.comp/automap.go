package main

import (
	"fmt"
	"sort"
	"strings"

	"github.com/kkgams/sdk/go/tilemap"
)

// logToConsole is intentionally a no-op in browser until logging is routed
// through a first-class plugin/service instead of the legacy generic host module.
func logToConsole(msg string) {
}

// Apply executes automapping in-place: match against the input map and write results back into it.
func AutomapApply(
	rulesMap *tilemap.TileMap,
	inputMap *tilemap.TileMap,
) (*tilemap.TileMap, error) {
	return AutomapApplyToTarget(rulesMap, inputMap, inputMap)
}

// AutomapApplyToTarget executes automapping by matching against inputMap and writing into targetMap.
// targetMap may be the same as inputMap (in-place update), a different existing map, or an empty/new map.
func AutomapApplyToTarget(
	rulesMap *tilemap.TileMap,
	inputMap *tilemap.TileMap,
	targetMap *tilemap.TileMap,
) (*tilemap.TileMap, error) {
	logToConsole("[Automap] Starting automapping...")
	logToConsole(fmt.Sprintf("[Automap] Rules map layers: %d", len(rulesMap.Layers)))
	logToConsole(fmt.Sprintf("[Automap] Input map layers: %d", len(inputMap.Layers)))
	logToConsole(fmt.Sprintf("[Automap] Target map layers: %d", len(targetMap.Layers)))

	// 1. Parse global config
	config, err := ParseGlobalConfig(rulesMap.Props)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	logToConsole(
		fmt.Sprintf(
			"[Automap] Config parsed - Special tiles: Empty=%d, NonEmpty=%d, Ignore=%d, Other=%d, Negate=%d, Different=%d, Same=%d",
			config.SpecialTiles.Empty,
			config.SpecialTiles.NonEmpty,
			config.SpecialTiles.Ignore,
			config.SpecialTiles.Other,
			config.SpecialTiles.Negate,
			config.SpecialTiles.Different,
			config.SpecialTiles.Same,
		),
	)

	// 2. Detect regions and extract rules
	rules, err := ExtractRules(rulesMap, config)
	if err != nil {
		return nil, fmt.Errorf("extract rules: %w", err)
	}

	if len(rules) == 0 {
		return nil, fmt.Errorf("no rules found in rules map")
	}

	// 3. Prepare maps for matching and writing.
	workingMap, edgeCtx := PrepareMapForEdgeMatching(rulesMap, inputMap, rules)
	resultMap := prepareTargetMapForOutput(targetMap, inputMap, edgeCtx)

	width := workingMap.Layers[0].Width
	height := workingMap.Layers[0].Height()
	matchedAny := false

	// 4. Match only against input/working map and write only to result map.
	matchesByRule := make([][]int, len(rules))
	for ruleIdx, rule := range rules {
		for i := range width * height {
			if rule.Match(workingMap, i) {
				matchesByRule[ruleIdx] = append(matchesByRule[ruleIdx], i)
			}
		}
	}

	for ruleIdx, rule := range rules {
		tracker := NewOccupiedTracker()
		for _, index := range matchesByRule[ruleIdx] {
			applyRule(resultMap, width, height, index, rule, tracker)
			matchedAny = true
		}
	}

	if !matchedAny {
		return nil, fmt.Errorf("no rules match")
	}

	// 5. Crop output map back to original size if we extended the map
	RestoreTileMapEdges(resultMap, edgeCtx)

	return resultMap, nil
}

func applyRule(
	resultMap *tilemap.TileMap,
	width, height, index int,
	rule *Rule,
	tracker *OccupiedTracker,
) {
	selected := selectedOutputs(rule.Outputs)
	if rule.Config.DeleteTiles {
		deleteRuleInputTiles(resultMap, width, height, index, rule, selected)
	}

	for _, outputLayer := range selected {
		targetLayer := getOrCreateTargetLayer(
			resultMap,
			width,
			height,
			outputLayer.TargetSelector,
			outputLayer.Props,
		)
		applyTilesToOutput(
			targetLayer,
			index,
			outputLayer,
			rule.Config,
			tracker,
			rule.Config.NoOverlappingOutput,
		)
	}
}

func selectedOutputs(outputs *RuleOutputs) []*OutputLayer {
	selected := make([]*OutputLayer, 0, len(outputs.Always)+1)
	selected = append(selected, outputs.Always...)

	variant := chooseVariant(outputs.Variants)
	if variant != nil {
		selected = append(selected, variant.Layers...)
	}

	return selected
}

func chooseVariant(variants []*OutputVariant) *OutputVariant {
	if len(variants) == 0 {
		return nil
	}

	total := 0.0
	for _, variant := range variants {
		if variant.Probability > 0 {
			total += variant.Probability
		}
	}

	if total <= 0 {
		return nil
	}

	roll := randomFloat64() * total
	for _, variant := range variants {
		if variant.Probability <= 0 {
			continue
		}
		roll -= variant.Probability
		if roll <= 0 {
			return variant
		}
	}

	return variants[len(variants)-1]
}

func applyTilesToOutput(
	targetLayer *tilemap.TileLayer,
	index int,
	outputLayer *OutputLayer,
	config *GlobalConfig,
	tracker *OccupiedTracker,
	noOverlap bool,
) {
	width := targetLayer.Width
	height := targetLayer.Height()

	for _, tile := range outputLayer.Tiles {
		outputValue := tile.Value
		if tile.Value == config.SpecialTiles.Empty {
			outputValue = 0
		}

		absIndex := RelativeToAbsoluteIndex(index, width, height, tile.Point.X, tile.Point.Y)
		if absIndex < 0 {
			continue
		}

		x := absIndex % width
		y := absIndex / width
		if noOverlap && tracker.IsOccupied(outputLayer.TargetSelector, x, y) {
			continue
		}

		targetLayer.Data[absIndex] = outputValue
		if noOverlap {
			tracker.MarkOccupied(outputLayer.TargetSelector, x, y)
		}
	}

	for key, value := range outputLayer.Props {
		targetLayer.Props[key] = value
	}
}

func deleteRuleInputTiles(
	resultMap *tilemap.TileMap,
	width, height, index int,
	rule *Rule,
	selected []*OutputLayer,
) {
	for _, outputLayer := range selected {
		targetLayer := getOrCreateTargetLayer(
			resultMap,
			width,
			height,
			outputLayer.TargetSelector,
			outputLayer.Props,
		)
		clearRuleRegion(targetLayer, index, rule)
	}
}

func clearRuleRegion(targetLayer *tilemap.TileLayer, index int, rule *Rule) {
	width := targetLayer.Width
	height := targetLayer.Height()
	cleared := map[int]struct{}{}

	for _, inputGroup := range rule.InputGroups {
		for _, cell := range inputGroup.Cells {
			absIndex := RelativeToAbsoluteIndex(index, width, height, cell.Point.X, cell.Point.Y)
			if absIndex < 0 {
				continue
			}
			if _, ok := cleared[absIndex]; ok {
				continue
			}
			targetLayer.Data[absIndex] = 0
			cleared[absIndex] = struct{}{}
		}
	}
}

func cloneTileMap(src *tilemap.TileMap) *tilemap.TileMap {
	if src == nil {
		return tilemap.NewTileMap()
	}

	cloned := tilemap.NewTileMap()
	cloned.Props = cloneStringMap(src.Props)
	cloned.Layers = make([]tilemap.TileLayer, len(src.Layers))
	for i := range src.Layers {
		cloned.Layers[i] = cloneTileLayer(&src.Layers[i])
	}

	return cloned
}

func cloneTileLayer(src *tilemap.TileLayer) tilemap.TileLayer {
	data := make([]uint32, len(src.Data))
	copy(data, src.Data)

	return tilemap.TileLayer{
		Width: src.Width,
		Data:  data,
		Props: cloneStringMap(src.Props),
	}
}

func cloneStringMap(src map[string]string) map[string]string {
	if src == nil {
		return map[string]string{}
	}

	cloned := make(map[string]string, len(src))
	for key, value := range src {
		cloned[key] = value
	}
	return cloned
}

func getOrCreateTargetLayer(
	resultMap *tilemap.TileMap,
	width, height int,
	selector string,
	props map[string]string,
) *tilemap.TileLayer {
	if layer := tilemap.FindLayer(resultMap, selector); layer != nil {
		ensureLayerSize(layer, width, height)
		if layer.Props == nil {
			layer.Props = map[string]string{}
		}
		for key, value := range props {
			layer.Props[key] = value
		}
		return layer
	}

	if strings.HasPrefix(selector, "#") {
		index := parseInt(strings.TrimPrefix(selector, "#"), -1)
		if index >= 0 {
			for len(resultMap.Layers) <= index {
				newLayer := tilemap.NewTileLayer(width, height)
				resultMap.Layers = append(resultMap.Layers, *newLayer)
			}
			layer := &resultMap.Layers[index]
			ensureLayerSize(layer, width, height)
			if layer.Props == nil {
				layer.Props = map[string]string{}
			}
			for key, value := range props {
				layer.Props[key] = value
			}
			return layer
		}
	}

	newLayer := tilemap.NewTileLayer(width, height)
	newLayer.Props = cloneStringMap(props)
	if newLayer.Props["name"] == "" {
		newLayer.Props["name"] = defaultLayerName(selector, len(resultMap.Layers))
	}

	resultMap.Layers = append(resultMap.Layers, *newLayer)
	return &resultMap.Layers[len(resultMap.Layers)-1]
}

func prepareTargetMapForOutput(
	targetMap, inputMap *tilemap.TileMap,
	edgeCtx *EdgeMatchContext,
) *tilemap.TileMap {
	resultMap := cloneTileMap(targetMap)
	if len(resultMap.Props) == 0 {
		resultMap.Props = cloneStringMap(inputMap.Props)
	}

	if edgeCtx.WasExtended {
		resultMap.Layers = tilemap.ExtendLayers(
			resultMap.Layers,
			edgeCtx.PadX,
			edgeCtx.PadY,
			edgeCtx.PadX,
			edgeCtx.PadY,
		)
	}

	return resultMap
}

func ensureLayerSize(layer *tilemap.TileLayer, width, height int) {
	if layer.Width == width && layer.Height() == height {
		return
	}

	newData := make([]uint32, width*height)
	copyWidth := minInt(layer.Width, width)
	copyHeight := minInt(layer.Height(), height)
	for y := 0; y < copyHeight; y++ {
		for x := 0; x < copyWidth; x++ {
			newData[y*width+x] = layer.Data[y*layer.Width+x]
		}
	}

	layer.Width = width
	layer.Data = newData
	if layer.Props == nil {
		layer.Props = map[string]string{}
	}
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func defaultLayerName(selector string, layerIndex int) string {
	selector = strings.TrimSpace(selector)
	if selector == "" || selector == "*" || strings.HasPrefix(selector, "[") {
		return fmt.Sprintf("layer_%d", layerIndex)
	}
	return selector
}

func findLayerOrEmpty(
	inputMap *tilemap.TileMap,
	selector string,
	width, height int,
) *tilemap.TileLayer {
	if layer := tilemap.FindLayer(inputMap, selector); layer != nil {
		return layer
	}

	return tilemap.NewTileLayer(width, height)
}

func sortRules(rules []*Rule) {
	sort.SliceStable(rules, func(i, j int) bool {
		if rules[i].OrderY != rules[j].OrderY {
			return rules[i].OrderY < rules[j].OrderY
		}
		return rules[i].OrderX < rules[j].OrderX
	})
}
