#+build freestanding

package host

import "core:c"

foreign import env "env"

@(default_calling_convention = "c")
foreign env {
	js_canvas_width :: proc() -> c.int ---
	js_canvas_height :: proc() -> c.int ---
}

frame_duration :: proc() -> f64 {
	return 1.0 / 60.0
}

widthf :: proc() -> f32 {
	return f32(js_canvas_width())
}

heightf :: proc() -> f32 {
	return f32(js_canvas_height())
}
