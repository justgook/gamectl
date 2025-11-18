package minimap_test

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap"
)

// Simple room shape generator for testing
func defaultRoomShape(*tree.Node) minimap.RoomShape {
	return minimap.RoomShape{{0, 0}} // Single tile room
}

// createLinearTree creates a simple linear chain: 0 -> 1 -> 2 -> 3 -> ...
func createLinearTree(nodes int) tree.Tree {
	result := make(tree.Tree, nodes)

	for i := 0; i < nodes; i++ {
		parentId := -1
		if i > 0 {
			parentId = i - 1 // Each node's parent is the previous node
		}

		result[i] = &tree.Node{
			ParentId: parentId,
			Data:     map[string]string{"id": fmt.Sprintf("%d", i)},
		}
	}

	return result
}

// createDeepTree creates a tree with specified depth and branching
func createDeepTree(nodes int, maxChildren int) tree.Tree {
	result := make(tree.Tree, nodes)

	// Root node
	result[0] = &tree.Node{
		ParentId: -1,
		Data:     map[string]string{"id": "0"},
	}

	if nodes == 1 {
		return result
	}

	childrenPerParent := maxChildren
	if childrenPerParent < 1 {
		childrenPerParent = 2 // Default to binary tree
	}

	// Create a more balanced approach
	parentQueue := []int{0} // Start with root as potential parent
	currentParent := 0
	childrenAdded := 0

	for i := 1; i < nodes; i++ {
		// Add child to current parent
		result[i] = &tree.Node{
			ParentId: currentParent,
			Data:     map[string]string{"id": fmt.Sprintf("%d", i)},
		}

		childrenAdded++

		// If we've added max children to current parent, move to next parent
		if childrenAdded >= childrenPerParent {
			childrenAdded = 0
			// Add this child as a potential parent for future nodes
			parentQueue = append(parentQueue, i)
			// Move to next parent in queue
			if len(parentQueue) > 1 {
				parentQueue = parentQueue[1:] // Remove current parent
				currentParent = parentQueue[0]
			} else {
				currentParent = i // Use current node as parent if no other options
			}
		}
	}

	return result
}

// createBusyTree creates a tree with many children per parent (stress test)
func createBusyTree(nodes int) tree.Tree {
	if nodes < 1 {
		nodes = 1
	}

	result := make(tree.Tree, nodes)

	// Root node
	result[0] = &tree.Node{
		ParentId: -1,
		Data:     map[string]string{"id": "0"},
	}

	// All other nodes are children of root (maximum stress for escape path logic)
	for i := 1; i < nodes; i++ {
		result[i] = &tree.Node{
			ParentId: 0,
			Data:     map[string]string{"id": fmt.Sprintf("%d", i)},
		}
	}

	return result
}

func TestGenerateMinimap_DeepTrees(t *testing.T) {
	tests := []struct {
		name        string
		treeFunc    func() tree.Tree
		shouldPanic bool
	}{
		{
			name: "linear chain (10 nodes)",
			treeFunc: func() tree.Tree {
				return createLinearTree(10)
			},
			shouldPanic: false,
		},
		{
			name: "small tree (10 nodes)",
			treeFunc: func() tree.Tree {
				return createDeepTree(10, 2)
			},
			shouldPanic: false,
		},
		{
			name: "medium tree (30 nodes)",
			treeFunc: func() tree.Tree {
				return createDeepTree(30, 2)
			},
			shouldPanic: false,
		},
		{
			name: "large tree (100 nodes)",
			treeFunc: func() tree.Tree {
				return createDeepTree(100, 2)
			},
			shouldPanic: false,
		},
		{
			name: "very large tree (200 nodes)",
			treeFunc: func() tree.Tree {
				return createDeepTree(200, 2)
			},
			shouldPanic: false,
		},
		{
			name: "busy tree (root with 20 children)",
			treeFunc: func() tree.Tree {
				return createBusyTree(21)
			},
			shouldPanic: false,
		},
		{
			name: "very busy tree (root with 50 children)",
			treeFunc: func() tree.Tree {
				return createBusyTree(51)
			},
			shouldPanic: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create deterministic RNG
			rng := rand.New(rand.NewSource(42))
			treeInput := tt.treeFunc()

			defer func() {
				if r := recover(); r != nil {
					if !tt.shouldPanic {
						t.Errorf("GenerateMinimap() panicked unexpectedly: %v", r)
					}
				}
			}()

			// This should not panic with our new path-blocking prevention
			result, err := minimap.GenerateMinimap(rng, treeInput, defaultRoomShape)

			if tt.shouldPanic {
				t.Error("Expected GenerateMinimap to panic, but it didn't")
				return
			}

			if err != nil {
				t.Errorf("GenerateMinimap() returned error: %v", err)
				return
			}

			if result == nil {
				t.Error("GenerateMinimap() returned nil result")
				return
			}

			// Verify we have at least one layer
			if len(result.Layers) == 0 {
				t.Error("GenerateMinimap() returned empty layers")
				return
			}

			// Verify the tilemap has reasonable dimensions
			layer := result.Layers[0]
			if layer.Width <= 0 {
				t.Error("GenerateMinimap() returned invalid width")
				return
			}

			if len(layer.Data) == 0 {
				t.Error("GenerateMinimap() returned empty tile data")
				return
			}

			t.Logf("Successfully generated minimap for %d nodes: %dx%d",
				len(treeInput), layer.Width, len(layer.Data)/layer.Width)
		})
	}
}

func TestGenerateMinimap_PathBlockingPrevention(t *testing.T) {
	// Test specific scenario that would previously fail:
	// Parent with multiple children that could block each other's paths

	rng := rand.New(rand.NewSource(123))

	// Create a tree that specifically tests the path-blocking scenario
	// Root -> Child1, Child2, Child3 (all siblings that could block each other)
	treeInput := tree.Tree{
		&tree.Node{ParentId: -1, Data: map[string]string{"id": "0"}}, // Root
		&tree.Node{ParentId: 0, Data: map[string]string{"id": "1"}},  // Child 1
		&tree.Node{ParentId: 0, Data: map[string]string{"id": "2"}},  // Child 2
		&tree.Node{ParentId: 0, Data: map[string]string{"id": "3"}},  // Child 3
	}

	// Run multiple times with different seeds to test various placement scenarios
	for seed := int64(1); seed <= 10; seed++ {
		rng = rand.New(rand.NewSource(seed))

		_, err := minimap.GenerateMinimap(rng, treeInput, defaultRoomShape)
		if err != nil {
			t.Errorf("Seed %d: GenerateMinimap() failed: %v", seed, err)
		}
	}
}
