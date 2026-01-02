package biomes

import (
	"github.com/justgook/gamectl/pkg/tree"
)

// Random interface for dependency injection
type Random interface {
	Intn(n int) int
}

// Config holds the configuration for biome assignment
type Config struct {
	// Currently no special config needed, but keeping for future extensibility
}

// DefaultConfig returns default configuration values
func DefaultConfig() *Config {
	return &Config{}
}

// AssignBiomes assigns biome names to tree nodes
// Each node gets a unique biome name (no duplicates)
func AssignBiomes(t *tree.Tree, biomeNames []string, rng Random) error {
	if len(*t) == 0 || len(biomeNames) == 0 {
		return nil
	}

	// Copy biome names to avoid modifying the original slice
	availableBiomes := make([]string, len(biomeNames))
	copy(availableBiomes, biomeNames)

	// Assign biomes to each node
	for i := range *t {
		node := (*t)[i]

		// Initialize data map if nil
		if node.Data == nil {
			node.Data = make(map[string]string)
		}

		// Skip if no biomes left
		if len(availableBiomes) == 0 {
			break
		}

		// Pick random biome from available
		idx := rng.Intn(len(availableBiomes))
		biomeName := availableBiomes[idx]

		// Remove from available (ensure uniqueness)
		availableBiomes = append(availableBiomes[:idx], availableBiomes[idx+1:]...)

		// Store biome name
		node.Data["name"] = biomeName
	}

	return nil
}

// GetNodeBiome extracts the biome name from a node's data
func GetNodeBiome(node *tree.Node) string {
	if node.Data == nil {
		return ""
	}

	return node.Data["name"]
}
