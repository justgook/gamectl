// Package main implements the worldgraph WASM plugin for GameCtl.
//
// This plugin generates a complete world graph for Metroidvania-style games.
// It creates a single tree structure containing ALL rooms across all biomes,
// with room types including:
//   - Entrance rooms (from parent biomes)
//   - Key rooms (containing abilities/items)
//   - Boss room
//   - Exit rooms (to child biomes)
//
// Input: List of biomes and keys
// Output: Single tree with all rooms
package main

import (
	"encoding/json"
	"fmt"
	"strings"

	// "github.com/extism/go-pdk"

	"github.com/justgook/gamectl/pkg/slices"
	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/wpm/pdk"
)

type Input struct {
	Biomes    []string `json:"biomes"`
	Keys      []string `json:"keys"`
	TreeID    string   `json:"treeId,omitempty"`    // Optional: ID to store in tree-storage
	StoreTree bool     `json:"storeTree,omitempty"` // Optional: whether to store in tree-storage (default: true)
}

type Output = *tree.Tree

//go:wasmimport random next
func nextRand() float32

func Rand2() float32 {
	rrr := nextRand()
	// pdk.Log(pdk.LogDebug, fmt.Sprintf("random :%f", rrr))
	return rrr
}

//export worldgraph
func WorldGraph() uint32 {
	input := pdk.Input()

	params := Input{}
	if err := json.Unmarshal(input, &params); err != nil {
		return 1
	}

	biomeTree, order := buildProgressionGraph(params.Biomes)
	keyLoc := placeKeysEvenly(order, params.Keys, Rand2)
	canLockWith := assignLocks(order, keyLoc)
	roomTree := expandBiomesToRooms(biomeTree, order, keyLoc, canLockWith)

	output, err := json.Marshal(roomTree)
	if err != nil {
		return 1
	}

	pdk.Output(output)
	return 0
}

//go:wasmexport worldgraph2
func WorldGraph2() int32 {
	params := Input{}
	if err := json.Unmarshal(pdk.Input(), &params); err != nil {
		return 1
	}

	biomeTree, order := buildProgressionGraph(params.Biomes)
	keyLoc := placeKeysEvenly(order, params.Keys, Rand2)
	canLockWith := assignLocks(order, keyLoc)

	// Build single tree with all rooms
	roomTree := expandBiomesToRooms(biomeTree, order, keyLoc, canLockWith)

	// Store in tree-storage if requested (default: true)
	storeTree := params.StoreTree
	if params.TreeID == "" && !params.StoreTree {
		// If no explicit StoreTree flag and no TreeID, default to true
		storeTree = true
	}

	if storeTree {
		treeID := params.TreeID
		if treeID == "" {
			treeID = "worldgraph" // Default ID
		}

		storeInput := map[string]any{
			"id":   treeID,
			"tree": roomTree,
		}
		storeJSON, err := json.Marshal(storeInput)
		if err == nil {
			// Call tree-storage plugin (log errors but don't fail)
			status, _, callErr := pdk.Call("tree-storage", "set", storeJSON)
			if status != 0 || callErr != nil {
				// Storage failed, but we continue since it's optional
				_ = fmt.Sprintf("Failed to store tree in tree-storage: status=%d", status)
			}
		}
	}

	output, err := json.Marshal(roomTree)
	if err != nil {
		return 1
	}
	pdk.Output(output)

	return 0
}
func buildProgressionGraph(input []string) (*tree.Tree, []string) {
	biomes := make([]string, len(input))
	copy(biomes, input)
	node, biomes := slices.PopAt(biomes, nextRand())
	entryNode := node
	world := tree.New(node)
	world.AddNode(node)
	world.Nodes[node].Name = node + "(ENTER)"
	// lastNode := world.GetRandomNode(0)
	for len(biomes) > 0 {
		lastNode := world.GetRandomNode(nextRand())
		node, biomes = slices.PopAt(biomes, nextRand())
		world.AddNode(node)
		world.AddEdge(lastNode, node, fmt.Sprintf("%s->%s", lastNode, node))
		// pdk.Log(pdk.LogInfo, fmt.Sprintf("add %s->%s", lastNode, node))
	}
	world.Nodes[node].Name = node + "(Exit)"
	order := make([]string, 0, len(input))
	world.Traverse(entryNode, func(s string) {
		order = append(order, s)
	})

	return world, order
}

// placeKeysEvenly assigns keys to nodes (biomes) using fractional probability division.
// It guarantees all keys are placed by the end.
func placeKeysEvenly(order []string, keys []string, rand func() float32) map[string][]string {
	keyLoc := make(map[string][]string)

	if len(keys) == 0 || len(order) == 0 {
		return keyLoc
	}

	keysLeft := len(keys)
	keyIndex := 0

	// Calculate the base rate: how many keys per room on average
	keysPerRoom := float64(len(keys)) / float64(len(order))

	// pdk.Log(pdk.LogDebug, fmt.Sprintf("Total keys: %d, Total rooms: %d, Keys per room: %f\n%v",
	// 	len(keys), len(order), keysPerRoom, order))

	for i, node := range order {
		if keysLeft <= 0 {
			break
		}

		roomsLeft := len(order) - i

		// Calculate how many keys to place in this room
		var placeCount int

		if keysPerRoom >= 1.0 {
			// More keys than rooms: place multiple keys per room
			base := int(keysPerRoom)
			fraction := keysPerRoom - float64(base)

			placeCount = base
			if rand() < float32(fraction) {
				placeCount++
			}
		} else {
			// Fewer keys than rooms: fractional chance per room
			// Adjust probability based on remaining keys/rooms to ensure all get placed
			probability := float64(keysLeft) / float64(roomsLeft)

			if rand() < float32(probability) {
				placeCount = 1
			} else {
				placeCount = 0
			}
		}

		// Don't place more keys than we have left
		if placeCount > keysLeft {
			placeCount = keysLeft
		}

		// Last room: place all remaining keys
		if i == len(order)-1 && keysLeft > 0 {
			placeCount = keysLeft
		}

		// pdk.Log(pdk.LogDebug, fmt.Sprintf("Room %s: placing %d keys (keysLeft: %d, roomsLeft: %d)",
		// 	node, placeCount, keysLeft, roomsLeft))

		// Assign keys
		for j := 0; j < placeCount; j++ {
			key := keys[keyIndex]
			keyLoc[node] = append(keyLoc[node], key)
			keyIndex++
			keysLeft--
		}
	}

	return keyLoc
}

func assignLocks(order []string, keyLoc map[string][]string) map[string][]string {
	canLockWith := make(map[string][]string)
	collected := map[string]bool{}

	for _, node := range order {
		canLockWith[node] = make([]string, 0, len(collected))
		for k := range collected {
			canLockWith[node] = append(canLockWith[node], k)
		}

		for _, k := range keyLoc[node] {
			collected[k] = true
		}
	}

	return canLockWith
}

// expandBiomesToRooms converts the biome tree into a complete room tree
// Simple deterministic expansion: each biome becomes ENTER → [KEYS] → BOSS → [TO-CHILDREN]
// Boss room has same branching structure as the biome had in the original tree
func expandBiomesToRooms(biomeTree *tree.Tree, order []string, keyLoc map[string][]string, canLockWith map[string][]string) *tree.Tree {
	// Start with first biome's first room as root
	firstBiome := order[0]
	firstRoom := fmt.Sprintf("%s-ENTER", firstBiome)
	roomTree := tree.New(firstRoom)

	// Track TO-CHILD rooms to connect to FROM rooms later
	toChildRooms := make(map[string]string) // "Parent-TO-Child" -> room name

	// Process each biome in order
	for _, biome := range order {
		biomeNode := biomeTree.Nodes[biome]
		isEntry := biomeNode.Parent == ""
		isExit := len(biomeNode.Children) == 0

		// 1. ENTER/FROM room
		var enterRoom string
		if isEntry {
			enterRoom = fmt.Sprintf("%s-ENTER", biome)
			// Already created as root
		} else {
			parent := biomeNode.Parent
			enterRoom = fmt.Sprintf("%s-FROM-%s", biome, parent)
			roomTree.AddNode(enterRoom)

			// Connect from parent's TO-CHILD room with locks
			toChildKey := fmt.Sprintf("%s-TO-%s", parent, biome)
			if toChildRoom, ok := toChildRooms[toChildKey]; ok {
				lockStr := strings.Join(canLockWith[biome], ",")
				roomTree.AddEdge(toChildRoom, enterRoom, lockStr)
			}
		}

		lastRoom := enterRoom

		// 2. KEY rooms (linear sequence)
		for _, key := range keyLoc[biome] {
			keyRoom := fmt.Sprintf("%s-%s", biome, key)
			roomTree.AddNode(keyRoom)
			roomTree.Nodes[keyRoom].Data = map[string]string{"key": key}

			// Connect: lastRoom → keyRoom
			roomTree.AddEdge(lastRoom, keyRoom, "")
			lastRoom = keyRoom
		}

		// 3. BOSS room
		bossRoom := fmt.Sprintf("%s-BOSS", biome)
		roomTree.AddNode(bossRoom)
		roomTree.Nodes[bossRoom].Data = map[string]string{"type": "boss"}

		// Connect: lastRoom → bossRoom
		roomTree.AddEdge(lastRoom, bossRoom, "")

		// 4. TO-CHILD or EXIT rooms (boss branches to all children, like biome tree)
		if isExit {
			exitRoom := fmt.Sprintf("%s-EXIT", biome)
			roomTree.AddNode(exitRoom)
			roomTree.Nodes[exitRoom].Data = map[string]string{"type": "exit"}

			// Connect: bossRoom → exitRoom
			roomTree.AddEdge(bossRoom, exitRoom, "")
		} else {
			// Boss room branches to multiple TO-CHILD rooms (mirroring biome tree structure)
			for _, child := range biomeNode.Children {
				toChildRoom := fmt.Sprintf("%s-TO-%s", biome, child.To)
				roomTree.AddNode(toChildRoom)

				// Connect: bossRoom → toChildRoom
				roomTree.AddEdge(bossRoom, toChildRoom, "")

				// Store for connecting to child's FROM room later
				toChildRooms[toChildRoom] = toChildRoom
			}
		}
	}

	return roomTree
}
