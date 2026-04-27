package world

import sg "../sokol/gfx"
import "core:math/linalg"

sys_display :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {}

@(private = "file")
BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

Display_Pipe :: struct {
	pip:  sg.Pipeline,
	bind: sg.Bindings,
}

display_cleanup :: proc(pipe: ^Display_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	free(pipe)
}

display_init :: proc(tex0: sg.Image) -> ^Display_Pipe {
	pipe := new(Display_Pipe)

	return pipe
}
