package ease

import "core:math"

Easing :: proc(time: f32) -> f32

linear :: proc(time: f32) -> f32 {
	return time
}

// Cubic Bezier evaluated like elm-community/easing-functions 2.0.0:
// De Casteljau at `time`, returning the y coordinate. The x control points are
// accepted for API parity with Elm, but they do not affect the returned value.
bezier :: proc(_x1, y1, _x2, y2, time: f32) -> f32 {
	omt := 1.0 - time
	return 3.0 * omt * omt * time * y1 + 3.0 * omt * time * time * y2 + time * time * time
}

in_quad :: proc(time: f32) -> f32 {
	return time * time
}

out_quad :: proc(time: f32) -> f32 {
	return flip(in_quad, time)
}

in_out_quad :: proc(time: f32) -> f32 {
	return in_out(in_quad, out_quad, time)
}

in_cubic :: proc(time: f32) -> f32 {
	return time * time * time
}

out_cubic :: proc(time: f32) -> f32 {
	return flip(in_cubic, time)
}

in_out_cubic :: proc(time: f32) -> f32 {
	return in_out(in_cubic, out_cubic, time)
}

in_quart :: proc(time: f32) -> f32 {
	t2 := time * time
	return t2 * t2
}

out_quart :: proc(time: f32) -> f32 {
	return flip(in_quart, time)
}

in_out_quart :: proc(time: f32) -> f32 {
	return in_out(in_quart, out_quart, time)
}

in_quint :: proc(time: f32) -> f32 {
	t2 := time * time
	return t2 * t2 * time
}

out_quint :: proc(time: f32) -> f32 {
	return flip(in_quint, time)
}

in_out_quint :: proc(time: f32) -> f32 {
	return in_out(in_quint, out_quint, time)
}

in_sine :: proc(time: f32) -> f32 {
	return flip(out_sine, time)
}

out_sine :: proc(time: f32) -> f32 {
	return math.sin(time * (math.PI / 2.0))
}

in_out_sine :: proc(time: f32) -> f32 {
	return in_out(in_sine, out_sine, time)
}

in_expo :: proc(time: f32) -> f32 {
	if time == 0.0 {
		return 0.0
	}
	return math.pow(2.0, 10.0 * (time - 1.0))
}

out_expo :: proc(time: f32) -> f32 {
	return flip(in_expo, time)
}

in_out_expo :: proc(time: f32) -> f32 {
	return in_out(in_expo, out_expo, time)
}

in_circ :: proc(time: f32) -> f32 {
	return flip(out_circ, time)
}

out_circ :: proc(time: f32) -> f32 {
	return math.sqrt(1.0 - (time - 1.0) * (time - 1.0))
}

in_out_circ :: proc(time: f32) -> f32 {
	return in_out(in_circ, out_circ, time)
}

in_back :: proc(time: f32) -> f32 {
	return time * time * (2.70158 * time - 1.70158)
}

out_back :: proc(time: f32) -> f32 {
	return flip(in_back, time)
}

in_out_back :: proc(time: f32) -> f32 {
	return in_out(in_back, out_back, time)
}

in_bounce :: proc(time: f32) -> f32 {
	return flip(out_bounce, time)
}

out_bounce :: proc(time: f32) -> f32 {
	a: f32 = 7.5625
	t2 := time - (1.5 / 2.75)
	t3 := time - (2.25 / 2.75)
	t4 := time - (2.625 / 2.75)

	if time < 1.0 / 2.75 {
		return a * time * time
	} else if time < 2.0 / 2.75 {
		return a * t2 * t2 + 0.75
	} else if time < 2.5 / 2.75 {
		return a * t3 * t3 + 0.9375
	}
	return a * t4 * t4 + 0.984375
}

in_out_bounce :: proc(time: f32) -> f32 {
	return in_out(in_bounce, out_bounce, time)
}

in_elastic :: proc(time: f32) -> f32 {
	if time == 0.0 {
		return 0.0
	}
	s: f32 = 0.075
	p: f32 = 0.3
	t := time - 1.0
	return -(math.pow(2.0, 10.0 * t) * math.sin((t - s) * (2.0 * math.PI) / p))
}

out_elastic :: proc(time: f32) -> f32 {
	return flip(in_elastic, time)
}

in_out_elastic :: proc(time: f32) -> f32 {
	return in_out(in_elastic, out_elastic, time)
}

in_out :: proc(e1, e2: Easing, time: f32) -> f32 {
	if time < 0.5 {
		return e1(time * 2.0) / 2.0
	}
	return 0.5 + e2((time - 0.5) * 2.0) / 2.0
}

flip :: proc(easing: Easing, time: f32) -> f32 {
	return 1.0 - easing(1.0 - time)
}

reversed :: proc(easing: Easing, time: f32) -> f32 {
	return easing(1.0 - time)
}

retour :: proc(easing: Easing, time: f32) -> f32 {
	if time < 0.5 {
		return easing(time * 2.0)
	}
	return flip(easing, (time - 0.5) * 2.0)
}
