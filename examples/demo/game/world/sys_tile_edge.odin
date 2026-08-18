package world

import sg "../sokol/gfx"

Tile_Edge_Pipe :: struct {
	pip:       sg.Pipeline,
	bind:      sg.Bindings,
	threshold: f32,
	softness:  f32,
}

sys_tile_edge :: proc(pipe: ^Tile_Edge_Pipe) {
	params := Tile_Edge_Fs_Params {
		texel_size = {1.0 / GAME_RESOLUTION_WIDTH, 1.0 / GAME_RESOLUTION_HEIGHT},
		threshold  = pipe.threshold,
		softness   = pipe.softness,
	}
	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_tile_edge_fs_params, {ptr = &params, size = size_of(params)})
	sg.draw(0, 6, 1)
}

tile_edge_init :: proc(normal_texture, light_texture: sg.View) -> ^Tile_Edge_Pipe {
	pipe := new(Tile_Edge_Pipe)
	pipe.threshold = 0.025
	pipe.softness = 0.15
	pipe.bind.views[VIEW_tile_edge_normal_tex] = normal_texture
	pipe.bind.views[VIEW_tile_edge_light_tex] = light_texture
	pipe.bind.samplers[SMP_tile_edge_canvas_smp] = sg.make_sampler(
		{min_filter = .NEAREST, mag_filter = .NEAREST, wrap_u = .CLAMP_TO_EDGE, wrap_v = .CLAMP_TO_EDGE},
	)
	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &TILE_EDGE_BASE_VERTICES, size = size_of(TILE_EDGE_BASE_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &TILE_EDGE_BASE_INDICES, size = size_of(TILE_EDGE_BASE_INDICES)},
		},
	)
	pipe.pip = sg.make_pipeline(
		{
			shader = sg.make_shader(tile_edge_shader_desc(sg.query_backend())),
			cull_mode = .NONE,
			depth = {pixel_format = .NONE},
			index_type = .UINT16,
			layout = {attrs = {ATTR_tile_edge_tile_edge_pos = {format = .FLOAT2, buffer_index = 0}}},
			colors = {0 = {pixel_format = .RGBA16F}},
		},
	)
	return pipe
}

tile_edge_cleanup :: proc(pipe: ^Tile_Edge_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_sampler(pipe.bind.samplers[SMP_tile_edge_canvas_smp])
	sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.bind.index_buffer)
	free(pipe)
}

@(private = "file")
TILE_EDGE_BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
TILE_EDGE_BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}
