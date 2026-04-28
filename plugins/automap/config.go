package main

import "strconv"

// GlobalConfig contains map-wide automapping configuration
type GlobalConfig struct {
	// Special Tiles (0 = not defined/disabled)
	SpecialTiles SpecialTileDefs

	// Global Behavior Flags
	MatchOutsideMap     bool
	OverflowBorder      bool
	WrapBorder          bool
	NoOverlappingOutput bool
	DeleteTiles         bool

	// Default rule constraints (can be overridden per-layer)
	ModX        int
	ModY        int
	OffsetX     int
	OffsetY     int
	Probability float64 // Default 1.0
}

// SpecialTileDefs maps special matcher tiles (all default to 0 = disabled)
type SpecialTileDefs struct {
	Empty     uint32 // Matches empty cells (0)
	NonEmpty  uint32 // Matches any non-empty tile
	Other     uint32 // Matches tiles not used in this rule
	Ignore    uint32 // Always matches (skip check)
	Negate    uint32 // Invert matching condition
	Different uint32 // Matches tiles different from the first bound reference tile
	Same      uint32 // Matches tiles equal to the first bound reference tile
}

// ParseGlobalConfig extracts configuration from rules map metadata
func ParseGlobalConfig(mapMeta map[string]string) (*GlobalConfig, error) {
	cfg := &GlobalConfig{
		Probability: 1.0, // Default to always apply
	}

	// Parse special tile definitions
	cfg.SpecialTiles.Empty = parseUint32(mapMeta["rule_Empty"], 0)
	cfg.SpecialTiles.NonEmpty = parseUint32(mapMeta["rule_NonEmpty"], 0)
	cfg.SpecialTiles.Other = parseUint32(mapMeta["rule_Other"], 0)
	cfg.SpecialTiles.Ignore = parseUint32(mapMeta["rule_Ignore"], 0)
	cfg.SpecialTiles.Negate = parseUint32(mapMeta["rule_Negate"], 0)
	cfg.SpecialTiles.Different = parseUint32(mapMeta["rule_Different"], 0)
	cfg.SpecialTiles.Same = parseUint32(mapMeta["rule_Same"], 0)

	// Parse boolean flags
	cfg.MatchOutsideMap = parseBool(mapMeta["rule_MatchOutsideMap"], false)
	cfg.OverflowBorder = parseBool(mapMeta["rule_OverflowBorder"], false)
	cfg.WrapBorder = parseBool(mapMeta["rule_WrapBorder"], false)
	cfg.NoOverlappingOutput = parseBool(mapMeta["rule_NoOverlappingOutput"], false)
	cfg.DeleteTiles = parseBool(mapMeta["rule_DeleteTiles"], false)

	// Parse rule constraints
	cfg.ModX = parseInt(mapMeta["rule_ModX"], 0)
	cfg.ModY = parseInt(mapMeta["rule_ModY"], 0)
	cfg.OffsetX = parseInt(mapMeta["rule_OffsetX"], 0)
	cfg.OffsetY = parseInt(mapMeta["rule_OffsetY"], 0)
	cfg.Probability = parseFloat(mapMeta["rule_Probability"], 1.0)

	return cfg, nil
}

// Helper parsers with fallback defaults

func parseUint32(s string, fallback uint32) uint32 {
	if s == "" {
		return fallback
	}

	if val, err := strconv.ParseUint(s, 10, 32); err == nil {
		return uint32(val)
	}

	return fallback
}

func parseBool(s string, fallback bool) bool {
	if s == "" {
		return fallback
	}

	return s == "true" || s == "1"
}

func parseInt(s string, fallback int) int {
	if s == "" {
		return fallback
	}

	if val, err := strconv.Atoi(s); err == nil {
		return val
	}

	return fallback
}

func parseFloat(s string, fallback float64) float64 {
	if s == "" {
		return fallback
	}

	if val, err := strconv.ParseFloat(s, 64); err == nil {
		return val
	}

	return fallback
}

// IsSpecial checks if a tile ID is a special matcher
func (s *SpecialTileDefs) IsSpecial(tileID uint32) bool {
	if tileID == 0 {
		return false
	}

	return tileID == s.Empty ||
		tileID == s.NonEmpty ||
		tileID == s.Other ||
		tileID == s.Ignore ||
		tileID == s.Negate ||
		tileID == s.Different ||
		tileID == s.Same
}
