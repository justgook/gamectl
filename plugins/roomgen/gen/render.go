package gen

import (
	"github.com/justgook/gams/pkg/tilemap"
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
	// Use new validated generation pipeline
	return RenderRoomToTilemapValidated(room, abilities, variety, tileIDs, rng)
}

// RenderRoomToTilemapValidated generates traversal geometry using validated segment generation
// This version guarantees reachability by construction - no post-validation needed
// It properly handles non-rectangular room shapes.
func RenderRoomToTilemapValidated(room *RoomInfo, abilities PlayerAbilities, variety VarietyConfig, tileIDs TileIDConfig, rng Random) *tilemap.TileLayer {
	// Create navigation graph with validated connectivity
	graph := CreateNavigationGraphWithValidation(room, abilities, rng, variety)

	if graph == nil || len(graph.Nodes) == 0 {
		// No exits - return empty layer
		return tilemap.NewTileLayer(room.Bounds.Width, room.Bounds.Height)
	}

	// Ensure room has a shape for non-rectangular handling
	if room.Shape == nil && len(room.Tiles) > 0 {
		room.Shape = NewRoomShape(room.Tiles)
	}

	// Generate segments for each edge using tier-appropriate generator
	allSegments := []PathSegment{}
	for _, edge := range graph.Edges {
		fromNode := graph.GetNodeByID(edge.FromID)
		toNode := graph.GetNodeByID(edge.ToID)

		if fromNode == nil || toNode == nil {
			continue
		}

		var segments []PathSegment

		// Use shape-aware generation for non-rectangular rooms
		if room.Shape != nil && len(room.Shape.Tiles) > 0 {
			segments = GenerateBasicSegmentsInShape(fromNode.Position, toNode.Position, abilities, room.Shape)
		}

		// Fallback to bounds-based generation
		if segments == nil {
			// Try anchor variety for non-straight paths
			if rng != nil {
				segments = AddAnchorVariety(fromNode.Position, toNode.Position, abilities, room.Bounds, rng)
			}
		}

		if segments == nil {
			// Use tiered segment generation (tries advanced, falls back to basic)
			segments = GenerateSegmentsWithTier(fromNode.Position, toNode.Position, abilities, room.Bounds)
		}

		if segments != nil {
			allSegments = append(allSegments, segments...)
		}
	}

	// Filter segments to only include tiles within room shape
	if room.Shape != nil {
		allSegments = FilterSegmentsToShape(allSegments, room.Shape)
	}

	// Apply simple decoration
	decorConfig := DecorationConfigFromVariety(variety)
	allSegments = ApplyDecoration(allSegments, rng, decorConfig, room.Bounds)

	// Enforce minimum parallel spacing
	allSegments = EnforceParallelSpacing(allSegments, MinPlatformSpacing)

	// Merge overlapping platforms
	allSegments = MergeOverlappingPlatforms(allSegments)

	// Fit segments within bounds
	margin := 0
	allSegments = FitSegmentsInBounds(allSegments, room.Bounds, margin)

	// Resolve collisions
	clearance := 0
	allSegments = ResolveCollisions(allSegments, room.Bounds, clearance)

	// Render to tilemap
	return RenderToTilemap(allSegments, room.Bounds, tileIDs)
}

// FilterSegmentsToShape removes segment tiles that are outside the room shape
func FilterSegmentsToShape(segments []PathSegment, shape *RoomShape) []PathSegment {
	if shape == nil {
		return segments
	}

	result := make([]PathSegment, 0, len(segments))

	for _, seg := range segments {
		tiles := seg.GetTiles()
		validTiles := make([]Point, 0, len(tiles))

		for _, tile := range tiles {
			if shape.Contains(tile) {
				validTiles = append(validTiles, tile)
			}
		}

		if len(validTiles) == 0 {
			continue
		}

		// If all tiles are valid, keep original segment
		if len(validTiles) == len(tiles) {
			result = append(result, seg)
			continue
		}

		// Create new segment with only valid tiles
		// Find new start/end from valid tiles
		minX, maxX := validTiles[0].X, validTiles[0].X
		minY, maxY := validTiles[0].Y, validTiles[0].Y

		for _, t := range validTiles {
			if t.X < minX {
				minX = t.X
			}
			if t.X > maxX {
				maxX = t.X
			}
			if t.Y < minY {
				minY = t.Y
			}
			if t.Y > maxY {
				maxY = t.Y
			}
		}

		newSeg := PathSegment{
			Type:      seg.Type,
			Direction: seg.Direction,
			Tiles:     validTiles,
		}

		// Set start/end based on segment type
		if seg.Type == SegmentLadder || seg.Type == SegmentWallJump {
			// Vertical segment
			newSeg.Start = Point{validTiles[0].X, minY}
			newSeg.End = Point{validTiles[0].X, maxY}
		} else {
			// Horizontal segment
			newSeg.Start = Point{minX, validTiles[0].Y}
			newSeg.End = Point{maxX, validTiles[0].Y}
		}

		result = append(result, newSeg)
	}

	return result
}

// GenerateSegments populates edge segments using the validated segment generation
// This replaces the old segment generation in segments.go
func GenerateSegments(graph *NavigationGraph, abilities PlayerAbilities, bounds Rect) {
	for i := range graph.Edges {
		edge := &graph.Edges[i]
		fromNode := graph.GetNodeByID(edge.FromID)
		toNode := graph.GetNodeByID(edge.ToID)

		if fromNode == nil || toNode == nil {
			continue
		}

		edge.Segments = GenerateSegmentsWithTier(
			fromNode.Position,
			toNode.Position,
			abilities,
			bounds,
		)
	}
}

// AddVariety applies decoration to segments (wrapper for legacy compatibility)
// This replaces the old variety.go AddVariety function
func AddVariety(segments []PathSegment, rng Random, variety VarietyConfig, bounds Rect) []PathSegment {
	config := DecorationConfigFromVariety(variety)
	return ApplyDecoration(segments, rng, config, bounds)
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
