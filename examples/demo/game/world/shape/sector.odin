package shape

import "core:math"

// Sector is a circular region limited by a forward direction and a half-angle.
// half_angle_cosine is precomputed so point tests do not require trigonometry.
Sector :: struct {
	x, y:              i32,
	radius:            i32,
	direction:         Point,
	half_angle_cosine: f64,
}

@(require_results)
make_sector_degrees :: proc(
	#any_int x, y, radius: i32,
	direction: Point,
	half_angle_degrees: f64,
) -> Sector {
	assert(radius >= 0)
	assert(direction.x != 0 || direction.y != 0)
	assert(half_angle_degrees >= 0 && half_angle_degrees <= 90)

	cosine := 0.0
	if half_angle_degrees < 90 {
		cosine = math.cos(half_angle_degrees * math.PI / 180.0)
	}
	return {x = x, y = y, radius = radius, direction = direction, half_angle_cosine = cosine}
}

move_sector :: proc(sector: ^Sector, offset: Point) {
	sector.x += offset.x
	sector.y += offset.y
}

@(require_results)
sector_point_test :: proc(sector: ^Sector, point: ^Point) -> bool {
	dx := delta_i128(point.x, sector.x)
	dy := delta_i128(point.y, sector.y)
	distance_squared := dx * dx + dy * dy
	radius := i128(sector.radius)
	if distance_squared > radius * radius {
		return false
	}
	if distance_squared == 0 {
		return true
	}

	direction_x := i128(sector.direction.x)
	direction_y := i128(sector.direction.y)
	dot := dx * direction_x + dy * direction_y
	if dot < 0 {
		return false
	}

	direction_length_squared := direction_x * direction_x + direction_y * direction_y
	angular_lhs := f64(dot) * f64(dot)
	angular_rhs :=
		f64(distance_squared) * f64(direction_length_squared) * sector.half_angle_cosine * sector.half_angle_cosine
	return angular_lhs >= angular_rhs - angular_rhs * 1e-12
}
