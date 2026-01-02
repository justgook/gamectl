package biomes

import (
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
)

// MockRandom implements Random interface for deterministic testing
type MockRandom struct {
	values []int
	idx    int
}

func NewMockRandom(values []int) *MockRandom {
	return &MockRandom{values: values}
}

func (m *MockRandom) Intn(n int) int {
	if len(m.values) == 0 || n == 0 {
		return 0
	}
	val := m.values[m.idx%len(m.values)] % n
	m.idx++
	return val
}

// SeededRandom provides simple seeded random for testing
type SeededRandom struct {
	seed uint64
}

func NewSeededRandom(seed uint64) *SeededRandom {
	return &SeededRandom{seed: seed}
}

func (r *SeededRandom) Intn(n int) int {
	if n <= 0 {
		return 0
	}
	r.seed = r.seed*6364136223846793005 + 1442695040888963407
	return int(r.seed>>33) % n
}

func TestAssignBiomes_EmptyInputs(t *testing.T) {
	t.Run("empty tree", func(t *testing.T) {
		tr := tree.Tree{}
		biomes := []string{"Forest", "Desert", "Swamp"}
		rng := NewSeededRandom(42)

		err := AssignBiomes(&tr, biomes, rng)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})

	t.Run("empty biomes", func(t *testing.T) {
		tr := tree.Tree{}
		tr.Add(-1, nil) // root
		tr.Add(0, nil)  // child

		biomes := []string{}
		rng := NewSeededRandom(42)

		err := AssignBiomes(&tr, biomes, rng)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})
}

func TestAssignBiomes_BasicAssignment(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, nil) // root (index 0)
	tr.Add(0, nil)  // child (index 1)
	tr.Add(0, nil)  // child (index 2)

	biomes := []string{"Forest", "Desert", "Swamp"}
	rng := NewMockRandom([]int{0, 0, 0}) // Always pick first available

	err := AssignBiomes(&tr, biomes, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Check all nodes have biomes
	for i, node := range tr {
		name := GetNodeBiome(node)
		if name == "" {
			t.Errorf("Node %d has no biome assigned", i)
		}
	}
}

func TestAssignBiomes_Uniqueness(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, nil) // root (index 0)
	tr.Add(0, nil)  // child (index 1)
	tr.Add(0, nil)  // child (index 2)
	tr.Add(1, nil)  // grandchild (index 3)
	tr.Add(2, nil)  // grandchild (index 4)

	biomes := []string{"Forest", "Desert", "Swamp", "Mountain", "Ocean"}
	rng := NewSeededRandom(42)

	err := AssignBiomes(&tr, biomes, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Check all biomes are unique
	seen := make(map[string]bool)
	for i, node := range tr {
		name := GetNodeBiome(node)
		if name == "" {
			t.Errorf("Node %d has no biome assigned", i)
			continue
		}
		if seen[name] {
			t.Errorf("Biome %s assigned to multiple nodes", name)
		}
		seen[name] = true
	}
}

func TestAssignBiomes_MoreNodesThanBiomes(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, nil) // root (index 0)
	tr.Add(0, nil)  // child (index 1)
	tr.Add(0, nil)  // child (index 2)
	tr.Add(1, nil)  // grandchild (index 3)
	tr.Add(2, nil)  // grandchild (index 4)

	// Only 3 biomes for 5 nodes
	biomes := []string{"Forest", "Desert", "Swamp"}
	rng := NewSeededRandom(42)

	err := AssignBiomes(&tr, biomes, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Count assigned biomes
	assigned := 0
	for _, node := range tr {
		if GetNodeBiome(node) != "" {
			assigned++
		}
	}

	// Should have exactly 3 biomes assigned (limited by available biomes)
	if assigned != 3 {
		t.Errorf("Expected 3 biomes assigned, got %d", assigned)
	}
}

func TestAssignBiomes_PreservesExistingData(t *testing.T) {
	tr := tree.Tree{}
	tr.Add(-1, map[string]string{"existing": "data"}) // root with existing data

	biomes := []string{"Forest"}
	rng := NewMockRandom([]int{0})

	err := AssignBiomes(&tr, biomes, rng)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	// Check existing data is preserved
	if tr[0].Data["existing"] != "data" {
		t.Error("Existing data was not preserved")
	}

	// Check biome was added
	if tr[0].Data["name"] != "Forest" {
		t.Error("Biome name was not added")
	}
}

func TestGetNodeBiome(t *testing.T) {
	t.Run("returns empty for nil data", func(t *testing.T) {
		node := &tree.Node{Data: nil}
		name := GetNodeBiome(node)
		if name != "" {
			t.Errorf("Expected empty string, got %s", name)
		}
	})

	t.Run("returns empty for missing name", func(t *testing.T) {
		node := &tree.Node{Data: map[string]string{"other": "value"}}
		name := GetNodeBiome(node)
		if name != "" {
			t.Errorf("Expected empty string, got %s", name)
		}
	})

	t.Run("returns biome name", func(t *testing.T) {
		node := &tree.Node{Data: map[string]string{"name": "Forest"}}
		name := GetNodeBiome(node)
		if name != "Forest" {
			t.Errorf("Expected Forest, got %s", name)
		}
	})
}
