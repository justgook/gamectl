package keylock

import (
	"encoding/json"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

// MockRandom implements Random interface for deterministic testing
type MockRandom struct {
	floatValues []float64
	intValues   []int
	floatIdx    int
	intIdx      int
}

func NewMockRandom(floats []float64, ints []int) *MockRandom {
	return &MockRandom{
		floatValues: floats,
		intValues:   ints,
	}
}

func (m *MockRandom) Float64() float64 {
	if len(m.floatValues) == 0 {
		return 0.5
	}
	val := m.floatValues[m.floatIdx%len(m.floatValues)]
	m.floatIdx++
	return val
}

func (m *MockRandom) Intn(n int) int {
	if len(m.intValues) == 0 || n == 0 {
		return 0
	}
	val := m.intValues[m.intIdx%len(m.intValues)] % n
	m.intIdx++
	return val
}

// SeededRandom provides simple seeded random for testing
type SeededRandom struct {
	seed uint64
}

func NewSeededRandom(seed uint64) *SeededRandom {
	return &SeededRandom{seed: seed}
}

func (r *SeededRandom) Float64() float64 {
	r.seed = r.seed*6364136223846793005 + 1442695040888963407
	return float64(r.seed>>33) / float64(1<<31)
}

func (r *SeededRandom) Intn(n int) int {
	if n <= 0 {
		return 0
	}
	return int(r.Float64() * float64(n))
}

func TestFairRandom(t *testing.T) {
	t.Run("increases chance on failure", func(t *testing.T) {
		// Mock random always returns 0.6 (above base chance 0.5)
		rng := NewMockRandom([]float64{0.6, 0.6, 0.6, 0.6}, nil)
		fr := NewFairRandom(0.5, rng)

		// First try: 0.6 > 0.5, fail
		result := fr.Try()
		if result {
			t.Error("Expected failure on first try")
		}
		if fr.currentChance != 1.0 { // 0.5 + 0.5 = 1.0
			t.Errorf("Expected currentChance 1.0, got %f", fr.currentChance)
		}
	})

	t.Run("resets on success", func(t *testing.T) {
		// First return 0.3 (success), then 0.6 (fail at base)
		rng := NewMockRandom([]float64{0.3, 0.6}, nil)
		fr := NewFairRandom(0.5, rng)

		// First try: 0.3 < 0.5, success
		result := fr.Try()
		if !result {
			t.Error("Expected success on first try")
		}
		if fr.currentChance != 0.5 {
			t.Errorf("Expected currentChance reset to 0.5, got %f", fr.currentChance)
		}
	})

	t.Run("caps at 1.0", func(t *testing.T) {
		// Use high base chance (0.4) so it caps quickly
		// All tries fail (1.0 > currentChance) until we hit cap
		rng := NewMockRandom([]float64{1.0, 1.0, 1.0, 1.0}, nil)
		fr := NewFairRandom(0.4, rng)

		fr.Try() // 0.4 -> 0.8 (fail: 1.0 > 0.4)
		fr.Try() // 0.8 -> 1.0 (fail: 1.0 > 0.8, caps at 1.0)
		fr.Try() // 1.0 -> 1.0 (fail: 1.0 > 1.0 is false, so succeeds and resets)

		// After 3 tries with 1.0, third try succeeds (1.0 < 1.0 is false, but == counts as success)
		// Actually 1.0 >= 1.0, so it fails. Let me reconsider.
		// fr.rng.Float64() < fr.currentChance means 1.0 < 1.0 = false, so fail
		// After third fail: 1.0 + 0.4 = 1.4, capped to 1.0

		if fr.currentChance != 1.0 {
			t.Errorf("Expected currentChance capped at 1.0, got %f", fr.currentChance)
		}
	})
}

func TestAssignKeysAndLocks_EmptyInputs(t *testing.T) {
	t.Run("empty tree", func(t *testing.T) {
		tr := tree.Tree{}
		keys := []string{"KeyA", "KeyB"}
		cfg := DefaultConfig()
		rng := NewSeededRandom(42)

		err := AssignKeysAndLocks(&tr, keys, cfg, rng)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})

	t.Run("empty keys", func(t *testing.T) {
		tr := tree.Tree{}
		tr.Add(-1, nil) // root
		tr.Add(0, nil)  // child

		keys := []string{}
		cfg := DefaultConfig()
		rng := NewSeededRandom(42)

		err := AssignKeysAndLocks(&tr, keys, cfg, rng)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})
}

func TestAssignKeysAndLocks_RootNoLocks(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, nil) // root (index 0)
	tr.Add(0, nil)  // child (index 1)
	tr.Add(0, nil)  // child (index 2)

	keys := []string{"KeyA", "KeyB"}
	cfg := &Config{
		KeyChance:      1.0, // Always place keys
		LockChance:     1.0, // Always place locks
		MaxKeysPerLock: 2,
	}
	rng := NewSeededRandom(42)

	err := AssignKeysAndLocks(&tr, keys, cfg, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Root should never have locks
	rootLocks := GetNodeLocks(tr[0])
	if len(rootLocks) > 0 {
		t.Errorf("Root node should not have locks, got %v", rootLocks)
	}
}

func TestAssignKeysAndLocks_KeysPlacedBeforeLocks(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, nil) // root (index 0)
	tr.Add(0, nil)  // child (index 1)
	tr.Add(1, nil)  // grandchild (index 2)
	tr.Add(2, nil)  // great-grandchild (index 3)

	keys := []string{"KeyA", "KeyB", "KeyC"}
	cfg := &Config{
		KeyChance:      1.0, // Always place keys
		LockChance:     1.0, // Always place locks
		MaxKeysPerLock: 1,
	}
	rng := NewSeededRandom(42)

	err := AssignKeysAndLocks(&tr, keys, cfg, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Collect all placed keys and their positions
	keysAtPositions := make(map[int][]string)
	for i, node := range tr {
		nodeKeys := GetNodeKeys(node)
		if len(nodeKeys) > 0 {
			keysAtPositions[i] = nodeKeys
		}
	}

	// Verify locks only reference keys from earlier positions
	for i, node := range tr {
		nodeLocks := GetNodeLocks(node)
		for _, lock := range nodeLocks {
			// Find which position this key was placed
			found := false
			for pos, placedKeys := range keysAtPositions {
				for _, key := range placedKeys {
					if key == lock && pos < i {
						found = true
						break
					}
				}
				if found {
					break
				}
			}
			if !found {
				t.Errorf("Node %d has lock %s that was not placed in an earlier node", i, lock)
			}
		}
	}
}

func TestAssignKeysAndLocks_MoreKeysThanNodes(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, nil) // root (index 0)
	tr.Add(0, nil)  // child (index 1)
	tr.Add(0, nil)  // child (index 2)

	// 5 keys but only 3 nodes (2 eligible for keys, excluding last)
	keys := []string{"KeyA", "KeyB", "KeyC", "KeyD", "KeyE"}
	cfg := DefaultConfig()
	rng := NewSeededRandom(42)

	err := AssignKeysAndLocks(&tr, keys, cfg, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Count total keys placed
	totalKeys := 0
	for _, node := range tr {
		nodeKeys := GetNodeKeys(node)
		totalKeys += len(nodeKeys)
	}

	// All keys should be distributed (except possibly in last node)
	if totalKeys < len(keys)-1 {
		t.Errorf("Expected most keys to be placed, got %d out of %d", totalKeys, len(keys))
	}
}

func TestAssignKeysAndLocks_NodeKeyChanceOverride(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, nil)                                  // root (index 0)
	tr.Add(0, map[string]string{"keyChance": "1.0"}) // child with 100% key chance (index 1)
	tr.Add(0, nil)                                   // child (index 2)

	keys := []string{"KeyA"}
	cfg := &Config{
		KeyChance:      0.0, // Base chance is 0
		LockChance:     0.0,
		MaxKeysPerLock: 1,
	}
	rng := NewSeededRandom(42)

	err := AssignKeysAndLocks(&tr, keys, cfg, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Node 1 should have the key due to override
	node1Keys := GetNodeKeys(tr[1])
	if len(node1Keys) != 1 {
		t.Errorf("Node 1 with keyChance override should have 1 key, got %d", len(node1Keys))
	}
}

func TestAssignKeysAndLocks_LastNodeNoKeys(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, nil) // root (index 0)
	tr.Add(0, nil)  // child (index 1)
	tr.Add(1, nil)  // last node (index 2)

	keys := []string{"KeyA", "KeyB"}
	cfg := &Config{
		KeyChance:      1.0, // Always try to place
		LockChance:     0.0,
		MaxKeysPerLock: 1,
	}
	rng := NewSeededRandom(42)

	err := AssignKeysAndLocks(&tr, keys, cfg, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Last node should not have keys
	lastNodeKeys := GetNodeKeys(tr[len(tr)-1])
	if len(lastNodeKeys) > 0 {
		t.Errorf("Last node should not have keys, got %v", lastNodeKeys)
	}
}

func TestGetNodeKeys(t *testing.T) {
	t.Run("returns nil for nil data", func(t *testing.T) {
		node := &tree.Node{Data: nil}
		keys := GetNodeKeys(node)
		if keys != nil {
			t.Errorf("Expected nil, got %v", keys)
		}
	})

	t.Run("returns nil for missing keys", func(t *testing.T) {
		node := &tree.Node{Data: map[string]string{"other": "value"}}
		keys := GetNodeKeys(node)
		if keys != nil {
			t.Errorf("Expected nil, got %v", keys)
		}
	})

	t.Run("parses valid keys", func(t *testing.T) {
		keysJSON, _ := json.Marshal([]string{"KeyA", "KeyB"})
		node := &tree.Node{Data: map[string]string{"keys": string(keysJSON)}}
		keys := GetNodeKeys(node)
		if len(keys) != 2 || keys[0] != "KeyA" || keys[1] != "KeyB" {
			t.Errorf("Expected [KeyA, KeyB], got %v", keys)
		}
	})
}

func TestGetNodeLocks(t *testing.T) {
	t.Run("returns nil for nil data", func(t *testing.T) {
		node := &tree.Node{Data: nil}
		locks := GetNodeLocks(node)
		if locks != nil {
			t.Errorf("Expected nil, got %v", locks)
		}
	})

	t.Run("parses valid locks", func(t *testing.T) {
		locksJSON, _ := json.Marshal([]string{"KeyA"})
		node := &tree.Node{Data: map[string]string{"locks": string(locksJSON)}}
		locks := GetNodeLocks(node)
		if len(locks) != 1 || locks[0] != "KeyA" {
			t.Errorf("Expected [KeyA], got %v", locks)
		}
	})
}
