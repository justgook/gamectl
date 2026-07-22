package shape

move :: proc {
	move_point,
	move_segment,
	move_circle,
	move_sector,
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
	sector_point_test,
	point_sector_test,
	capsule_point_test,
	capsule_segment_test,
	capsule_circle_test,
	capsule_capsule_test,
}

aabb :: proc {
	capsule_aabb,
}

move_point :: proc(s: ^Point, p: Point) {
	s.x += p.x
	s.y += p.y
}

@(require_results)
point_segment_test :: proc(point: ^Point, segment: ^Segment) -> bool {
	return segment_point_test(segment, point)
}

@(require_results)
point_cicle_test :: proc(point: ^Point, circle: ^Circle) -> bool {
	return circle_point_test(circle, point)
}

@(require_results)
point_sector_test :: proc(point: ^Point, sector: ^Sector) -> bool {
	return sector_point_test(sector, point)
}

@(require_results)
point_capsule_test :: proc(point: ^Point, capsule: ^Capsule) -> bool {
	return capsule_point_test(capsule, point)
}

@(require_results)
segment_circle_test :: proc(segment: ^Segment, circle: ^Circle) -> bool {
	return circle_segment_test(circle, segment)
}

@(require_results)
segment_capsule_test :: proc(segment: ^Segment, capsule: ^Capsule) -> bool {
	return capsule_segment_test(capsule, segment)
}

@(require_results)
circle_capsule_test :: proc(circle: ^Circle, capsule: ^Capsule) -> bool {
	return capsule_circle_test(capsule, circle)
}

delta_i128 :: proc(a, b: i32) -> i128 {
	return i128(a) - i128(b)
}

// Determines if points a->b->c form a counter-clockwise turn.
// Returns +1 counter-clockwise, -1 clockwise, or 0 collinear.
@(require_results)
ccw :: proc(
	#any_int ax, ay, bx, by, cx, cy: i32,
) -> i32 {
	area2 := delta_i128(bx, ax) * delta_i128(cy, ay) - delta_i128(cx, ax) * delta_i128(by, ay)
	if area2 < 0 {return -1}
	if area2 > 0 {return +1}
	return 0
}
