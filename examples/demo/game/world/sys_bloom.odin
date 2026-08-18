package world

import sg "../sokol/gfx"

Bloom_Pipe :: struct {
	pip:       sg.Pipeline,
	bind:      sg.Bindings,
	threshold: f32,
	knee:      f32,
}

sys_bloom :: proc(pipe: ^Bloom_Pipe) {
	params := Bloom_Fs_Params {
		texel_size = {1.0 / GAME_RESOLUTION_WIDTH, 1.0 / GAME_RESOLUTION_HEIGHT},
		threshold  = pipe.threshold,
		knee       = pipe.knee,
	}
	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_bloom_fs_params, {ptr = &params, size = size_of(params)})
	sg.draw(0, 6, 1)
}

bloom_init :: proc(light_texture: sg.View) -> ^Bloom_Pipe {
	pipe := new(Bloom_Pipe)
	pipe.threshold = 1.0
	pipe.knee = 0.5
	pipe.bind.views[VIEW_bloom_light_tex] = light_texture
	pipe.bind.samplers[SMP_bloom_light_smp] = sg.make_sampler(
		{min_filter = .LINEAR, mag_filter = .LINEAR, wrap_u = .CLAMP_TO_EDGE, wrap_v = .CLAMP_TO_EDGE},
	)
	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &BLOOM_BASE_VERTICES, size = size_of(BLOOM_BASE_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &BLOOM_BASE_INDICES, size = size_of(BLOOM_BASE_INDICES)},
		},
	)
	pipe.pip = sg.make_pipeline(
		{
			shader = sg.make_shader(bloom_shader_desc(sg.query_backend())),
			cull_mode = .NONE,
			depth = {pixel_format = .NONE},
			index_type = .UINT16,
			layout = {attrs = {ATTR_bloom_bloom_pos = {format = .FLOAT2, buffer_index = 0}}},
			colors = {0 = {pixel_format = .RGBA16F}},
		},
	)
	return pipe
}

bloom_cleanup :: proc(pipe: ^Bloom_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_sampler(pipe.bind.samplers[SMP_bloom_light_smp])
	sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.bind.index_buffer)
	free(pipe)
}

@(private = "file")
BLOOM_BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
BLOOM_BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}
