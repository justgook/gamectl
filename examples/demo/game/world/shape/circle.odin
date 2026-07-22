package shape

// Basic circle representation using 32-bit world coordinates.
Circle :: struct {
	x, y:   i32,
	radius: i32,
}

move_circle :: proc(s: ^Circle, p: Point) {
	s.x += p.x
	s.y += p.y
}

// Create a new circle from components.
@(require_results)
make_circle :: proc(#any_int x, #any_int y, #any_int radius: i32) -> Circle {
	return {x = x, y = y, radius = radius}
}

// Test if a point is inside the circle.
@(require_results)
circle_point_test :: proc(circle: ^Circle, point: ^Point) -> bool {
	dx := delta_i128(circle.x, point.x)
	dy := delta_i128(circle.y, point.y)
	distance_squared := dx * dx + dy * dy
	radius := i128(circle.radius)
	return distance_squared <= radius * radius
}

// Test if a circle and line segment intersect.
@(require_results)
circle_segment_test :: proc(circle: ^Circle, segment: ^Segment) -> bool {
	cx, cy := circle.x, circle.y
	r := circle.radius
	x1, y1 := segment[0], segment[1]
	x2, y2 := segment[2], segment[3]

	if i128(cx) + i128(r) < i128(min(x1, x2)) ||
	   i128(cx) - i128(r) > i128(max(x1, x2)) ||
	   i128(cy) + i128(r) < i128(min(y1, y2)) ||
	   i128(cy) - i128(r) > i128(max(y1, y2)) {
		return false
	}

	dx64, dy64 := delta_i128(x2, x1), delta_i128(y2, y1)
	segment_length_squared := dx64 * dx64 + dy64 * dy64
	if segment_length_squared == 0 {
		cx1, cy1 := delta_i128(cx, x1), delta_i128(cy, y1)
		return cx1 * cx1 + cy1 * cy1 <= i128(r) * i128(r)
	}

	// Integer projection preserves the existing integral collision behavior.
	t := (delta_i128(cx, x1) * dx64 + delta_i128(cy, y1) * dy64) / segment_length_squared

	closest_x, closest_y: i32
	if t < 0 {
		closest_x, closest_y = x1, y1
	} else if t > 1 {
		closest_x, closest_y = x2, y2
	} else {
		closest_x = i32(i128(x1) + t * dx64)
		closest_y = i32(i128(y1) + t * dy64)
	}

	closest_dx := delta_i128(cx, closest_x)
	closest_dy := delta_i128(cy, closest_y)
	return closest_dx * closest_dx + closest_dy * closest_dy <= i128(r) * i128(r)
}

// Test if two circles intersect.
@(require_results)
circle_circle_test :: proc(a, b: ^Circle) -> bool {
	dx := delta_i128(a.x, b.x)
	dy := delta_i128(a.y, b.y)
	radii_sum := i128(a.radius) + i128(b.radius)
	return dx * dx + dy * dy <= radii_sum * radii_sum
}
