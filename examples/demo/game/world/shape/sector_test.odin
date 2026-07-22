#+build !freestanding
#+build !js
#+build !orca
#+test

package shape

import "core:testing"

@(test)
test_sector_point_detection_respects_radius_direction_and_angle :: proc(t: ^testing.T) {
	sector := make_sector_degrees(0, 0, 20, {1, 0}, 45)

	cases := []struct {
		name:     string,
		point:    Point,
		expected: bool,
	} {
		{"center", {0, 0}, true},
		{"directly ahead", {10, 0}, true},
		{"behind", {-10, 0}, false},
		{"outside radius", {21, 0}, false},
		{"outside angle", {5, 10}, false},
		{"angular boundary", {10, 10}, true},
		{"radial boundary", {20, 0}, true},
	}

	for &test_case in cases {
		actual := sector_point_test(&sector, &test_case.point)
		testing.expectf(
			t,
			actual == test_case.expected,
			"%s: expected %v, got %v",
			test_case.name,
			test_case.expected,
			actual,
		)
	}
}

@(test)
test_sector_point_detection_supports_non_normalized_direction :: proc(t: ^testing.T) {
	sector := make_sector_degrees(0, 0, 20, {10, 0}, 45)
	inside := Point{10, 5}
	outside := Point{5, 10}

	testing.expect(t, sector_point_test(&sector, &inside))
	testing.expect(t, !sector_point_test(&sector, &outside))
}

@(test)
test_move_sector_translates_its_center :: proc(t: ^testing.T) {
	sector := make_sector_degrees(1, 2, 20, {1, 0}, 45)
	move_sector(&sector, {3, 4})

	testing.expectf(t, sector.x == 4 && sector.y == 6, "translated sector = %v", sector)
}
