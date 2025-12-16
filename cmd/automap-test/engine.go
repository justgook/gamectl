package main

// This file contains the automap engine code copied/adapted for CLI testing
// We can't import the plugin directly since it's built for WASM

import (
	"fmt"
	"math/rand"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// Re-export types and functions from automap plugin for testing

// Point represents a 2D coordinate
type Point struct {
	X, Y int
}

// Tile represents a positioned tile with its value
type Tile struct {
	Point Point
	Value uint32
}

// Rule represents one pattern alternative
type Rule struct {
	InputLayers      []*InputLayer
	Outputs          []*OutputLayer
	ModX, ModY       int
	OffsetX, OffsetY int
	Probability      float64
}

// InputLayer represents one input pattern layer
type InputLayer struct {
	Tiles          []Tile
	TargetSelector string
	IsNegated      bool
	AutoEmpty      bool
}

// OutputLayer represents tiles to place when rule matches
type OutputLayer struct {
	Tiles          []Tile
	TargetSelector string
	OutputIndex    string
	Probability    float64
}

// GlobalConfig contains map-wide automapping configuration
type GlobalConfig struct {
	SpecialTiles        SpecialTileDefs
	MatchOutsideMap     bool
	OverflowBorder      bool
	WrapBorder          bool
	NoOverlappingOutput bool
	MatchInOrder        bool
	DeleteTiles         bool
	ModX                int
	ModY                int
	OffsetX             int
	OffsetY             int
	Probability         float64
}

// SpecialTileDefs maps special matcher tiles
type SpecialTileDefs struct {
	Empty    uint32
	NonEmpty uint32
	Other    uint32
	Ignore   uint32
	Negate   uint32
}

// OccupiedTracker tracks written tiles
type OccupiedTracker struct {
	occupied map[string]map[int]map[int]bool
}

func NewOccupiedTracker() *OccupiedTracker {
	return &OccupiedTracker{
		occupied: make(map[string]map[int]map[int]bool),
	}
}

func (t *OccupiedTracker) MarkOccupied(selector string, x, y int) {
	if t.occupied[selector] == nil {
		t.occupied[selector] = make(map[int]map[int]bool)
	}
	if t.occupied[selector][x] == nil {
		t.occupied[selector][x] = make(map[int]bool)
	}
	t.occupied[selector][x][y] = true
}

func (t *OccupiedTracker) IsOccupied(selector string, x, y int) bool {
	if t.occupied[selector] == nil {
		return false
	}
	if t.occupied[selector][x] == nil {
		return false
	}
	return t.occupied[selector][x][y]
}

// AutomapEngine orchestrates automapping
type AutomapEngine struct{}

// Apply executes automapping
func (e *AutomapEngine) Apply(
	rulesMap *tilemap.TileMap,
	inputMap *tilemap.TileMap,
	outputMap *tilemap.TileMap,
) error {
	fmt.Println("  [Engine] Starting automapping...")

	// Parse config
	config, err := ParseGlobalConfig(rulesMap.Props)
	if err != nil {
		return fmt.Errorf("parse config: %w", err)
	}

	// Detect regions
	regions, err := DetectRegions(rulesMap, config)
	if err != nil {
		return fmt.Errorf("detect regions: %w", err)
	}

	// Extract rules
	rules, err := ExtractRulesFromRegions(regions, rulesMap, config)
	if err != nil {
		return fmt.Errorf("extract rules: %w", err)
	}

	if len(rules) == 0 {
		return fmt.Errorf("no rules found")
	}

	fmt.Printf("  [Engine] Applying %d rules...\n", len(rules))

	// Initialize components
	matcher := &PatternMatcher{Config: config}
	applicator := &OutputApplicator{
		Config:   config,
		Occupied: NewOccupiedTracker(),
	}

	// Scan and apply
	if len(inputMap.Layers) == 0 {
		return nil
	}

	width := inputMap.Layers[0].Width
	height := inputMap.Layers[0].Height()

	matchCount := 0
	tilesPlaced := 0
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			for _, rule := range rules {
				output := matcher.TryMatch(rule, inputMap, x, y)
				if output != nil {
					matchCount++
					before := countNonZero(outputMap.Layers[0].Data)
					err := applicator.Apply(output, outputMap, x, y)
					if err != nil {
						return fmt.Errorf("apply at (%d,%d): %w", x, y, err)
					}
					after := countNonZero(outputMap.Layers[0].Data)
					tilesPlaced += (after - before)
					break
				}
			}
		}
	}

	fmt.Printf("  [Engine] Total matches: %d, tiles placed: %d\n", matchCount, tilesPlaced)
	return nil
}

func countNonZero(data []uint32) int {
	count := 0
	for _, v := range data {
		if v != 0 {
			count++
		}
	}
	return count
}

// CreateEmptyOutput creates an empty output map matching input structure
func CreateEmptyOutput(inputMap *tilemap.TileMap) *tilemap.TileMap {
	outputMap := tilemap.NewTileMap()
	outputMap.Props = make(map[string]string)
	for k, v := range inputMap.Props {
		outputMap.Props[k] = v
	}

	for _, inputLayer := range inputMap.Layers {
		outputLayer := tilemap.NewTileLayer(inputLayer.Width, inputLayer.Height())
		outputLayer.Props = make(map[string]string)
		for k, v := range inputLayer.Props {
			outputLayer.Props[k] = v
		}
		outputMap.Layers = append(outputMap.Layers, *outputLayer)
	}

	return outputMap
}

// PatternMatcher (simplified console version - no logging)
type PatternMatcher struct {
	Config *GlobalConfig
}

func (m *PatternMatcher) TryMatch(
	rule *Rule,
	inputMap *tilemap.TileMap,
	x, y int,
) *OutputLayer {
	// Check modulo constraints
	if rule.ModX > 0 && (x-rule.OffsetX)%rule.ModX != 0 {
		return nil
	}
	if rule.ModY > 0 && (y-rule.OffsetY)%rule.ModY != 0 {
		return nil
	}

	// Check probability
	if rand.Float64() > rule.Probability {
		return nil
	}

	// Group input layers by target selector
	layersByTarget := make(map[string][]*InputLayer)
	for _, input := range rule.InputLayers {
		target := input.TargetSelector
		if target == "" {
			target = "*"
		}
		layersByTarget[target] = append(layersByTarget[target], input)
	}

	// Check all target layers
	for targetSelector, inputs := range layersByTarget {
		targetLayer := tilemap.FindLayer(inputMap, targetSelector)
		if targetLayer == nil {
			return nil
		}

		matched := false
		for _, input := range inputs {
			if m.matchesAt(input, targetLayer, x, y) {
				matched = true
				break
			}
		}

		if !matched {
			return nil
		}
	}

	return m.selectOutput(rule.Outputs)
}

func (m *PatternMatcher) matchesAt(
	input *InputLayer,
	targetLayer *tilemap.TileLayer,
	x, y int,
) bool {
	matcher := NewTileMatcher(m.Config, input)

	for _, patternTile := range input.Tiles {
		targetX := x + patternTile.Point.X
		targetY := y + patternTile.Point.Y

		targetTileValue, valid := m.getTileAt(targetLayer, targetX, targetY)
		if !valid && !m.Config.MatchOutsideMap {
			return false
		}

		if !matcher.Matches(patternTile.Value, targetTileValue, input.IsNegated) {
			return false
		}
	}

	return true
}

func (m *PatternMatcher) getTileAt(layer *tilemap.TileLayer, x, y int) (uint32, bool) {
	width := layer.Width
	height := layer.Height()

	if x >= 0 && x < width && y >= 0 && y < height {
		return layer.Data[y*width+x], true
	}

	if m.Config.WrapBorder {
		x = ((x % width) + width) % width
		y = ((y % height) + height) % height
		return layer.Data[y*width+x], true
	}

	if m.Config.OverflowBorder {
		if x < 0 {
			x = 0
		} else if x >= width {
			x = width - 1
		}
		if y < 0 {
			y = 0
		} else if y >= height {
			y = height - 1
		}
		return layer.Data[y*width+x], true
	}

	return 0, false
}

func (m *PatternMatcher) selectOutput(outputs []*OutputLayer) *OutputLayer {
	if len(outputs) == 0 {
		return nil
	}
	if len(outputs) == 1 {
		return outputs[0]
	}

	totalWeight := 0.0
	for _, output := range outputs {
		totalWeight += output.Probability
	}

	if totalWeight <= 0 {
		return outputs[0]
	}

	r := rand.Float64() * totalWeight
	cumulative := 0.0

	for _, output := range outputs {
		cumulative += output.Probability
		if r <= cumulative {
			return output
		}
	}

	return outputs[len(outputs)-1]
}

// OutputApplicator writes matched outputs
type OutputApplicator struct {
	Config   *GlobalConfig
	Occupied *OccupiedTracker
}

func (a *OutputApplicator) Apply(
	output *OutputLayer,
	outputMap *tilemap.TileMap,
	x, y int,
) error {
	targetLayer := tilemap.FindLayer(outputMap, output.TargetSelector)
	if targetLayer == nil {
		// Debug: this might be the issue!
		if len(output.Tiles) > 0 && output.Tiles[0].Value != 0 {
			fmt.Printf("  [DEBUG] Target layer not found for selector '%s'\n", output.TargetSelector)
		}
		return nil
	}

	if a.Config.NoOverlappingOutput {
		if a.wouldOverlap(output, x, y) {
			return nil
		}
	}

	tilesWritten := 0
	tilesSkippedBounds := 0
	tilesSkippedZero := 0

	for _, tile := range output.Tiles {
		targetX := x + tile.Point.X
		targetY := y + tile.Point.Y

		if targetX < 0 || targetX >= targetLayer.Width {
			tilesSkippedBounds++
			continue
		}
		if targetY < 0 || targetY >= targetLayer.Height() {
			tilesSkippedBounds++
			continue
		}

		tileValue := tile.Value

		if a.Config.SpecialTiles.Empty > 0 && tileValue == a.Config.SpecialTiles.Empty {
			tileValue = 0
		}

		if tileValue == 0 {
			tilesSkippedZero++
		} else {
			tilesWritten++
		}

		idx := targetY*targetLayer.Width + targetX
		targetLayer.Data[idx] = tileValue

		if a.Config.NoOverlappingOutput && tileValue != 0 {
			a.Occupied.MarkOccupied(output.TargetSelector, targetX, targetY)
		}
	}

	// Debug first few applications
	if tilesWritten == 0 && len(output.Tiles) > 0 {
		fmt.Printf("    [Apply] No tiles written at (%d,%d): %d tiles, %d skipped (bounds), %d skipped (zero)\n",
			x, y, len(output.Tiles), tilesSkippedBounds, tilesSkippedZero)
	}

	return nil
}

func (a *OutputApplicator) wouldOverlap(output *OutputLayer, x, y int) bool {
	for _, tile := range output.Tiles {
		if tile.Value == 0 {
			continue
		}

		if a.Config.SpecialTiles.Empty > 0 && tile.Value == a.Config.SpecialTiles.Empty {
			continue
		}

		targetX := x + tile.Point.X
		targetY := y + tile.Point.Y

		if a.Occupied.IsOccupied(output.TargetSelector, targetX, targetY) {
			return true
		}
	}

	return false
}
