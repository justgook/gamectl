#+build !freestanding
#+build !js
#+build !orca
#+test

package shape

import "core:testing"

@(test)
test_shape_constructors_accept_integer_inputs_and_store_i32 :: proc(t: ^testing.T) {
	x := i64(1)
	y := i16(2)
	radius := u8(3)
	height := u16(4)

	circle := make_circle(x, y, radius)
	capsule := make_capsule(x, y, radius, height)
	segment := make_segment(x, y, radius, height)

	testing.expect(t, circle == Circle{1, 2, 3})
	testing.expect(t, capsule == Capsule{1, 2, 3, 4})
	testing.expect(t, segment == Segment{1, 2, 3, 4})
}
