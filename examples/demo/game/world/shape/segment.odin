package shape

move_segment :: proc(s: ^Segment, p: Point) {
	s.x += p.x
	s.y += p.y
	s.z += p.x
	s.w += p.y
}

// Create a new segment from coordinates.
@(require_results)
make_segment :: proc(#any_int x1, #any_int y1, #any_int x2, #any_int y2: i32) -> Segment {
	return {x1, y1, x2, y2}
}

@(require_results)
segment_segment_solve :: proc(s1, s2: ^Segment) -> (point: Point, ok: bool) {
	if !segment_segment_test(s1, s2) {
		return {}, false
	}

	intersection, is_parallel := line_intersection_point(s1, s2)
	if is_parallel {
		return get_parallel_point(s1, s2), true
	}
	return intersection, true
}

@(require_results)
segment_point_test :: proc(segment: ^Segment, point: ^Point) -> bool {
	x1, y1 := segment[0], segment[1]
	x2, y2 := segment[2], segment[3]
	px, py := point.x, point.y

	if px < min(x1, x2) || px > max(x1, x2) || py < min(y1, y2) || py > max(y1, y2) {
		return false
	}
	if x1 == x2 {
		return px == x1
	}
	if y1 == y2 {
		return py == y1
	}

	cross := delta_i128(py, y1) * delta_i128(x2, x1) - delta_i128(px, x1) * delta_i128(y2, y1)
	return cross == 0
}

@(require_results)
segment_segment_test :: proc(s1, s2: ^Segment) -> bool {
	x1, y1 := s1[0], s1[1]
	x2, y2 := s1[2], s1[3]
	x3, y3 := s2[0], s2[1]
	x4, y4 := s2[2], s2[3]

	return(
		(ccw(x1, y1, x2, y2, x3, y3) * ccw(x1, y1, x2, y2, x4, y4) <= 0) &&
		(ccw(x3, y3, x4, y4, x1, y1) * ccw(x3, y3, x4, y4, x2, y2) <= 0) \
	)
}

@(private = "file")
line_intersection_point :: proc(s1, s2: ^Segment) -> (point: Point, is_parallel: bool) {
	x1, y1 := i128(s1[0]), i128(s1[1])
	x2, y2 := i128(s1[2]), i128(s1[3])
	x3, y3 := i128(s2[0]), i128(s2[1])
	x4, y4 := i128(s2[2]), i128(s2[3])

	a1 := y2 - y1
	b1 := x1 - x2
	c1 := x2 * y1 - x1 * y2
	a2 := y4 - y3
	b2 := x3 - x4
	c2 := x4 * y3 - x3 * y4
	denom := a1 * b2 - a2 * b1
	if denom == 0 {
		return {}, true
	}

	offset := denom < 0 ? -denom / 2 : denom / 2
	num_x := b1 * c2 - b2 * c1
	x := (num_x < 0 ? num_x - offset : num_x + offset) / denom
	num_y := a2 * c1 - a1 * c2
	y := (num_y < 0 ? num_y - offset : num_y + offset) / denom
	return {i32(x), i32(y)}, false
}

@(private = "file")
get_parallel_point :: proc(s1, s2: ^Segment) -> Point {
	return {
		i32((i128(s1[0]) + i128(s1[2])) / 2),
		i32((i128(s1[1]) + i128(s1[3])) / 2),
	}
}
