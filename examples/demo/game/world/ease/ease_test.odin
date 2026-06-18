#+build !freestanding
#+build !js
#+build !orca

package ease

import "core:math"
import "core:testing"

expect_near :: proc(t: ^testing.T, got, want: f32) {
	epsilon: f32 = 0.00001
	delta := math.abs(got - want)
	testing.expectf(t, delta <= epsilon, "got %.8f want %.8f delta %.8f", got, want, delta)
}

@(test)
test_polynomial_eases_match_readme_examples :: proc(t: ^testing.T) {
	expect_near(t, in_quad(0.0), 0.0)
	expect_near(t, in_quad(0.1), 0.01)
	expect_near(t, in_quad(0.5), 0.25)
	expect_near(t, in_quad(1.0), 1.0)

	expect_near(t, out_cubic(0.0), 0.0)
	expect_near(t, out_cubic(0.1), 0.271)
	expect_near(t, out_cubic(0.5), 0.875)
	expect_near(t, out_cubic(1.0), 1.0)
}

@(test)
test_transform_helpers :: proc(t: ^testing.T) {
	expect_near(t, flip(in_quad, 0.25), 0.4375)
	expect_near(t, reversed(in_quad, 0.25), 0.5625)
	expect_near(t, in_out(in_quad, out_quad, 0.25), 0.125)
	expect_near(t, in_out(in_quad, out_quad, 0.75), 0.875)
	expect_near(t, retour(in_quad, 0.25), 0.25)
	expect_near(t, retour(in_quad, 0.75), 0.75)
}

@(test)
test_endpoint_values :: proc(t: ^testing.T) {
	eases := [?]Easing {
		linear,
		in_quad,
		out_quad,
		in_out_quad,
		in_cubic,
		out_cubic,
		in_out_cubic,
		in_quart,
		out_quart,
		in_out_quart,
		in_quint,
		out_quint,
		in_out_quint,
		in_sine,
		out_sine,
		in_out_sine,
		in_expo,
		out_expo,
		in_out_expo,
		in_circ,
		out_circ,
		in_out_circ,
		in_back,
		out_back,
		in_out_back,
		in_bounce,
		out_bounce,
		in_out_bounce,
		in_elastic,
		out_elastic,
		in_out_elastic,
	}

	for easing in eases {
		expect_near(t, easing(0.0), 0.0)
		expect_near(t, easing(1.0), 1.0)
	}
}

@(test)
test_bezier_matches_de_casteljau_y_curve :: proc(t: ^testing.T) {
	expect_near(t, bezier(0.25, 0.1, 0.25, 1.0, 0.0), 0.0)
	expect_near(t, bezier(0.25, 0.1, 0.25, 1.0, 0.5), 0.5375)
	expect_near(t, bezier(0.25, 0.1, 0.25, 1.0, 1.0), 1.0)
}
