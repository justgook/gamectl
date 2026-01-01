package keylock

import (
	"encoding/json"
	"strconv"

	"github.com/justgook/gamectl/pkg/tree"
)

// Random interface for dependency injection
type Random interface {
	Intn(n int) int
	Float64() float64
}

// Config holds the configuration for key-lock assignment
type Config struct {
	KeyChance      float64 // Base probability to place a key (0.0-1.0)
	LockChance     float64 // Probability to lock a node (0.0-1.0)
	MaxKeysPerLock int     // Maximum keys required per lock
}

// DefaultConfig returns default configuration values
func DefaultConfig() *Config {
	return &Config{
		KeyChance:      0.5,
		LockChance:     0.7,
		MaxKeysPerLock: 2,
	}
}

// FairRandom implements fair random distribution
// Probability increases with each failed attempt
type FairRandom struct {
	baseChance    float64
	currentChance float64
	rng           Random
}

// NewFairRandom creates a new fair random instance
func NewFairRandom(baseChance float64, rng Random) *FairRandom {
	return &FairRandom{
		baseChance:    baseChance,
		currentChance: baseChance,
		rng:           rng,
	}
}

// Try attempts to succeed based on current probability
// Returns true on success (resets chance), false on failure (increases chance)
func (fr *FairRandom) Try() bool {
	if fr.rng.Float64() < fr.currentChance {
		fr.currentChance = fr.baseChance // reset on success
		return true
	}
	fr.currentChance += fr.baseChance // increase on fail
	if fr.currentChance > 1.0 {
		fr.currentChance = 1.0
	}
	return false
}

// TryWithOverride attempts with an optional override chance
// If override > 0, uses that instead of current fair random chance
func (fr *FairRandom) TryWithOverride(override float64) bool {
	if override > 0 {
		return fr.rng.Float64() < override
	}
	return fr.Try()
}

// Reset resets the fair random to base chance
func (fr *FairRandom) Reset() {
	fr.currentChance = fr.baseChance
}

// AssignKeysAndLocks assigns keys and locks to tree nodes
// Keys are distributed using fair random, locks reference previously placed keys
func AssignKeysAndLocks(t *tree.Tree, keys []string, cfg *Config, rng Random) error {
	if len(*t) == 0 || len(keys) == 0 {
		return nil
	}

	// Track which keys have been placed and where
	placedKeys := make([]string, 0, len(keys))
	availableKeys := make([]string, len(keys))
	copy(availableKeys, keys)

	// Calculate minimum keys per node if we have more keys than nodes
	nodeCount := len(*t)
	keysPerNode := 0
	extraKeys := len(keys)

	// We don't place keys in the last node (leaf) to ensure keys are obtainable before final locks
	// Also root can have keys but probably shouldn't in most cases
	eligibleNodes := nodeCount - 1 // exclude last node
	if eligibleNodes < 1 {
		eligibleNodes = 1
	}

	if len(keys) >= eligibleNodes {
		keysPerNode = len(keys) / eligibleNodes
		extraKeys = len(keys) % eligibleNodes
	}

	// Fair random for key placement
	keyFairRandom := NewFairRandom(cfg.KeyChance, rng)

	// Fair random for lock placement
	lockFairRandom := NewFairRandom(cfg.LockChance, rng)

	// Phase 1: Distribute keys
	for i := range *t {
		node := (*t)[i]

		// Initialize data map if nil
		if node.Data == nil {
			node.Data = make(map[string]string)
		}

		// Skip last node for key placement
		if i == len(*t)-1 {
			continue
		}

		// Determine how many keys to place in this node
		keysToPlace := 0

		// Guaranteed keys if we have more keys than nodes
		if keysPerNode > 0 && len(availableKeys) > 0 {
			keysToPlace = keysPerNode
			if extraKeys > 0 {
				extraKeys--
				keysToPlace++
			}
		} else if len(availableKeys) > 0 {
			// Use fair random with possible node override
			overrideChance := 0.0
			if chanceStr, ok := node.Data["keyChance"]; ok {
				if parsed, err := strconv.ParseFloat(chanceStr, 64); err == nil {
					overrideChance = parsed
				}
			}

			if keyFairRandom.TryWithOverride(overrideChance) {
				keysToPlace = 1
			}
		}

		// Place keys in this node
		if keysToPlace > 0 && len(availableKeys) > 0 {
			nodeKeys := make([]string, 0, keysToPlace)
			for j := 0; j < keysToPlace && len(availableKeys) > 0; j++ {
				// Pick random key from available
				idx := rng.Intn(len(availableKeys))
				key := availableKeys[idx]

				// Remove from available
				availableKeys = append(availableKeys[:idx], availableKeys[idx+1:]...)

				nodeKeys = append(nodeKeys, key)
				placedKeys = append(placedKeys, key)
			}

			// Store as JSON array string
			keysJSON, _ := json.Marshal(nodeKeys)
			node.Data["keys"] = string(keysJSON)
		}
	}

	// Phase 2: Assign locks
	for i := range *t {
		node := (*t)[i]

		// Root node (parent == -1) cannot have locks
		if node.ParentId < 0 {
			continue
		}

		// Skip if no keys have been placed yet
		if len(placedKeys) == 0 {
			continue
		}

		// Determine keys available for locking at this point
		// We need to find keys placed in nodes that come BEFORE this node in traversal
		keysBeforeThisNode := getKeysBeforeNode(t, i)
		if len(keysBeforeThisNode) == 0 {
			continue
		}

		// Use fair random for lock placement
		if lockFairRandom.Try() {
			// Determine how many keys to require (1 to maxKeysPerLock)
			maxLocks := cfg.MaxKeysPerLock
			if maxLocks > len(keysBeforeThisNode) {
				maxLocks = len(keysBeforeThisNode)
			}

			numLocks := 1
			if maxLocks > 1 {
				numLocks = 1 + rng.Intn(maxLocks)
			}

			// Pick random keys for the lock
			lockKeys := make([]string, 0, numLocks)
			availableForLock := make([]string, len(keysBeforeThisNode))
			copy(availableForLock, keysBeforeThisNode)

			for j := 0; j < numLocks && len(availableForLock) > 0; j++ {
				idx := rng.Intn(len(availableForLock))
				lockKeys = append(lockKeys, availableForLock[idx])
				availableForLock = append(availableForLock[:idx], availableForLock[idx+1:]...)
			}

			// Store as JSON array string
			locksJSON, _ := json.Marshal(lockKeys)
			node.Data["locks"] = string(locksJSON)
		}
	}

	return nil
}

// getKeysBeforeNode returns all keys placed in nodes that come before the given node index
// This ensures a key is never placed behind a door requiring that same key
func getKeysBeforeNode(t *tree.Tree, nodeIdx int) []string {
	keys := make([]string, 0)

	for i := 0; i < nodeIdx; i++ {
		node := (*t)[i]
		if node.Data == nil {
			continue
		}

		if keysJSON, ok := node.Data["keys"]; ok {
			var nodeKeys []string
			if err := json.Unmarshal([]byte(keysJSON), &nodeKeys); err == nil {
				keys = append(keys, nodeKeys...)
			}
		}
	}

	return keys
}

// GetNodeKeys extracts keys from a node's data
func GetNodeKeys(node *tree.Node) []string {
	if node.Data == nil {
		return nil
	}

	keysJSON, ok := node.Data["keys"]
	if !ok {
		return nil
	}

	var keys []string
	if err := json.Unmarshal([]byte(keysJSON), &keys); err != nil {
		return nil
	}

	return keys
}

// GetNodeLocks extracts locks from a node's data
func GetNodeLocks(node *tree.Node) []string {
	if node.Data == nil {
		return nil
	}

	locksJSON, ok := node.Data["locks"]
	if !ok {
		return nil
	}

	var locks []string
	if err := json.Unmarshal([]byte(locksJSON), &locks); err != nil {
		return nil
	}

	return locks
}
