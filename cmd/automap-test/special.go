package main

// TileMatcher handles special tile matching logic
type TileMatcher struct {
	SpecialTiles *SpecialTileDefs
	UsedTiles    map[uint32]bool
}

// NewTileMatcher creates matcher for an input layer
func NewTileMatcher(config *GlobalConfig, input *InputLayer) *TileMatcher {
	return &TileMatcher{
		SpecialTiles: &config.SpecialTiles,
		UsedTiles:    buildUsedTilesSet(input),
	}
}

// Matches checks if patternTile matches targetTile
func (m *TileMatcher) Matches(patternTile, targetTile uint32, isNegated bool) bool {
	result := m.matchesInternal(patternTile, targetTile)

	if isNegated {
		return !result
	}
	return result
}

// matchesInternal performs actual matching with special tile logic
func (m *TileMatcher) matchesInternal(patternTile, targetTile uint32) bool {
	// 1. Ignore - always matches
	if m.SpecialTiles.Ignore > 0 && patternTile == m.SpecialTiles.Ignore {
		return true
	}

	// 2. Empty - matches only tile ID 0
	if m.SpecialTiles.Empty > 0 && patternTile == m.SpecialTiles.Empty {
		return targetTile == 0
	}

	// 3. NonEmpty - matches any non-zero tile
	if m.SpecialTiles.NonEmpty > 0 && patternTile == m.SpecialTiles.NonEmpty {
		return targetTile != 0
	}

	// 4. Other - matches tiles not used in this pattern
	if m.SpecialTiles.Other > 0 && patternTile == m.SpecialTiles.Other {
		return targetTile != 0 && !m.UsedTiles[targetTile]
	}

	// 5. Negate - should not appear as direct pattern tile
	if m.SpecialTiles.Negate > 0 && patternTile == m.SpecialTiles.Negate {
		return false
	}

	// 6. Exact match
	return patternTile == targetTile
}

// buildUsedTilesSet creates set of non-special tiles used in input pattern
func buildUsedTilesSet(input *InputLayer) map[uint32]bool {
	used := make(map[uint32]bool)

	for _, tile := range input.Tiles {
		if tile.Value > 0 {
			used[tile.Value] = true
		}
	}

	return used
}
