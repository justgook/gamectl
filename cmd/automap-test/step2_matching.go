package main

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tilemap"
)

// Step2ValidateMatching tests pattern matching
func Step2ValidateMatching(
	rulesMap *tilemap.TileMap,
	inputMap *tilemap.TileMap,
	config *GlobalConfig,
	rules []*Rule,
) ([]MatchResult, error) {
	fmt.Println("\n=== STEP 2: Validate Pattern Matching ===")

	if len(inputMap.Layers) == 0 {
		return nil, fmt.Errorf("input map has no layers")
	}

	width := inputMap.Layers[0].Width
	height := inputMap.Layers[0].Height()

	// Create matcher
	matcher := &PatternMatcher{Config: config}

	// Track all matches
	var matches []MatchResult

	// Calculate scan range - need to include negative positions to handle edge/corner patterns
	// Patterns can have output tiles offset from (0,0), so we need to scan outside the map bounds
	scanMinX := -2
	scanMinY := -2
	scanMaxX := width + 2
	scanMaxY := height + 2

	fmt.Printf("Scanning %dx%d input map (expanded range: %d,%d to %d,%d for edge patterns)...\n",
		width, height, scanMinX, scanMinY, scanMaxX, scanMaxY)

	// Scan the map (including negative positions for edge/corner handling)
	for y := scanMinY; y < scanMaxY; y++ {
		for x := scanMinX; x < scanMaxX; x++ {
			for ruleIdx, rule := range rules {
				output := matcher.TryMatch(rule, inputMap, x, y)
				if output != nil {
					matches = append(matches, MatchResult{
						X:       x,
						Y:       y,
						RuleIdx: ruleIdx,
						Output:  output,
					})
					break // First match wins
				}
			}
		}
	}

	fmt.Printf("✓ Found %d total matches\n", len(matches))

	// Analyze matches by position
	matchesByRegion := make(map[string]int)

	// Top-left corner (0,0)
	cornerMatches := 0
	topEdgeMatches := 0
	leftEdgeMatches := 0
	interiorMatches := 0

	for _, m := range matches {
		if m.X == 0 && m.Y == 0 {
			cornerMatches++
		} else if m.Y == 0 {
			topEdgeMatches++
		} else if m.X == 0 {
			leftEdgeMatches++
		} else {
			interiorMatches++
		}

		region := fmt.Sprintf("(%d,%d)", m.X/10, m.Y/10)
		matchesByRegion[region]++
	}

	fmt.Printf("\nMatch Distribution:\n")
	fmt.Printf("  Corner (0,0): %d\n", cornerMatches)
	fmt.Printf("  Top edge (y=0): %d\n", topEdgeMatches)
	fmt.Printf("  Left edge (x=0): %d\n", leftEdgeMatches)
	fmt.Printf("  Interior: %d\n", interiorMatches)

	// Show first 10 matches
	fmt.Println("\nFirst 10 matches:")
	for i := 0; i < min(10, len(matches)); i++ {
		m := matches[i]
		nonZeroTiles := 0
		for _, t := range m.Output.Tiles {
			if t.Value != 0 {
				nonZeroTiles++
			}
		}
		fmt.Printf("  [%2d] Pos (%2d,%2d) Rule %2d -> %d non-zero tiles\n",
			i, m.X, m.Y, m.RuleIdx, nonZeroTiles)
	}

	// Debug first match in detail
	if len(matches) > 0 {
		m := matches[0]
		DebugMatch(m.RuleIdx, rules[m.RuleIdx], inputMap, m.X, m.Y, config)
	}

	// Validate we have matches
	if len(matches) == 0 {
		return matches, fmt.Errorf("no matches found - pattern matching may be broken")
	}

	fmt.Println("\n✅ Step 2 PASSED: Pattern matching working")
	return matches, nil
}

// MatchResult represents a single pattern match
type MatchResult struct {
	X       int
	Y       int
	RuleIdx int
	Output  *OutputLayer
}
