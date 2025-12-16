package main

import "strconv"

// ParseGlobalConfig extracts configuration from rules map metadata
func ParseGlobalConfig(mapMeta map[string]string) (*GlobalConfig, error) {
	cfg := &GlobalConfig{
		Probability: 1.0,
	}

	cfg.SpecialTiles.Empty = parseUint32(mapMeta["rule_Empty"], 0)
	cfg.SpecialTiles.NonEmpty = parseUint32(mapMeta["rule_NonEmpty"], 0)
	cfg.SpecialTiles.Other = parseUint32(mapMeta["rule_Other"], 0)
	cfg.SpecialTiles.Ignore = parseUint32(mapMeta["rule_Ignore"], 0)
	cfg.SpecialTiles.Negate = parseUint32(mapMeta["rule_Negate"], 0)

	cfg.MatchOutsideMap = parseBool(mapMeta["rule_MatchOutsideMap"], false)
	cfg.OverflowBorder = parseBool(mapMeta["rule_OverflowBorder"], false)
	cfg.WrapBorder = parseBool(mapMeta["rule_WrapBorder"], false)
	cfg.NoOverlappingOutput = parseBool(mapMeta["rule_NoOverlappingOutput"], false)
	cfg.MatchInOrder = parseBool(mapMeta["rule_MatchInOrder"], false)
	cfg.DeleteTiles = parseBool(mapMeta["rule_DeleteTiles"], false)

	cfg.ModX = parseInt(mapMeta["rule_ModX"], 0)
	cfg.ModY = parseInt(mapMeta["rule_ModY"], 0)
	cfg.OffsetX = parseInt(mapMeta["rule_OffsetX"], 0)
	cfg.OffsetY = parseInt(mapMeta["rule_OffsetY"], 0)
	cfg.Probability = parseFloat(mapMeta["rule_Probability"], 1.0)

	return cfg, nil
}

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
