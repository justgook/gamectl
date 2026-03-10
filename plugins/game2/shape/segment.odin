package shape

move_segment :: proc(s: ^[4]int,  p: [2]int){
	s.x += p.x
	s.y += p.y
	s.z += p.x
	s.w += p.y
}

// Create a new segment from coordinates
@(require_results)
make_segment :: proc(x1, y1, x2, y2: int) -> [4]int {
	return [4]int{x1, y1, x2, y2}
}
// Main intersection test combining all the above
@(require_results)
segment_segment_solve :: proc(s1, s2: ^[4]int) -> (point: [2]int, ok: bool) {
	// First do quick test
	if !segment_segment_test(s1, s2) {
		return {0, 0}, false
	}

	// Calculate actual intersection
	point2, is_parallel := line_intersection_point(s1, s2)
	if is_parallel {
		// Handle parallel case
		return get_parallel_point(s1, s2), true
	}

	return point2, true
}

@(require_results)
segment_point_test :: proc(segment: ^[4]int, point: ^[2]int) -> bool {
	// Unpack segment points
	x1, y1 := segment[0], segment[1]
	x2, y2 := segment[2], segment[3]
	px, py := point.x, point.y

	// Check if point is within bounding box of segment
	if px < min(x1, x2) ||
	   px > max(x1, x2) ||
	   py < min(y1, y2) ||
	   py > max(y1, y2) {
		return false
	}

	// For vertical line
	if x1 == x2 {
		return px == x1
	}

	// For horizontal line
	if y1 == y2 {
		return py == y1
	}

	// Check if point lies on segment using cross product
	// Cross product should be 0 for collinear points
	cross := (py - y1) * (x2 - x1) - (px - x1) * (y2 - y1)
	return cross == 0
}

// Fast test to check if segments could possibly intersect
@(require_results)
segment_segment_test :: proc(s1, s2: ^[4]int) -> bool {
	x1, y1 := s1[0], s1[1] // Start of first segment
	x2, y2 := s1[2], s1[3] // End of first segment
	x3, y3 := s2[0], s2[1] // Start of second segment
	x4, y4 := s2[2], s2[3] // End of second segment

	return(
		(ccw(x1, y1, x2, y2, x3, y3) * ccw(x1, y1, x2, y2, x4, y4) <=
			0) &&
		(ccw(x3, y3, x4, y4, x1, y1) * ccw(x3, y3, x4, y4, x2, y2) <=
				0) \
	)
}


// Calculate actual intersection point if segments are not parallel
@(private = "file")
line_intersection_point :: proc(
	s1, s2: ^[4]int,
) -> (
	point: [2]int,
	is_parallel: bool,
) {
	x1, y1 := int(s1[0]), int(s1[1])
	x2, y2 := int(s1[2]), int(s1[3])
	x3, y3 := int(s2[0]), int(s2[1])
	x4, y4 := int(s2[2]), int(s2[3])

	// Line coefficients for first line (a1x + b1y + c1 = 0)
	a1 := y2 - y1
	b1 := x1 - x2
	c1 := x2 * y1 - x1 * y2

	// Line coefficients for second line
	a2 := y4 - y3
	b2 := x3 - x4
	c2 := x4 * y3 - x3 * y4

	denom := a1 * b2 - a2 * b1

	// Check if lines are parallel
	if denom == 0 {return {0, 0}, true}

	// Calculate intersection point with rounding
	offset := denom < 0 ? -denom / 2 : denom / 2

	num_x := b1 * c2 - b2 * c1
	x := (num_x < 0 ? num_x - offset : num_x + offset) / denom

	num_y := a2 * c1 - a1 * c2
	y := (num_y < 0 ? num_y - offset : num_y + offset) / denom

	return {x, y}, false
}

// Get intersection point when lines are parallel and overlapping
@(private = "file")
get_parallel_point :: proc(s1, s2: ^[4]int) -> [2]int {
	// For parallel overlapping segments, return midpoint of overlap
	// This is a simplified approach - could be made more sophisticated
	return [2]int{(s1[0] + s1[2]) / 2, (s1[1] + s1[3]) / 2}
}
