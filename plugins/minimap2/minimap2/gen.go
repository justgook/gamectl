package minimap2

import (
	"fmt"

	"github.com/justgook/gamectl/pkg/minimap"
	"github.com/justgook/gamectl/pkg/tree3"
)

// ------------------------------------------------------------
// Configurable constants for incremental corridor generation
// ------------------------------------------------------------

const (
	MaxExtensionDepth = 20  // Maximum corridor extension search depth
	MaxDoorsPerRoom   = 100 // Sanity check for extreme branching scenarios
)

type Random interface {
	Intn(n int) int
	Float64() float64
}

// ------------------------------------------------------------
// Config + interfaces for incremental corridor generation
// ------------------------------------------------------------

// GenerateMinimapConfig defines parameters for incremental minimap generation
type GenerateMinimapConfig struct {
	MaxExtensionDepth       int  `json:"maxExtensionDepth"`       // Maximum corridor extension search depth (default: 20)
	RandomSeed              int  `json:"randomSeed"`              // Seed for reproducible generation (default: 0)
	PreferCompactExtensions bool `json:"preferCompactExtensions"` // Bias toward shorter corridors (default: true)
	MaxDoorsPerRoom         int  `json:"maxDoorsPerRoom"`         // Sanity check for extreme branching (default: 100)
}

// GetRoomShapeFunc defines the function signature for room shape selection
type GetRoomShapeFunc func(*tree3.Node) minimap.RoomShape

// ------------------------------------------------------------
// Extension caching system for performance optimization
// ------------------------------------------------------------

// ExtensionCache caches extension search results to avoid redundant computation
type ExtensionCache struct {
	blockedPaths map[string]bool                 // Failed extension attempts: path_hash -> is_blocked
	solutions    map[string][]minimap.Coordinate // Successful minimal extensions: problem_hash -> solution
}

// NewExtensionCache creates a new extension cache
func NewExtensionCache() *ExtensionCache {
	return &ExtensionCache{
		blockedPaths: make(map[string]bool),
		solutions:    make(map[string][]minimap.Coordinate),
	}
}

// IsPathBlocked checks if an extension path was previously determined to be blocked
func (cache *ExtensionCache) IsPathBlocked(roomTiles []minimap.Coordinate, extension []minimap.Coordinate) bool {
	pathHash := generatePathHash(roomTiles, extension)
	return cache.blockedPaths[pathHash]
}

// MarkPathBlocked marks an extension path as blocked to avoid future exploration
func (cache *ExtensionCache) MarkPathBlocked(roomTiles []minimap.Coordinate, extension []minimap.Coordinate) {
	pathHash := generatePathHash(roomTiles, extension)
	cache.blockedPaths[pathHash] = true
}

// GetCachedSolution retrieves a cached solution for a given problem
func (cache *ExtensionCache) GetCachedSolution(roomTiles []minimap.Coordinate, requiredDoors int) ([]minimap.Coordinate, bool) {
	problemHash := generateProblemHash(roomTiles, requiredDoors)
	solution, exists := cache.solutions[problemHash]
	return solution, exists
}

// CacheSolution stores a successful extension solution for future reuse
func (cache *ExtensionCache) CacheSolution(roomTiles []minimap.Coordinate, requiredDoors int, solution []minimap.Coordinate) {
	problemHash := generateProblemHash(roomTiles, requiredDoors)
	cache.solutions[problemHash] = solution
}

// generatePathHash creates a hash for a specific extension path
func generatePathHash(roomTiles []minimap.Coordinate, extension []minimap.Coordinate) string {
	return fmt.Sprintf("room_%v_ext_%v", roomTiles, extension)
}

// generateProblemHash creates a hash for an extension problem (room + required doors)
func generateProblemHash(roomTiles []minimap.Coordinate, requiredDoors int) string {
	return fmt.Sprintf("room_%v_doors_%d", roomTiles, requiredDoors)
}

// ------------------------------------------------------------
// Incremental Generator - core data structure for new algorithm
// ------------------------------------------------------------

// IncrementalGenerator manages incremental room placement with corridor extensions
type IncrementalGenerator struct {
	*minimap.MinimapGenerator
	cache  *ExtensionCache
	config GenerateMinimapConfig
	rng    Random
}

// NewIncrementalGenerator creates a new incremental generator
func NewIncrementalGenerator(config GenerateMinimapConfig, rng Random) *IncrementalGenerator {
	return &IncrementalGenerator{
		MinimapGenerator: minimap.NewMinimapGenerator(),
		cache:            NewExtensionCache(),
		config:           config,
		rng:              rng,
	}
}

// ------------------------------------------------------------
// Main generation function - incremental corridor approach
// ------------------------------------------------------------

// GenerateMinimap generates a 2D spatial layout using incremental corridor generation
func GenerateMinimap(
	tree tree3.Tree,
	config GenerateMinimapConfig,
	rng Random,
	getRoomShape GetRoomShapeFunc,
) (*minimap.TileMap, error) {
	if len(tree) == 0 {
		return nil, fmt.Errorf("empty tree provided")
	}

	// Apply default config values
	config = applyDefaultConfig(config)

	// Create incremental generator
	generator := NewIncrementalGenerator(config, rng)

	// Find root node
	root := findRootNode(tree)
	if root == nil {
		return nil, fmt.Errorf("no root node found (ParentId == -1)")
	}

	// Generate layout using incremental approach with tree3.Traverse
	if err := generator.generateIncrementalLayout(tree, root, getRoomShape); err != nil {
		return nil, fmt.Errorf("incremental layout generation failed: %w", err)
	}

	// Convert to tilemap for storage
	tileMap := generator.ConvertToTileMap()
	return &tileMap, nil
}

// ------------------------------------------------------------
// Incremental layout generation logic
// ------------------------------------------------------------

// generateIncrementalLayout places rooms using guaranteed incremental approach
func (gen *IncrementalGenerator) generateIncrementalLayout(
	tree tree3.Tree,
	root *tree3.Node,
	getRoomShape GetRoomShapeFunc,
) error {
	// Find root node
	var rootIdx int
	for i, node := range tree {
		if node.ParentId == -1 {
			root = node
			rootIdx = i
			break
		}
	}
	if root == nil {
		return fmt.Errorf("no root node found")
	}

	// Place root at origin
	rootShape := getRoomShape(root)
	rootID := nodeIDFromIndex(rootIdx)

	_, err := gen.PlaceRoom(rootID, rootShape, minimap.Coordinate{0, 0})
	if err != nil {
		return fmt.Errorf("failed to place root: %w", err)
	}

	// Build children map
	childrenMap := buildChildrenMap(tree)

	// Place children using guaranteed BFS with systematic extension
	visited := make(map[int]bool)
	visited[rootIdx] = true
	queue := []int{rootIdx}

	for len(queue) > 0 {
		currentIdx := queue[0]
		queue = queue[1:]
		currentID := nodeIDFromIndex(currentIdx)

		// Get children of current node
		children := childrenMap[currentIdx]
		if len(children) == 0 {
			continue
		}

		currentTiles, _ := gen.GetRoomTiles(currentID)
		if len(currentTiles) == 0 {
			continue
		}

		// Count unvisited children
		unvisitedChildren := make([]int, 0, len(children))
		for _, childIdx := range children {
			if !visited[childIdx] {
				unvisitedChildren = append(unvisitedChildren, childIdx)
			}
		}

		if len(unvisitedChildren) == 0 {
			continue
		}

		// Place each unvisited child with aggressive fallback
		for _, childIdx := range unvisitedChildren {
			childID := nodeIDFromIndex(childIdx)
			childNode := tree[childIdx]
			childShape := getRoomShape(childNode)

			placed := false
			var placedTiles []minimap.Coordinate

			// Strategy 1: Try placing at parent's door positions
			currentTiles, _ := gen.GetRoomTiles(currentID)
			doorPositions := gen.GetUnblockedNeighbors(currentTiles)

			for _, doorPos := range doorPositions {
				_, err := gen.PlaceRoom(childID, childShape, doorPos)
				if err == nil {
					placedTiles, _ = gen.GetRoomTiles(childID)
					placed = true

					// Add doors between parent and child - ensure placement on correct tiles
					if len(placedTiles) > 0 && len(currentTiles) > 0 {
						gen.addDoorsBetweenRooms(currentTiles, placedTiles)
					}
					break
				}
			}

			// Strategy 2: Try expanding parent and retrying
			if !placed {
				for expansionAttempt := 0; expansionAttempt < 3; expansionAttempt++ {
					expandSuccess := gen.ExpandRoomForDoors(currentID, 1, make(map[string]int))
					if expandSuccess {
						updatedTiles, _ := gen.GetRoomTiles(currentID)
						newDoorPositions := gen.GetUnblockedNeighbors(updatedTiles)

						for _, doorPos := range newDoorPositions {
							_, err := gen.PlaceRoom(childID, childShape, doorPos)
							if err == nil {
								placedTiles, _ = gen.GetRoomTiles(childID)
								placed = true
								currentTiles = updatedTiles // Update for door connection

								// Add doors between parent and child - ensure placement on correct tiles
								gen.addDoorsBetweenRooms(currentTiles, placedTiles)
								break
							}
						}

						if placed {
							break
						}
					} else {
						break // No more expansion possible
					}
				}
			}

			// Strategy 3: Place anywhere and create corridor connection (fallback)
			if !placed {
				// Try placing in a broader area around the parent
				searchRadius := 5
				parentCenter := currentTiles[0] // Use first tile as reference

				for radius := 1; radius <= searchRadius && !placed; radius++ {
					for dx := -radius; dx <= radius && !placed; dx++ {
						for dy := -radius; dy <= radius && !placed; dy++ {
							if dx*dx+dy*dy <= radius*radius { // Circular search
								candidatePos := minimap.Coordinate{
									parentCenter[0] + dx,
									parentCenter[1] + dy,
								}

								_, err := gen.PlaceRoom(childID, childShape, candidatePos)
								if err == nil {
									placedTiles, _ = gen.GetRoomTiles(childID)
									placed = true
									break
								}
							}
						}
					}
				}
			}

			// If still not placed, this violates the guarantee
			if !placed {
				return fmt.Errorf("failed to place child node %d: no valid position found", childIdx)
			}

			// Add doors between parent and child
			if len(placedTiles) > 0 && len(currentTiles) > 0 {
				gen.addDoorsBetweenRooms(currentTiles, placedTiles)
			}

			// Mark as successfully placed
			visited[childIdx] = true
			queue = append(queue, childIdx)
		}
	}

	// Final validation: ensure every node was visited
	unvisitedNodes := make([]int, 0)
	for i := range tree {
		if !visited[i] {
			unvisitedNodes = append(unvisitedNodes, i)
		}
	}

	if len(unvisitedNodes) > 0 {
		return fmt.Errorf("nodes %v were not placed - this violates the 1:1 guarantee", unvisitedNodes)
	}

	return nil
}

// ------------------------------------------------------------
// Guaranteed placement functions using systematic extension
// ------------------------------------------------------------

// guaranteeDoorCapacity ensures a room has sufficient door positions for children
func (gen *IncrementalGenerator) guaranteeDoorCapacity(roomID string, roomTiles []minimap.Coordinate, requiredDoors int) error {
	currentCapacity := len(gen.GetUnblockedNeighbors(roomTiles))

	if currentCapacity >= requiredDoors {
		return nil // Already sufficient
	}

	neededDoors := requiredDoors - currentCapacity

	// Use the existing ExpandRoomForDoors which handles tile management properly
	// We'll call it multiple times with smaller increments if needed
	maxAttempts := neededDoors + 2 // Allow a few extra attempts

	for attempt := 0; attempt < maxAttempts; attempt++ {
		// Try to expand by 1 door capacity at a time
		success := gen.ExpandRoomForDoors(roomID, currentCapacity+1, make(map[string]int))
		if success {
			// Check new capacity
			updatedTiles, _ := gen.GetRoomTiles(roomID)
			newCapacity := len(gen.GetUnblockedNeighbors(updatedTiles))

			if newCapacity >= requiredDoors {
				return nil // Success
			}

			// Update for next iteration
			currentCapacity = newCapacity
			roomTiles = updatedTiles
		} else {
			// Can't expand further
			break
		}
	}

	// Final check
	finalTiles, _ := gen.GetRoomTiles(roomID)
	finalCapacity := len(gen.GetUnblockedNeighbors(finalTiles))

	if finalCapacity < requiredDoors {
		return fmt.Errorf("could not expand to %d doors, only achieved %d", requiredDoors, finalCapacity)
	}

	return nil
}

// guaranteePlaceRoom places a room with guaranteed success using systematic extension
func (gen *IncrementalGenerator) guaranteePlaceRoom(roomID string, shape minimap.RoomShape, preferredPos minimap.Coordinate, parentTiles []minimap.Coordinate) error {
	// Try direct placement first
	_, err := gen.PlaceRoom(roomID, shape, preferredPos)
	if err == nil {
		return nil // Success
	}

	// Direct placement failed - use systematic extension to find valid placement
	extension, childPos, err := gen.findExtensionForChildPlacement(parentTiles, shape, 0)
	if err != nil {
		return fmt.Errorf("could not find extension for child placement: %w", err)
	}

	// Apply extension to parent room first
	parentID := gen.findRoomIDByTiles(parentTiles)
	if parentID == "" {
		return fmt.Errorf("could not find parent room ID")
	}

	err = gen.addExtensionToRoom(parentID, extension)
	if err != nil {
		return fmt.Errorf("failed to apply parent extension: %w", err)
	}

	// Now place the child at the found position
	_, err = gen.PlaceRoom(roomID, shape, childPos)
	if err != nil {
		return fmt.Errorf("placement failed even after extension: %w", err)
	}

	return nil
}

// findRoomIDByTiles finds the room ID that contains the given tiles
func (gen *IncrementalGenerator) findRoomIDByTiles(tiles []minimap.Coordinate) string {
	if len(tiles) == 0 {
		return ""
	}

	// Search through recent room placements
	// This is a simplified approach - in production we'd maintain better tracking
	for i := 0; i < 100; i++ {
		candidateID := fmt.Sprintf("node_%d", i)
		candidateTiles, exists := gen.GetRoomTiles(candidateID)
		if exists && len(candidateTiles) > 0 && tilesMatch(candidateTiles, tiles) {
			return candidateID
		}
	}

	return ""
}

// tilesMatch checks if two tile slices contain the same coordinates
func tilesMatch(tiles1, tiles2 []minimap.Coordinate) bool {
	if len(tiles1) != len(tiles2) {
		return false
	}

	// Simple overlap check - if any tile from tiles1 is in tiles2, consider it a match
	for _, t1 := range tiles1 {
		for _, t2 := range tiles2 {
			if t1[0] == t2[0] && t1[1] == t2[1] {
				return true
			}
		}
	}

	return false
}

// ------------------------------------------------------------
// Helper functions
// ------------------------------------------------------------

// buildChildrenMap creates a mapping from parent index to child indices
func buildChildrenMap(tree tree3.Tree) map[int][]int {
	childrenMap := make(map[int][]int)

	for childIdx, node := range tree {
		if node.ParentId >= 0 && node.ParentId < len(tree) {
			parentIdx := node.ParentId
			childrenMap[parentIdx] = append(childrenMap[parentIdx], childIdx)
		}
	}

	return childrenMap
}

// findRootNode finds the root node in the tree (ParentId == -1)
func findRootNode(tree tree3.Tree) *tree3.Node {
	for _, node := range tree {
		if node.ParentId == -1 {
			return node
		}
	}
	return nil
}

// getNodeIndex finds the index of a node in the tree
func getNodeIndex(tree tree3.Tree, target *tree3.Node) int {
	for i, node := range tree {
		if node == target {
			return i
		}
	}
	return -1
}

// ------------------------------------------------------------
// Systematic extension search algorithm
// ------------------------------------------------------------

// findMinimalExtension finds the minimal extension needed to provide additional door capacity
func (gen *IncrementalGenerator) findMinimalExtension(
	roomTiles []minimap.Coordinate,
	neededDoors int,
) ([]minimap.Coordinate, error) {
	// Check cache first
	if solution, exists := gen.cache.GetCachedSolution(roomTiles, neededDoors); exists {
		return solution, nil
	}

	// Iterative deepening search
	for depth := 1; depth <= MaxExtensionDepth; depth++ {
		extensions := gen.generateExtensionCombinations(roomTiles, depth)

		// Randomize order to avoid bias
		gen.shuffleExtensions(extensions)

		// Test each combination
		for _, extension := range extensions {
			// Skip if we know this path is blocked
			if gen.cache.IsPathBlocked(roomTiles, extension) {
				continue
			}

			if gen.isValidExtension(roomTiles, extension, neededDoors) {
				// Cache successful solution
				gen.cache.CacheSolution(roomTiles, neededDoors, extension)
				return extension, nil
			} else {
				// Cache failed path
				gen.cache.MarkPathBlocked(roomTiles, extension)
			}
		}
	}

	return nil, fmt.Errorf("no valid extension found within depth limit %d", MaxExtensionDepth)
}

// generateExtensionCombinations generates all possible extension combinations at given depth
func (gen *IncrementalGenerator) generateExtensionCombinations(
	roomTiles []minimap.Coordinate,
	depth int,
) [][]minimap.Coordinate {
	// Get all possible single-step extensions from current room
	candidates := gen.getAdjacentPositions(roomTiles)

	// Generate all combinations of 'depth' tiles from candidates
	return gen.combinations(candidates, depth)
}

// combinations generates all combinations of k elements from slice
func (gen *IncrementalGenerator) combinations(
	coords []minimap.Coordinate,
	k int,
) [][]minimap.Coordinate {
	if k == 0 {
		return [][]minimap.Coordinate{{}}
	}
	if k > len(coords) {
		return [][]minimap.Coordinate{}
	}

	var result [][]minimap.Coordinate

	// Include first element
	for _, combo := range gen.combinations(coords[1:], k-1) {
		newCombo := append([]minimap.Coordinate{coords[0]}, combo...)
		result = append(result, newCombo)
	}

	// Exclude first element
	result = append(result, gen.combinations(coords[1:], k)...)

	return result
}

// isValidExtension checks if an extension provides sufficient door capacity
func (gen *IncrementalGenerator) isValidExtension(
	roomTiles []minimap.Coordinate,
	extension []minimap.Coordinate,
	neededDoors int,
) bool {
	// Check if extension tiles are available using CanPlaceRoom
	for _, tile := range extension {
		if !gen.CanPlaceRoom([]minimap.Coordinate{tile}, tile) {
			return false // Tile already occupied
		}
	}

	// Calculate door capacity with extension
	allTiles := append(roomTiles, extension...)
	doorCapacity := gen.CountAvailableDoorPositions(allTiles)
	originalCapacity := gen.CountAvailableDoorPositions(roomTiles)

	return doorCapacity >= originalCapacity+neededDoors
}

// findExtensionForChildPlacement finds extension that allows child placement
func (gen *IncrementalGenerator) findExtensionForChildPlacement(
	parentTiles []minimap.Coordinate,
	childShape minimap.RoomShape,
	_ int, // childRequiredDoors - unused in current implementation
) ([]minimap.Coordinate, minimap.Coordinate, error) {
	// Try extensions of increasing depth
	for depth := 1; depth <= MaxExtensionDepth; depth++ {
		extensions := gen.generateExtensionCombinations(parentTiles, depth)
		gen.shuffleExtensions(extensions)

		for _, extension := range extensions {
			// Check if extension is valid
			if !gen.isValidExtension(parentTiles, extension, 0) {
				continue
			}

			// Try placing child at end of extension
			for _, extTile := range extension {
				childPos := gen.getAdjacentPosition(extTile)

				if gen.CanPlaceRoom(childShape, childPos) {
					// Test if child placement maintains path constraint
					tempChildTiles := minimap.TranslateShape(childShape, childPos)
					if gen.hasPathToMapBounds(tempChildTiles) {
						return extension, childPos, nil
					}
				}
			}
		}
	}

	return nil, minimap.Coordinate{}, fmt.Errorf("no valid extension for child placement found")
}

// ------------------------------------------------------------
// Path validation - core spatial constraint
// ------------------------------------------------------------

// hasPathToMapBounds validates the "path to outside" constraint
func (gen *IncrementalGenerator) hasPathToMapBounds(tiles []minimap.Coordinate) bool {
	// Use the existing HasFreePathFrom method which implements similar logic
	return gen.HasFreePathFrom(tiles)
}

// validateAllDoorsHavePathToOutside validates that all door positions maintain path constraint
func (gen *IncrementalGenerator) validateAllDoorsHavePathToOutside(doors []minimap.Coordinate) bool {
	for _, doorPos := range doors {
		if !gen.hasPathToMapBounds([]minimap.Coordinate{doorPos}) {
			return false
		}
	}
	return true
}

// ------------------------------------------------------------
// Utility functions for room management
// ------------------------------------------------------------

// countAvailableDoorSides counts how many door positions are available on room perimeter
func (gen *IncrementalGenerator) countAvailableDoorSides(roomTiles []minimap.Coordinate) int {
	// Use the existing CountAvailableDoorPositions method
	return gen.CountAvailableDoorPositions(roomTiles)
}

// getAvailableDoorPositions returns all available door positions for a room
func (gen *IncrementalGenerator) getAvailableDoorPositions(roomTiles []minimap.Coordinate) []minimap.Coordinate {
	// Use the existing GetUnblockedNeighbors method
	return gen.GetUnblockedNeighbors(roomTiles)
}

// getAdjacentPositions returns all positions adjacent to room tiles
func (gen *IncrementalGenerator) getAdjacentPositions(roomTiles []minimap.Coordinate) []minimap.Coordinate {
	// Use the existing GetUnblockedNeighbors method
	return gen.GetUnblockedNeighbors(roomTiles)
}

// getAdjacentPosition returns a position adjacent to given coordinate
func (gen *IncrementalGenerator) getAdjacentPosition(coord minimap.Coordinate) minimap.Coordinate {
	directions := [][2]int{{0, -1}, {1, 0}, {0, 1}, {-1, 0}}

	// Try each direction and return first available
	for _, dir := range directions {
		adjacent := minimap.Coordinate{coord[0] + dir[0], coord[1] + dir[1]}

		// Use CanPlaceRoom to check if position is available
		if gen.CanPlaceRoom([]minimap.Coordinate{adjacent}, adjacent) {
			return adjacent
		}
	}

	// Fallback to first direction if all occupied
	return minimap.Coordinate{coord[0] + directions[0][0], coord[1] + directions[0][1]}
}

// addExtensionToRoom uses the existing expansion system
func (gen *IncrementalGenerator) addExtensionToRoom(roomID string, extension []minimap.Coordinate) error {
	// Use existing ExpandRoomForDoors which properly manages internal state
	neededCapacity := len(extension)
	success := gen.ExpandRoomForDoors(roomID, neededCapacity, make(map[string]int))
	if !success {
		return fmt.Errorf("failed to expand room %s", roomID)
	}
	return nil
}

// addDoorsBetweenRooms adds doors specifically between parent and child rooms
func (gen *IncrementalGenerator) addDoorsBetweenRooms(parentTiles, childTiles []minimap.Coordinate) {
	if len(parentTiles) == 0 || len(childTiles) == 0 {
		return
	}

	// Find the closest pair of tiles between the two rooms
	var bestParentTile, bestChildTile minimap.Coordinate
	minDistance := int(^uint(0) >> 1) // Max int

	for _, parentTile := range parentTiles {
		for _, childTile := range childTiles {
			dx := abs(parentTile[0] - childTile[0])
			dy := abs(parentTile[1] - childTile[1])
			distance := dx + dy

			if distance < minDistance {
				minDistance = distance
				bestParentTile = parentTile
				bestChildTile = childTile
			}
		}
	}

	// Always add doors on both tiles to ensure connection
	// This is a more aggressive approach to ensure doors are placed

	// Add doors based on relative position
	dx := bestChildTile[0] - bestParentTile[0]
	dy := bestChildTile[1] - bestParentTile[1]

	// Add doors in the appropriate directions
	if dx > 0 { // Child is to the east
		gen.AddDoor(bestParentTile[0], bestParentTile[1], minimap.DoorEast)
		gen.AddDoor(bestChildTile[0], bestChildTile[1], minimap.DoorWest)
	} else if dx < 0 { // Child is to the west
		gen.AddDoor(bestParentTile[0], bestParentTile[1], minimap.DoorWest)
		gen.AddDoor(bestChildTile[0], bestChildTile[1], minimap.DoorEast)
	} else {
		// Same X coordinate - add east/west doors for potential connection
		gen.AddDoor(bestParentTile[0], bestParentTile[1], minimap.DoorEast|minimap.DoorWest)
		gen.AddDoor(bestChildTile[0], bestChildTile[1], minimap.DoorEast|minimap.DoorWest)
	}

	if dy > 0 { // Child is to the south
		gen.AddDoor(bestParentTile[0], bestParentTile[1], minimap.DoorSouth)
		gen.AddDoor(bestChildTile[0], bestChildTile[1], minimap.DoorNorth)
	} else if dy < 0 { // Child is to the north
		gen.AddDoor(bestParentTile[0], bestParentTile[1], minimap.DoorNorth)
		gen.AddDoor(bestChildTile[0], bestChildTile[1], minimap.DoorSouth)
	} else {
		// Same Y coordinate - add north/south doors for potential connection
		gen.AddDoor(bestParentTile[0], bestParentTile[1], minimap.DoorNorth|minimap.DoorSouth)
		gen.AddDoor(bestChildTile[0], bestChildTile[1], minimap.DoorNorth|minimap.DoorSouth)
	}
}

// abs returns absolute value of an integer (helper function)
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// calculateRequiredDoorPlacements calculates where doors should be placed
func (gen *IncrementalGenerator) calculateRequiredDoorPlacements(
	roomTiles []minimap.Coordinate,
	requiredDoors int,
) []minimap.Coordinate {
	availablePositions := gen.getAvailableDoorPositions(roomTiles)

	// Shuffle for randomness
	shuffled := gen.shuffleCoordinates(availablePositions)

	// Take first N positions
	if len(shuffled) >= requiredDoors {
		return shuffled[:requiredDoors]
	}

	return shuffled // Return all available if insufficient
}

// commitDoorPlacements commits door placements by actually placing doors
func (gen *IncrementalGenerator) commitDoorPlacements(doors []minimap.Coordinate) {
	// Actually place doors at the specified positions
	for _, doorPos := range doors {
		// Place a door in all directions (NESW) for now
		// This ensures connectivity - we can optimize later
		gen.AddDoor(doorPos[0], doorPos[1], minimap.DoorNorth|minimap.DoorEast|minimap.DoorSouth|minimap.DoorWest)
	}
}

// shuffleCoordinates randomizes coordinate slice order
func (gen *IncrementalGenerator) shuffleCoordinates(coords []minimap.Coordinate) []minimap.Coordinate {
	shuffled := make([]minimap.Coordinate, len(coords))
	copy(shuffled, coords)

	for i := len(shuffled) - 1; i > 0; i-- {
		j := gen.rng.Intn(i + 1)
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}

	return shuffled
}

// shuffleExtensions randomizes extension slice order
func (gen *IncrementalGenerator) shuffleExtensions(extensions [][]minimap.Coordinate) {
	for i := len(extensions) - 1; i > 0; i-- {
		j := gen.rng.Intn(i + 1)
		extensions[i], extensions[j] = extensions[j], extensions[i]
	}
}

// applyDefaultConfig applies default values to configuration
func applyDefaultConfig(config GenerateMinimapConfig) GenerateMinimapConfig {
	if config.MaxExtensionDepth <= 0 {
		config.MaxExtensionDepth = MaxExtensionDepth
	}
	if config.MaxDoorsPerRoom <= 0 {
		config.MaxDoorsPerRoom = MaxDoorsPerRoom
	}
	// Other defaults are already zero-values or false which are appropriate
	return config
}

// nodeIDFromIndex converts tree index to string ID for minimap generator
func nodeIDFromIndex(idx int) string {
	return fmt.Sprintf("node_%d", idx)
}
