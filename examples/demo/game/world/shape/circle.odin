package shape

// Basic circle representation using integers
Circle :: struct {
	x, y:   int,
	radius: int,
}

move_circle :: proc(s: ^Circle, p: [2]int) {
	s.x += p.x
	s.y += p.y
}

// Create a new circle from components
@(require_results)
make_circle :: proc(#any_int x, #any_int y, #any_int radius: int) -> Circle {
	return Circle{x = x, y = y, radius = radius}
}

// Test if a point is inside the circle
@(require_results)
circle_point_test :: proc(circle: ^Circle, point: ^[2]int) -> bool {
	dx := circle.x - point.x
	dy := circle.y - point.y
	// Use squared distances to avoid square root
	distance_squared := dx * dx + dy * dy
	radius_squared := circle.radius * circle.radius
	return distance_squared <= radius_squared
}
// Test if a circle and line segment intersect
@(require_results)
circle_segment_test :: proc(circle: ^Circle, segment: ^[4]int) -> bool {
	// Get circle center and radius
	cx, cy := circle.x, circle.y
	r := circle.radius

	// Get segment endpoints
	x1, y1 := segment[0], segment[1]
	x2, y2 := segment[2], segment[3]

	// Quick rejection test using bounding box
	if cx + r < min(x1, x2) ||
	   cx - r > max(x1, x2) ||
	   cy + r < min(y1, y2) ||
	   cy - r > max(y1, y2) {
		return false
	}

	// Convert to vector form: segment start to end
	dx := x2 - x1
	dy := y2 - y1
	segment_length_squared := dx * dx + dy * dy

	// Handle degenerate segment (points are the same)
	if segment_length_squared == 0 {
		// Just check distance to endpoint
		distance_squared :=
			(cx - x1) * (cx - x1) + (cy - y1) * (cy - y1)
		return distance_squared <= r * r
	}

	// Project circle center onto line containing segment
	// t is how far along segment the projection lies (0 to 1 for within segment)
	t :=
		(((cx - x1) * dx + (cy - y1) * dy) * 1000) /
		(segment_length_squared * 1000)

	// Find closest point on line segment to circle center
	closest_x, closest_y: int
	if t < 0 {
		// Closest point is start of segment
		closest_x, closest_y = x1, y1
	} else if t > 1 {
		// Closest point is end of segment
		closest_x, closest_y = x2, y2
	} else {
		// Closest point is along segment
		closest_x = x1 + (t * dx)
		closest_y = y1 + (t * dy)
	}

	// Check if closest point is within circle radius
	dx = cx - closest_x
	dy = cy - closest_y
	distance_squared := dx * dx + dy * dy
	return distance_squared <= r * r
}

// Test if two circles intersect
@(require_results)
circle_circle_test :: proc(a, b: ^Circle) -> bool {
	dx := a.x - b.x
	dy := a.y - b.y
	// Square of the distance between centers
	distance_squared := dx * dx + dy * dy
	// Square of the sum of radii
	radii_sum := a.radius + b.radius
	radii_sum_squared := radii_sum * radii_sum
	return distance_squared <= radii_sum_squared
}

// Integer square root approximation
// Uses binary search to find the square root
@(private = "file")
isqrt :: proc(x: int) -> int {
	if x <= 0 {
		return 0
	}

	// Binary search for the square root
	left := 1
	right := x

	for left <= right {
		mid := (left + right) / 2
		if mid * mid == x {
			return mid
		}
		if mid * mid < x {
			left = mid + 1
		} else {
			right = mid - 1
		}
	}

	return right // Return the floor of the square root
}
