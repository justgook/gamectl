package minimap_test

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/plugins/minimap/minimap"
)

func TestDebugEscapePathEstablishment(t *testing.T) {
	// Create a simple tree that should trigger escape path establishment
	treeInput := tree.Tree{
		&tree.Node{ParentId: -1, Data: map[string]string{"id": "0"}}, // Root
		&tree.Node{ParentId: 0, Data: map[string]string{"id": "1"}},  // Child 1 of root
		&tree.Node{ParentId: 0, Data: map[string]string{"id": "2"}},  // Child 2 of root
		&tree.Node{ParentId: 1, Data: map[string]string{"id": "3"}},  // Child 1 of node 1
		&tree.Node{ParentId: 1, Data: map[string]string{"id": "4"}},  // Child 2 of node 1
	}

	fmt.Println("Simple tree for escape path testing:")
	for i, node := range treeInput {
		fmt.Printf("Node %d: ParentId=%d\n", i, node.ParentId)
	}

	rng := rand.New(rand.NewSource(42))

	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Panic occurred: %v\n", r)
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
