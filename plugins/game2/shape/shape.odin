package shape

move :: proc {
	move_point,
	move_segment,
	move_circle,
	move_capsule,
}

test :: proc {
	point_segment_test,
	point_cicle_test,
	point_capsule_test,
	segment_point_test,
	segment_segment_test,
	segment_circle_test,
	segment_capsule_test,
	circle_point_test,
	circle_segment_test,
	circle_circle_test,
	circle_capsule_test,
	capsule_point_test,
	capsule_segment_test,
	capsule_circle_test,
	capsule_capsule_test,
}

aabb :: proc {
	capsule_aabb,
}

move_point :: proc(s: ^[2]int, p: [2]int) {
	s.x += p.x
	s.y += p.y
}

@(require_results)
point_segment_test :: proc(point: ^[2]int, segment: ^[4]int) -> bool {
	return segment_point_test(segment, point)
}

@(require_results)
point_cicle_test :: proc(point: ^[2]int, circle: ^Circle) -> bool {
	return circle_point_test(circle, point)
}

@(require_results)
point_capsule_test :: proc(point: ^[2]int, capsule: ^Capsule) -> bool {
	return capsule_point_test(capsule, point)
}

// Add the symmetric case
@(require_results)
segment_circle_test :: proc(segment: ^[4]int, circle: ^Circle) -> bool {
	return circle_segment_test(circle, segment)
}
// Add the symmetric case
@(require_results)
segment_capsule_test :: proc(segment: ^[4]int, capsule: ^Capsule) -> bool {
	return capsule_segment_test(capsule, segment)
}

@(require_results)
circle_capsule_test :: proc(circle: ^Circle, capsule: ^Capsule) -> bool {
	return capsule_circle_test(capsule, circle)
}

// Determines if points a->b->c form a counter-clockwise turn
// Returns: +1 counter-clockwise, -1 clockwise, 0 collinear
@(require_results)
ccw :: proc(ax, ay, bx, by, cx, cy: int) -> int {
	area2 := (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
	if area2 < 0 {return -1}
	if area2 > 0 {return +1}

	return 0
}
