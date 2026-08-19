package world

import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"

Sprite_Normal_Pipe :: struct {
	pip:        sg.Pipeline,
	bind:       sg.Bindings,
	atlas_size: [2]f32,
}

sys_sprite_normal :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {
	sprite_instances_update(w)
	sprites_normal_draw(w.sprite_normal_pipe, w.sprite.count, &w.sprite.components, ortho)
}

sprites_normal_draw :: proc(
	pipe: ^Sprite_Normal_Pipe,
	count: int,
	sprites: ^[SPRITE_RENDER_MAX]Sprite,
	ortho: ^linalg.Matrix4f32,
) {
	assert(count <= SPRITE_RENDER_MAX)
	if count < 1 {
		return
	}

	vs_params := Sprite_Normal_Vs_Params {
		ortho      = ortho^,
		atlas_size = pipe.atlas_size,
	}

	sg.update_buffer(pipe.bind.vertex_buffers[1], {ptr = sprites, size = c.size_t(count * size_of(Sprite))})
	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_sprite_normal_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, 6, count)
}

sprite_normal_init :: proc(color_atlas, normal_atlas: sg.Image) -> ^Sprite_Normal_Pipe {
	pipe := new(Sprite_Normal_Pipe)
	color_desc := sg.query_image_desc(color_atlas)
	normal_desc := sg.query_image_desc(normal_atlas)
	assert(color_desc.width == normal_desc.width)
	assert(color_desc.height == normal_desc.height)
	pipe.atlas_size = {f32(color_desc.width), f32(color_desc.height)}
	pipe.bind.samplers[SMP_sprite_normal_atlas_smp] = sg.make_sampler(
		{min_filter = .NEAREST, mag_filter = .NEAREST, wrap_u = .CLAMP_TO_EDGE, wrap_v = .CLAMP_TO_EDGE},
	)
	pipe.bind.views[VIEW_sprite_normal_normal_tex] = sg.make_view({texture = {image = normal_atlas}})
	pipe.bind.views[VIEW_sprite_normal_color_tex] = sg.make_view({texture = {image = color_atlas}})

	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &SPRITE_NORMAL_BASE_VERTICES, size = size_of(SPRITE_NORMAL_BASE_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &SPRITE_NORMAL_BASE_INDICES, size = size_of(SPRITE_NORMAL_BASE_INDICES)},
		},
	)
	pipe.bind.vertex_buffers[1] = sg.make_buffer(
		{usage = {vertex_buffer = true, stream_update = true}, size = SPRITE_RENDER_MAX * size_of(Sprite)},
	)

	pipe.pip = sg.make_pipeline(
		{
			shader = sg.make_shader(sprite_normal_shader_desc(sg.query_backend())),
			cull_mode = .BACK,
			depth = {compare = .LESS_EQUAL, write_enabled = true},
			index_type = .UINT16,
			layout = {
				buffers = {1 = {step_func = .PER_INSTANCE}},
				attrs = {
					ATTR_sprite_normal_sprite_normal_pos = {format = .FLOAT2, buffer_index = 0},
					ATTR_sprite_normal_sprite_normal_inst_pos = {format = .FLOAT2, buffer_index = 1},
					ATTR_sprite_normal_sprite_normal_inst_z = {format = .FLOAT, buffer_index = 1},
					ATTR_sprite_normal_sprite_normal_inst_opacity = {format = .FLOAT, buffer_index = 1},
					ATTR_sprite_normal_sprite_normal_inst_flip_flags = {format = .UBYTE4, buffer_index = 1},
					ATTR_sprite_normal_sprite_normal_inst_uv = {format = .FLOAT4, buffer_index = 1},
					ATTR_sprite_normal_sprite_normal_inst_color_add = {format = .FLOAT4, buffer_index = 1},
					ATTR_sprite_normal_sprite_normal_inst_offset = {format = .INT2, buffer_index = 1},
				},
			},
		},
	)
	return pipe
}

sprite_normal_cleanup :: proc(pipe: ^Sprite_Normal_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_sampler(pipe.bind.samplers[SMP_sprite_normal_atlas_smp])
	sg.destroy_view(pipe.bind.views[VIEW_sprite_normal_normal_tex])
	sg.destroy_view(pipe.bind.views[VIEW_sprite_normal_color_tex])
	sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.bind.vertex_buffers[1])
	sg.destroy_buffer(pipe.bind.index_buffer)
	free(pipe)
}

@(private = "file")
SPRITE_NORMAL_BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
SPRITE_NORMAL_BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}
