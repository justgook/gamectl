package main

import (
	"math/rand"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// PatternMatcher checks if rules match at positions
type PatternMatcher struct {
	Config *GlobalConfig
}

// TryMatch checks if rule matches at (x, y)
// Returns selected output if match, nil otherwise
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

	// Check all target layers (AND across different targets)
	for targetSelector, inputs := range layersByTarget {
		// Find target layer in input map
		targetLayer := tilemap.FindLayer(inputMap, targetSelector)
		if targetLayer == nil {
			return nil // Target layer not found
		}

		// OR across inputs targeting same layer
		// At least one input pattern must match
		matched := false

		for _, input := range inputs {
			if m.matchesAt(input, targetLayer, x, y) {
				matched = true
				break // This target matched (OR satisfied)
			}
		}

		if !matched {
			return nil // This target didn't match (AND failed)
		}
	}

	// All targets matched! Select output by probability
	return m.selectOutput(rule.Outputs)
}

// matchesAt checks if input pattern matches at (x, y)
func (m *PatternMatcher) matchesAt(
	input *InputLayer,
	targetLayer *tilemap.TileLayer,
	x, y int,
) bool {
	// Create tile matcher
	matcher := NewTileMatcher(m.Config, input)

	// Check each tile in pattern
	for _, patternTile := range input.Tiles {
		// Calculate absolute position
		targetX := x + patternTile.Point.X
		targetY := y + patternTile.Point.Y

		// Get target tile at this position
		targetTileValue, valid := m.getTileAt(targetLayer, targetX, targetY)
		if !valid && !m.Config.MatchOutsideMap {
			return false
		}

		// Match tiles
		if !matcher.Matches(patternTile.Value, targetTileValue, input.IsNegated) {
			return false
		}
	}

	return true
}

// getTileAt handles boundary conditions
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

	// Out of bounds, treat as empty
	return 0, false
}

// selectOutput chooses output by probability
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
