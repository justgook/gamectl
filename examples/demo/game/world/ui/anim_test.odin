#+build !freestanding
#+build !js
#+build !orca

package ui

import "core:math"
import "core:testing"

@(private = "file")
expect_near :: proc(t: ^testing.T, got, want: f32) {
	epsilon: f32 = 0.00001
	delta := math.abs(got - want)
	testing.expectf(t, delta <= epsilon, "got %.8f want %.8f delta %.8f", got, want, delta)
}

@(test)
test_phase_wraps_by_period_frames :: proc(t: ^testing.T) {
	expect_near(t, phase(4, 0), 0.0)
	expect_near(t, phase(4, 1), 0.25)
	expect_near(t, phase(4, 2), 0.5)
	expect_near(t, phase(4, 3), 0.75)
	expect_near(t, phase(4, 4), 0.0)
	expect_near(t, phase(4, 5), 0.25)
}

@(test)
test_wave_matches_playground_shape_with_frames :: proc(t: ^testing.T) {
	expect_near(t, wave(10, 20, 4, 0), 20.0)
	expect_near(t, wave(10, 20, 4, 1), 15.0)
	expect_near(t, wave(10, 20, 4, 2), 10.0)
	expect_near(t, wave(10, 20, 4, 3), 15.0)
	expect_near(t, wave(10, 20, 4, 4), 20.0)
}

@(test)
test_zigzag_matches_playground_shape_with_frames :: proc(t: ^testing.T) {
	expect_near(t, zigzag(-20, 20, 4, 0), 20.0)
	expect_near(t, zigzag(-20, 20, 4, 1), 0.0)
	expect_near(t, zigzag(-20, 20, 4, 2), -20.0)
	expect_near(t, zigzag(-20, 20, 4, 3), 0.0)
	expect_near(t, zigzag(-20, 20, 4, 4), 20.0)
}
