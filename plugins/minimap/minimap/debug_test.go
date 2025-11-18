package minimap_test

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap"
)

func TestDebug35Nodes(t *testing.T) {
	// Test exactly 35 nodes to find the threshold
	treeInput := createDeepTree(35, 2)

	fmt.Printf("Testing 35-node tree:\n")

	rng := rand.New(rand.NewSource(42))

	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Panic at: %v\n", r)
		}
	}()

	result, err := minimap.GenerateMinimap(rng, treeInput, defaultRoomShape)
	if err != nil {
		t.Errorf("Error: %v", err)
		return
	}

	fmt.Printf("Success! Generated 35-node minimap: %dx%d\n",
		result.Layers[0].Width, len(result.Layers[0].Data)/result.Layers[0].Width)
}

func TestDebugEscapePaths(t *testing.T) {
	// Test the escape path system specifically
	treeInput := createDeepTree(25, 2) // Should work fine now

	fmt.Println("Testing escape path system with 25-node tree:")
	for i, node := range treeInput {
		fmt.Printf("Node %d: ParentId=%d\n", i, node.ParentId)
	}

	rng := rand.New(rand.NewSource(42))

	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Panic at: %v\n", r)
		}
	}()

	result, err := minimap.GenerateMinimap(rng, treeInput, defaultRoomShape)
	if err != nil {
		t.Errorf("Error: %v", err)
		return
	}

	fmt.Printf("Success! Generated minimap: %dx%d\n",
		result.Layers[0].Width, len(result.Layers[0].Data)/result.Layers[0].Width)
}

func TestDebugDeepTree(t *testing.T) {
	// Test both manual and generated trees
	t.Run("manual deep tree", func(t *testing.T) {
		// Create a simple deep tree to debug
		treeInput := tree.Tree{
			&tree.Node{ParentId: -1, Data: map[string]string{"id": "0"}}, // Root (0)
			&tree.Node{ParentId: 0, Data: map[string]string{"id": "1"}},  // Child of 0 (1)
			&tree.Node{ParentId: 1, Data: map[string]string{"id": "2"}},  // Child of 1 (2)
			&tree.Node{ParentId: 2, Data: map[string]string{"id": "3"}},  // Child of 2 (3)
			&tree.Node{ParentId: 3, Data: map[string]string{"id": "4"}},  // Child of 3 (4)
		}

		fmt.Println("Manual tree structure:")
		for i, node := range treeInput {
			fmt.Printf("Node %d: ParentId=%d\n", i, node.ParentId)
		}

		rng := rand.New(rand.NewSource(42))

		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("Manual tree panic: %v\n", r)
				t.Errorf("Manual tree failed: %v", r)
			}
		}()

		result, err := minimap.GenerateMinimap(rng, treeInput, defaultRoomShape)
		if err != nil {
			t.Errorf("Error: %v", err)
			return
		}

		fmt.Printf("Manual tree success! Generated minimap: %dx%d\n",
			result.Layers[0].Width, len(result.Layers[0].Data)/result.Layers[0].Width)
	})

	t.Run("generated deep tree", func(t *testing.T) {
		treeInput := createDeepTree(10, 2)

		fmt.Println("Generated tree structure:")
		for i, node := range treeInput {
			fmt.Printf("Node %d: ParentId=%d\n", i, node.ParentId)
		}

		rng := rand.New(rand.NewSource(42))

		defer func() {
			if r := recover(); r != nil {
				fmt.Printf("Generated tree panic: %v\n", r)
				t.Errorf("Generated tree failed: %v", r)
			}
		}()

		result, err := minimap.GenerateMinimap(rng, treeInput, defaultRoomShape)
		if err != nil {
			t.Errorf("Error: %v", err)
			return
		}

		fmt.Printf("Generated tree success! Generated minimap: %dx%d\n",
			result.Layers[0].Width, len(result.Layers[0].Data)/result.Layers[0].Width)
	})
}
