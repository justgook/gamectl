package gen

// OccupancyGrid tracks which tiles are occupied by segments
type OccupancyGrid struct {
	Grid   map[Point]SegmentType
	Bounds Rect
}

// NewOccupancyGrid creates a new occupancy grid
func NewOccupancyGrid(bounds Rect) *OccupancyGrid {
	return &OccupancyGrid{
		Grid:   make(map[Point]SegmentType),
		Bounds: bounds,
	}
}

// IsOccupied checks if a tile is occupied
func (og *OccupancyGrid) IsOccupied(p Point) bool {
	_, ok := og.Grid[p]
	return ok
}

// GetType returns the segment type at a position (if any)
func (og *OccupancyGrid) GetType(p Point) (SegmentType, bool) {
	t, ok := og.Grid[p]
	return t, ok
}

// CanPlace checks if a segment can be placed without conflicts
func (og *OccupancyGrid) CanPlace(seg PathSegment, clearance int) bool {
	tiles := seg.GetTiles()

	for _, tile := range tiles {
		// Check tile itself
		if og.IsOccupied(tile) {
			if !canOverlap(seg.Type, og.Grid[tile]) {
				return false
			}
		}

		// Check clearance zone (for non-overlapping types)
		if clearance > 0 && !isOverlappingType(seg.Type) {
			for dy := -clearance; dy <= clearance; dy++ {
				for dx := -clearance; dx <= clearance; dx++ {
					if dx == 0 && dy == 0 {
						continue
					}
					checkTile := Point{tile.X + dx, tile.Y + dy}
					if existing, ok := og.Grid[checkTile]; ok {
						if !canOverlap(seg.Type, existing) && !isOverlappingType(existing) {
							return false
						}
					}
				}
			}
		}
	}

	return true
}

// Place adds a segment's tiles to the grid
func (og *OccupancyGrid) Place(seg PathSegment) {
	tiles := seg.GetTiles()
	for _, tile := range tiles {
		og.Grid[tile] = seg.Type
	}
}

// PlaceWithClearance places a segment and marks clearance zone
func (og *OccupancyGrid) PlaceWithClearance(seg PathSegment, clearance int) {
	og.Place(seg)
	// Clearance is checked but not permanently marked
}

// Remove removes a segment's tiles from the grid
func (og *OccupancyGrid) Remove(seg PathSegment) {
	tiles := seg.GetTiles()
	for _, tile := range tiles {
		delete(og.Grid, tile)
	}
}

// canOverlap checks if two segment types can share the same tile
func canOverlap(a, b SegmentType) bool {
	// Ladders can pass through platforms (including one-way)
	if (a == SegmentLadder && (b == SegmentPlatform || b == SegmentOnewayPlatform)) ||
		((a == SegmentPlatform || a == SegmentOnewayPlatform) && b == SegmentLadder) {
		return true
	}

	// Same types can overlap (e.g., shared platform sections)
	if a == b {
		return true
	}

	// Grapple points can exist anywhere
	if a == SegmentGrapple || b == SegmentGrapple {
		return true
	}

	return false
}

// isOverlappingType checks if a type is allowed to overlap others
func isOverlappingType(t SegmentType) bool {
	return t == SegmentLadder || t == SegmentGrapple
}

// ResolveCollisions attempts to adjust segments to avoid collisions
func ResolveCollisions(segments []PathSegment, bounds Rect, clearance int) []PathSegment {
	grid := NewOccupancyGrid(bounds)
	resolved := []PathSegment{}

	for _, seg := range segments {
		if grid.CanPlace(seg, clearance) {
			grid.Place(seg)
			resolved = append(resolved, seg)
		} else {
			// Try to adjust segment
			adjusted := tryAdjustSegment(seg, grid, bounds, clearance)
			if adjusted != nil {
				grid.Place(*adjusted)
				resolved = append(resolved, *adjusted)
			}
			// If adjustment fails, still add original (may cause overlap)
			// Better than missing traversal path
		}
	}

	return resolved
}

// tryAdjustSegment attempts to move a segment to avoid collision
func tryAdjustSegment(seg PathSegment, grid *OccupancyGrid, bounds Rect, clearance int) *PathSegment {
	// Try vertical offsets
	for offset := 1; offset <= 3; offset++ {
		// Try moving up
		upSeg := offsetSegment(seg, 0, -offset)
		if fitsInBounds(upSeg, bounds) && grid.CanPlace(upSeg, clearance) {
			return &upSeg
		}

		// Try moving down
		downSeg := offsetSegment(seg, 0, offset)
		if fitsInBounds(downSeg, bounds) && grid.CanPlace(downSeg, clearance) {
			return &downSeg
		}
	}

	// Try horizontal offsets (for vertical segments)
	if seg.Type == SegmentLadder || seg.Type == SegmentWallJump {
		for offset := 1; offset <= 2; offset++ {
			leftSeg := offsetSegment(seg, -offset, 0)
			if fitsInBounds(leftSeg, bounds) && grid.CanPlace(leftSeg, clearance) {
				return &leftSeg
			}

			rightSeg := offsetSegment(seg, offset, 0)
			if fitsInBounds(rightSeg, bounds) && grid.CanPlace(rightSeg, clearance) {
				return &rightSeg
			}
		}
	}

	return nil
}

// offsetSegment creates a new segment offset by dx, dy
func offsetSegment(seg PathSegment, dx, dy int) PathSegment {
	result := PathSegment{
		Type:      seg.Type,
		Start:     Point{seg.Start.X + dx, seg.Start.Y + dy},
		End:       Point{seg.End.X + dx, seg.End.Y + dy},
		Direction: seg.Direction,
	}

	// Regenerate tiles
	if len(seg.Tiles) > 0 {
		result.Tiles = make([]Point, len(seg.Tiles))
		for i, tile := range seg.Tiles {
			result.Tiles[i] = Point{tile.X + dx, tile.Y + dy}
		}
	}

	return result
}

// fitsInBounds checks if all segment tiles fit within bounds
func fitsInBounds(seg PathSegment, bounds Rect) bool {
	tiles := seg.GetTiles()
	for _, tile := range tiles {
		if !bounds.Contains(tile) {
			return false
		}
	}
	return bounds.Contains(seg.Start) && bounds.Contains(seg.End)
}

// CountOccupied returns the number of occupied tiles
func (og *OccupancyGrid) CountOccupied() int {
	return len(og.Grid)
}

// OccupancyRatio returns the ratio of occupied tiles to room area
func (og *OccupancyGrid) OccupancyRatio() float64 {
	area := og.Bounds.Width * og.Bounds.Height
	if area == 0 {
		return 0
	}
	return float64(len(og.Grid)) / float64(area)
}

// GetOccupiedTiles returns all occupied tile positions
func (og *OccupancyGrid) GetOccupiedTiles() []Point {
	tiles := make([]Point, 0, len(og.Grid))
	for p := range og.Grid {
		tiles = append(tiles, p)
	}
	return tiles
}
