package minimap

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/tree"
)

// Stage4 reduces path lengths by moving children toward their parents
// Processes depth-by-depth, consuming path tiles progressively
// Returns updated PathInfo with reduced paths and regenerated doors
func Stage4(
	rng Random,
	treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
	grid *Grid,
	pathInfos []PathInfo,
) ([]PathInfo, error) {
	if len(*treeInput) == 0 {
		return pathInfos, nil
	}

	// Build depth map and parent-child relationships
	depthMap, childrenMap, maxDepth := buildDepthMap(treeInput)

	totalTilesRemoved := 0
	totalIterations := 0

	// Process each depth level (parents at each level)
	for depth := 0; depth < maxDepth; depth++ {
		parents := depthMap[depth]

		// Keep iterating until no child at this depth can move
		depthIterations := 0
		for {
			anyMoved := false
			movedThisIteration := 0

			// Try to move each child of each parent
			for _, parentIndex := range parents {
				children := childrenMap[parentIndex]

				for _, childIndex := range children {
					childID := childIndex + 1
					parentID := parentIndex + 1

					// Find this child's PathInfo
					pathInfoIdx := findPathInfoIndex(pathInfos, childID, parentID)
					if pathInfoIdx == -1 {
						continue // No path info found
					}

					pathInfo := &pathInfos[pathInfoIdx]

					if len(pathInfo.PathTiles) == 0 {
						continue // Already touching or no path
					}

					// Try to consume first path tile (closest to child)
					nextTile := pathInfo.PathTiles[0]

					// Check if child can consume this tile
					if canConsumePathTile(grid, childID, nextTile, parentID) {
						// Move child to consume this path tile
						moveRoomToConsumeTile(grid, childID, nextTile)

						// Remove consumed tile from path
						pathInfo.PathTiles = pathInfo.PathTiles[1:]

						// Update paths from child to its children (grandchildren)
						err := updateChildsChildrenPaths(grid, childIndex, treeInput, getRoomShape, pathInfos)
						if err != nil {
							return nil, fmt.Errorf("failed to update paths for child %d: %w", childID, err)
						}

						anyMoved = true
						movedThisIteration++
						totalTilesRemoved++
					}
				}
			}

			depthIterations++
			totalIterations++

			if !anyMoved {
				break // No child at this depth could move
			}

			// Optional: print progress for large trees
			if depthIterations%10 == 0 {
				fmt.Printf("  Depth %d, iteration %d: moved %d tiles\n", depth, depthIterations, movedThisIteration)
			}
		}

		if depthIterations > 1 {
			fmt.Printf("Depth %d completed: %d iterations\n", depth, depthIterations)
		}
	}

	fmt.Printf("Stage4 complete: removed %d path tiles in %d iterations\n", totalTilesRemoved, totalIterations)

	// Regenerate all doors based on final grid state
	regenerateAllDoors(grid, treeInput, pathInfos)

	return pathInfos, nil
}

// findPathInfoIndex finds the index of PathInfo for a given child-parent pair
func findPathInfoIndex(pathInfos []PathInfo, childID, parentID int) int {
	for i, pi := range pathInfos {
		if pi.ChildID == childID && pi.ParentID == parentID {
			return i
		}
	}
	return -1
}

// canConsumePathTile checks if a room can expand to include a path tile
// Rules:
// - Path tile must be adjacent to current room
// - Path tile must belong to this room's parent group (correct path ID)
func canConsumePathTile(grid *Grid, roomID int, pathTile Point, parentID int) bool {
	// 1. Verify path tile is adjacent to room
	if !isAdjacentToRoom(grid, roomID, pathTile) {
		return false
	}

	// 2. Get current value of pathTile
	currentID, exists := (*grid)[pathTile]
	if !exists {
		return false // Tile doesn't exist (shouldn't happen)
	}

	// 3. Determine which parent group this path should belong to
	expectedPathID := -parentID // Paths use negative parent IDs

	// 4. Check if this is the correct path to consume
	if currentID != expectedPathID {
		return false // This path belongs to different parent group
	}

	return true
}

// isAdjacentToRoom checks if a point is orthogonally adjacent to any tile of a room
func isAdjacentToRoom(grid *Grid, roomID int, point Point) bool {
	// Check 4 orthogonal neighbors of the point
	neighbors := []Point{
		{point[0] + 1, point[1]},
		{point[0] - 1, point[1]},
		{point[0], point[1] + 1},
		{point[0], point[1] - 1},
	}

	for _, n := range neighbors {
		if id, exists := (*grid)[n]; exists && id == roomID {
			return true
		}
	}

	return false
}

// moveRoomToConsumeTile expands a room to include a path tile
// The path tile changes from path ID to room ID
func moveRoomToConsumeTile(grid *Grid, roomID int, pathTile Point) {
	// Simply change the grid ID from path to room
	(*grid)[pathTile] = roomID
}

// updateChildsChildrenPaths regenerates paths from child to its children
// This is needed because the child moved and old paths may be invalid
func updateChildsChildrenPaths(
	grid *Grid,
	childNodeIndex int,
	treeInput *tree.Tree,
	getRoomShape GetRoomShapeFunc,
	pathInfos []PathInfo,
) error {
	childID := childNodeIndex + 1

	// Find all grandchildren (children of this child)
	var grandchildren []int
	for i, node := range *treeInput {
		if node.ParentId == childNodeIndex {
			grandchildren = append(grandchildren, i)
		}
	}

	if len(grandchildren) == 0 {
		return nil // Leaf node, no children to update
	}

	// For each grandchild, regenerate its path to this child
	for _, grandchildIdx := range grandchildren {
		grandchildID := grandchildIdx + 1

		// Find the PathInfo for this grandchild
		pathInfoIdx := findPathInfoIndex(pathInfos, grandchildID, childID)
		if pathInfoIdx == -1 {
			continue // No path info (shouldn't happen)
		}

		// Clear old path tiles from grid
		for _, tile := range pathInfos[pathInfoIdx].PathTiles {
			delete(*grid, tile)
		}

		// Regenerate path using Stage3 logic
		path := findPathBetweenShapes(grid, grandchildID, childID)
		if path == nil {
			return fmt.Errorf("cannot find path from grandchild %d to child %d", grandchildID, childID)
		}

		// Update PathInfo with new path
		pathInfos[pathInfoIdx].PathTiles = path

		// Commit new path to grid
		pathID := -childID
		for _, tile := range path {
			(*grid)[tile] = pathID
		}
	}

	return nil
}

// regenerateAllDoors regenerates door connections for all paths based on final grid state
func regenerateAllDoors(grid *Grid, treeInput *tree.Tree, pathInfos []PathInfo) {
	for i := range pathInfos {
		pathInfo := &pathInfos[i]

		// Get edge tiles for child and parent
		childEdges := getShapeEdgeTiles(grid, pathInfo.ChildID)
		parentEdges := getShapeEdgeTiles(grid, pathInfo.ParentID)

		// Regenerate doors
		doors := detectDoorTiles(grid, pathInfo.ChildID, pathInfo.ParentID, childEdges, parentEdges, pathInfo.PathTiles)

		// Update door list
		pathInfo.Doors = doors
	}
}
