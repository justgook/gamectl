package gen

import (
	"github.com/justgook/gamectl/pkg/tilemap"
)

// RenderToTilemap converts all segments to a tile layer
func RenderToTilemap(segments []PathSegment, bounds Rect, tileIDs TileIDConfig) *tilemap.TileLayer {
	layer := tilemap.NewTileLayer(bounds.Width, bounds.Height)
	layer.Props = map[string]string{
		"name": "geometry",
		"type": "traversal",
	}

	for _, seg := range segments {
		tiles := seg.GetTiles()
		tileID := getTileIDForSegment(seg, tileIDs)

		for _, tile := range tiles {
			// Convert to local coordinates (relative to room bounds)
			localX := tile.X - bounds.X
			localY := tile.Y - bounds.Y

			// Bounds check
			if localX < 0 || localX >= bounds.Width || localY < 0 || localY >= bounds.Height {
				continue
			}

			idx := localY*bounds.Width + localX
			if idx >= 0 && idx < len(layer.Data) {
				// Use OR to allow overlapping (e.g., ladder on platform)
				if layer.Data[idx] == 0 {
					layer.Data[idx] = tileID
				} else {
					// Handle overlapping segments by keeping the more important one
					existingType := tileIDToSegmentType(layer.Data[idx], tileIDs)
					if shouldOverwrite(seg.Type, existingType) {
						layer.Data[idx] = tileID
					}
				}
			}
		}
	}

	return layer
}

// getTileIDForSegment returns the tile ID for a segment
func getTileIDForSegment(seg PathSegment, tileIDs TileIDConfig) uint32 {
	switch seg.Type {
	case SegmentPlatform:
		return tileIDs.Platform
	case SegmentOnewayPlatform:
		return tileIDs.OnewayPlatform
	case SegmentLadder:
		return tileIDs.Ladder
	case SegmentWallJump:
		if seg.Direction == DirWest {
			return tileIDs.WallJumpLeft
		}
		return tileIDs.WallJumpRight
	case SegmentGrapple:
		return tileIDs.GrapplePoint
	default:
		return 0 // Jumps/drops don't produce tiles
	}
}

// tileIDToSegmentType converts a tile ID back to segment type (for conflict resolution)
func tileIDToSegmentType(id uint32, tileIDs TileIDConfig) SegmentType {
	switch id {
	case tileIDs.Platform:
		return SegmentPlatform
	case tileIDs.OnewayPlatform:
		return SegmentOnewayPlatform
	case tileIDs.Ladder:
		return SegmentLadder
	case tileIDs.WallJumpLeft, tileIDs.WallJumpRight:
		return SegmentWallJump
	case tileIDs.GrapplePoint:
		return SegmentGrapple
	default:
		return SegmentPlatform
	}
}

// shouldOverwrite determines if new segment type should overwrite existing
func shouldOverwrite(newType, existingType SegmentType) bool {
	// Priority: Platform < OnewayPlatform < Ladder < WallJump < Grapple
	priority := map[SegmentType]int{
		SegmentPlatform:       1,
		SegmentOnewayPlatform: 2,
		SegmentLadder:         3,
		SegmentWallJump:       4,
		SegmentGrapple:        5,
	}

	return priority[newType] > priority[existingType]
}

// RenderRoomToTilemap generates traversal geometry for a single room
func RenderRoomToTilemap(room *RoomInfo, abilities PlayerAbilities, variety VarietyConfig, tileIDs TileIDConfig, rng Random) *tilemap.TileLayer {
	// Create navigation graph
	graph := CreateNavigationGraph(room, rng, variety)

	if graph == nil || len(graph.Nodes) == 0 {
		// No exits - return empty layer
		return tilemap.NewTileLayer(room.Bounds.Width, room.Bounds.Height)
	}

	// Generate segments for each edge
	GenerateSegments(graph, abilities, room.Bounds)

	// Collect all segments
	allSegments := []PathSegment{}
	for _, edge := range graph.Edges {
		allSegments = append(allSegments, edge.Segments...)
	}

	// Apply variety
	allSegments = AddVariety(allSegments, rng, variety, room.Bounds)

	// Fit segments within bounds
	margin := 0 // No margin for now
	allSegments = FitSegmentsInBounds(allSegments, room.Bounds, margin)

	// Resolve collisions
	clearance := 0 // No clearance for now
	allSegments = ResolveCollisions(allSegments, room.Bounds, clearance)

	// Render to tilemap
	return RenderToTilemap(allSegments, room.Bounds, tileIDs)
}

// RenderAllRoomsToTilemap generates traversal geometry for all rooms in a tilemap
func RenderAllRoomsToTilemap(tm *tilemap.TileMap, abilities PlayerAbilities, variety VarietyConfig, tileIDs TileIDConfig, rng Random) (*tilemap.TileLayer, error) {
	// Extract rooms from tilemap
	rooms, err := ExtractRooms(tm)
	if err != nil {
		return nil, err
	}

	if len(rooms) == 0 {
		// No rooms found
		return tilemap.NewTileLayer(1, 1), nil
	}

	// Find global bounds
	var globalMinX, globalMinY, globalMaxX, globalMaxY int
	first := true
	for _, room := range rooms {
		if first {
			globalMinX = room.Bounds.X
			globalMinY = room.Bounds.Y
			globalMaxX = room.Bounds.X + room.Bounds.Width
			globalMaxY = room.Bounds.Y + room.Bounds.Height
			first = false
		} else {
			if room.Bounds.X < globalMinX {
				globalMinX = room.Bounds.X
			}
			if room.Bounds.Y < globalMinY {
				globalMinY = room.Bounds.Y
			}
			if room.Bounds.X+room.Bounds.Width > globalMaxX {
				globalMaxX = room.Bounds.X + room.Bounds.Width
			}
			if room.Bounds.Y+room.Bounds.Height > globalMaxY {
				globalMaxY = room.Bounds.Y + room.Bounds.Height
			}
		}
	}

	globalWidth := globalMaxX - globalMinX
	globalHeight := globalMaxY - globalMinY

	// Create combined layer
	combined := tilemap.NewTileLayer(globalWidth, globalHeight)
	combined.Props = map[string]string{
		"name": "geometry",
		"type": "traversal",
	}

	// Render each room
	for _, room := range rooms {
		roomLayer := RenderRoomToTilemap(room, abilities, variety, tileIDs, rng)

		// Copy room layer to combined layer
		for y := 0; y < room.Bounds.Height; y++ {
			for x := 0; x < room.Bounds.Width; x++ {
				srcIdx := y*room.Bounds.Width + x
				if srcIdx >= len(roomLayer.Data) {
					continue
				}

				tileValue := roomLayer.Data[srcIdx]
				if tileValue == 0 {
					continue
				}

				// Convert to global coordinates
				globalX := room.Bounds.X + x - globalMinX
				globalY := room.Bounds.Y + y - globalMinY
				dstIdx := globalY*globalWidth + globalX

				if dstIdx >= 0 && dstIdx < len(combined.Data) {
					combined.Data[dstIdx] = tileValue
				}
			}
		}
	}

	return combined, nil
}
