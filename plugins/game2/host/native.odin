#+build !freestanding
#+build !js
#+build !orca

package host

import sapp "../sokol/app"

frame_duration :: proc() -> f64 {
	return sapp.frame_duration()
}

widthf :: proc() -> f32 {
	return sapp.widthf()
}

heightf :: proc() -> f32 {
	return sapp.heightf()
}
