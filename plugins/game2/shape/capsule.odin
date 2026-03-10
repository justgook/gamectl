package shape

// Represents an axis-aligned capsule with two semi-circles at top and bottom
Capsule :: struct {
	x, y:   int, // Center position
	radius: int, // Radius of the semi-circles
	height: int, // Height of the rectangular part (not including semi-circles)
}

move_capsule :: proc(s: ^Capsule, p: [2]int) {
	s.x += p.x
	s.y += p.y
}
capsule_aabb :: proc(s: ^Capsule) -> Aabb {
	return Aabb {
		min_x = s.x - s.radius,
		min_y = s.y - s.height / 2 - s.radius,
		max_x = s.x + s.radius,
		max_y = s.y + s.height / 2 + s.radius,
	}

}
// Create a new capsule from components
@(require_results)
make_capsule :: proc(x, y, radius, height: int) -> Capsule {
	return Capsule{x = x, y = y, radius = radius, height = height}
}

// Test if a point is inside the capsule
@(require_results)
capsule_point_test :: proc(capsule: ^Capsule, point: ^[2]int) -> bool {
	// First check if point is within the horizontal bounds of the capsule
	if point.x < capsule.x - capsule.radius ||
	   point.x > capsule.x + capsule.radius {
		return false
	}

	// Get the vertical extent of the rectangular part
	half_height := capsule.height / 2
	rect_top := capsule.y + half_height
	rect_bottom := capsule.y - half_height

	// If point is within the rectangular part
	if point.y >= rect_bottom && point.y <= rect_top {
		return true
	}

	// Check top semi-circle
	if point.y > rect_top {
		circle := Circle {
			x      = capsule.x,
			y      = rect_top,
			radius = capsule.radius,
		}
		return circle_point_test(&circle, point)
	}

	// Check bottom semi-circle
	if point.y < rect_bottom {
		circle := Circle {
			x      = capsule.x,
			y      = rect_bottom,
			radius = capsule.radius,
		}
		return circle_point_test(&circle, point)
	}

	return false
}

@(require_results)
capsule_segment_test :: proc(capsule: ^Capsule, segment: ^[4]int) -> bool {
	// Get the vertical extent of the capsule's rectangular part
	half_height := capsule.height / 2
	rect_top := capsule.y + half_height
	rect_bottom := capsule.y - half_height

	// First try the end circles
	top_circle := Circle {
		x      = capsule.x,
		y      = rect_top,
		radius = capsule.radius,
	}

	if circle_segment_test(&top_circle, segment) {
		return true
	}

	bottom_circle := Circle {
		x      = capsule.x,
		y      = rect_bottom,
		radius = capsule.radius,
	}

	if circle_segment_test(&bottom_circle, segment) {
		return true
	}

	// If segment endpoints are on opposite sides of capsule's rectangle,
	// we need to check for intersection with the rectangle edges
	s_x1, s_y1 := segment[0], segment[1]
	s_x2, s_y2 := segment[2], segment[3]

	// Create segments for the rectangle sides
	left_x := capsule.x - capsule.radius
	right_x := capsule.x + capsule.radius

	left_segment := [4]int{left_x, rect_bottom, left_x, rect_top}
	right_segment := [4]int{right_x, rect_bottom, right_x, rect_top}

	// Test segment against rectangle sides
	if segment_segment_test(segment, &left_segment) ||
	   segment_segment_test(segment, &right_segment) {
		return true
	}

	return false
}
// Test if a capsule and circle intersect
@(require_results)
capsule_circle_test :: proc(capsule: ^Capsule, circle: ^Circle) -> bool {
	// Get the vertical extent of the rectangular part
	half_height := capsule.height / 2
	rect_top := capsule.y + half_height
	rect_bottom := capsule.y - half_height

	// If circle center is within the height range of the rectangle
	if circle.y >= rect_bottom && circle.y <= rect_top {
		// Do horizontal distance check
		dx := abs(circle.x - capsule.x)
		return dx <= (capsule.radius + circle.radius)
	}

	// Check collision with top semi-circle
	top_circle := Circle {
		x      = capsule.x,
		y      = rect_top,
		radius = capsule.radius,
	}
	if circle_circle_test(&top_circle, circle) {
		return true
	}

	// Check collision with bottom semi-circle
	bottom_circle := Circle {
		x      = capsule.x,
		y      = rect_bottom,
		radius = capsule.radius,
	}
	return circle_circle_test(&bottom_circle, circle)
}

// Test if two capsules intersect
@(require_results)
capsule_capsule_test :: proc(a, b: ^Capsule) -> bool {
	// Get extents of both capsules
	a_half_height := a.height / 2
	b_half_height := b.height / 2

	a_top := a.y + a_half_height
	a_bottom := a.y - a_half_height
	b_top := b.y + b_half_height
	b_bottom := b.y - b_half_height

	// Quick rejection test - if capsules are too far apart horizontally
	dx := abs(a.x - b.x)
	if dx > (a.radius + b.radius) {
		return false
	}

	// Test rectangular overlap
	if a_bottom <= b_top && a_top >= b_bottom {
		return dx <= (a.radius + b.radius)
	}

	// No rectangular overlap, test circle-to-circle for ends
	// Top of a with top of b
	if a_top < b_bottom {
		top_circle_a := Circle {
			x      = a.x,
			y      = a_top,
			radius = a.radius,
		}
		bottom_circle_b := Circle {
			x      = b.x,
			y      = b_bottom,
			radius = b.radius,
		}
		if circle_circle_test(&top_circle_a, &bottom_circle_b) {
			return true
		}
	}

	// Bottom of a with top of b
	if b_top < a_bottom {
		bottom_circle_a := Circle {
			x      = a.x,
			y      = a_bottom,
			radius = a.radius,
		}
		top_circle_b := Circle {
			x      = b.x,
			y      = b_top,
			radius = b.radius,
		}
		if circle_circle_test(&bottom_circle_a, &top_circle_b) {
			return true
		}
	}

	return false
}


@(require_results)
swept_capsule_segment_test :: proc(
	capsule: ^Capsule,
	start_pos: [2]int,
	velocity: [2]int,
	segment: ^[4]int,
) -> f32 {
	// Calculate segment orientation
	is_horizontal :=
		abs(segment[3] - segment[1]) < abs(segment[2] - segment[0])

	// Convert to float for calculations
	vel_f32 := [2]f32{f32(velocity.x), f32(velocity.y)}

	// Get capsule properties in world space
	capsule_x := f32(start_pos.x + capsule.x)
	capsule_y := f32(start_pos.y + capsule.y)
	half_height := f32(capsule.height) / 2
	radius := f32(capsule.radius)

	// Calculate the bounds of the capsule
	capsule_min_x := capsule_x - radius
	capsule_max_x := capsule_x + radius
	capsule_min_y := capsule_y - half_height - radius // Bottom of bottom circle
	capsule_max_y := capsule_y + half_height + radius // Top of top circle

	if is_horizontal {
		// Horizontal segment (floor or ceiling)
		segment_y := f32(segment[1]) // Y-coordinate is constant
		segment_min_x := f32(min(segment[0], segment[2]))
		segment_max_x := f32(max(segment[0], segment[2]))

		// Expand segment vertically by radius
		expanded_min_y := segment_y - radius
		expanded_max_y := segment_y + radius

		// Check for collision on Y-axis first (capsule moving up/down)
		if vel_f32.y != 0 {
			// Time when capsule's top/bottom enters expanded segment
			t_entry_y: f32
			if vel_f32.y > 0 {
				// Moving up, bottom edge of capsule enters expanded segment
				t_entry_y =
					(expanded_min_y - capsule_max_y) /
					vel_f32.y
			} else {
				// Moving down, top edge of capsule enters expanded segment
				t_entry_y =
					(expanded_max_y - capsule_min_y) /
					vel_f32.y
			}

			// Only process if collision happens within this frame (0 <= t <= 1)
			if t_entry_y >= 0 && t_entry_y <= 1 {
				// X position at time of y-collision
				x_at_collision :=
					capsule_x + vel_f32.x * t_entry_y

				// Check if X position is within segment bounds
				if x_at_collision + radius >= segment_min_x &&
				   x_at_collision - radius <= segment_max_x {
					return t_entry_y
				}
			}
		}

		// If no Y collision, check if capsule horizontally enters segment range
		if vel_f32.x != 0 {
			// Only need to check if capsule is already in Y range of expanded segment
			if (capsule_min_y <= expanded_max_y &&
				   capsule_max_y >= expanded_min_y) ||
			   (capsule_min_y + vel_f32.y <= expanded_max_y &&
					   capsule_max_y + vel_f32.y >=
						   expanded_min_y) {

				t_entry_x: f32
				if vel_f32.x > 0 {
					// Moving right
					t_entry_x =
						(segment_min_x -
							capsule_max_x) /
						vel_f32.x
				} else {
					// Moving left
					t_entry_x =
						(segment_max_x -
							capsule_min_x) /
						vel_f32.x
				}

				if t_entry_x >= 0 && t_entry_x <= 1 {
					// Y position at time of x-collision
					y_at_collision :=
						capsule_y +
						vel_f32.y * t_entry_x

					// Check if Y position is within expanded segment bounds
					if y_at_collision -
							   half_height -
							   radius <=
						   expanded_max_y &&
					   y_at_collision +
							   half_height +
							   radius >=
						   expanded_min_y {
						return t_entry_x
					}
				}
			}
		}
	} else {
		// Vertical segment (wall)
		segment_x := f32(segment[0]) // X-coordinate is constant
		segment_min_y := f32(min(segment[1], segment[3]))
		segment_max_y := f32(max(segment[1], segment[3]))

		// Expand segment horizontally by radius
		expanded_min_x := segment_x - radius
		expanded_max_x := segment_x + radius

		// Check for collision on X-axis first (capsule moving left/right)
		if vel_f32.x != 0 {
			// Time when capsule's left/right edge enters expanded segment
			t_entry_x: f32
			if vel_f32.x > 0 {
				// Moving right, left edge of capsule enters expanded segment
				t_entry_x =
					(expanded_min_x - capsule_max_x) /
					vel_f32.x
			} else {
				// Moving left, right edge of capsule enters expanded segment
				t_entry_x =
					(expanded_max_x - capsule_min_x) /
					vel_f32.x
			}

			// Only process if collision happens within this frame
			if t_entry_x >= 0 && t_entry_x <= 1 {
				// Y position at time of x-collision
				y_at_collision :=
					capsule_y + vel_f32.y * t_entry_x

				// Check if capsule's vertical extent overlaps with segment
				if y_at_collision - half_height <=
					   segment_max_y &&
				   y_at_collision + half_height >=
					   segment_min_y {
					return t_entry_x
				}

				// Check for collision with top circle
				top_y := y_at_collision + half_height
				if top_y - radius <= segment_max_y &&
				   top_y + radius >= segment_min_y {
					return t_entry_x
				}

				// Check for collision with bottom circle
				bottom_y := y_at_collision - half_height
				if bottom_y - radius <= segment_max_y &&
				   bottom_y + radius >= segment_min_y {
					return t_entry_x
				}
			}
		}
	}

	// No collision found
	return -1
}
