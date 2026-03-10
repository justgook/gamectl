package world

import sapp "../sokol/app"
import "camera"
import "core:fmt"

World :: struct {
	next_entity_id:   int,
	sim_frame_length: f64,
	accumulator:      f64,
	// Camera system
	cam:              camera.Camera,
}

frame :: proc(w: ^World) {
	w.accumulator += sapp.frame_duration()
	for (w.accumulator >= w.sim_frame_length) {
		w.accumulator -= w.sim_frame_length
		fmt.printfln("wrold run %f", w.accumulator)
	}

}


init :: proc(w: ^World) {
	w.sim_frame_length = 1.0 / 60.0
	w.cam = camera.camera_init({sapp.widthf() / 2, sapp.heightf() / 2}, 1.0)

	fmt.println("WORLD init")
}
