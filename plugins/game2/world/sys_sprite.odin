package world

import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"
import "logic"

// Flip flags for sprite rendering (matches Tiled TMX format)
// Bit 0 = Horizontal flip, Bit 1 = Vertical flip, Bit 2 = Anti-diagonal flip
// Flip :: distinct u8
// FLIP_NONE :: Flip(0) // No transformation
// FLIP_H :: Flip(1) // Horizontal flip
// FLIP_V :: Flip(2) // Vertical flip
// FLIP_HV :: Flip(3) // Horizontal + Vertical (180° rotation)
// FLIP_D :: Flip(4) // Anti-diagonal flip (transpose)
// FLIP_DH :: Flip(5) // Anti-diagonal + Horizontal (90° CW)
// FLIP_DV :: Flip(6) // Anti-diagonal + Vertical (90° CCW)
// FLIP_DHV :: Flip(7) // Anti-diagonal + H + V
//

sys_sprite :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {
	view: logic.View2(Position, Sprite) = logic.view(&w.position, &w.sprite)
	for id, pos, s in logic.each(&view) {
		s.pos = to_pixelf(pos^)
	}

	pipe := w.sprite_pipe
	the_count := w.sprite.count

	if the_count < 1 {
		return
	}

	vs_params := Sprite_Vs_Params {
		ortho = ortho^,
	}


	// update instance data
	sg.update_buffer(pipe.bind.vertex_buffers[1], {ptr = &w.sprite, size = c.size_t(the_count * size_of(Sprite))})

	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_sprite_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, 6, the_count)
}


/// THE OLD STUFF
SPRITE_RENDER_MAX :: 8192

@(private = "file")
BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

Sprite :: struct {
	pos:       [2]f32,
	z:         f32,
	opacity:   f32,
	flip:      u8,
	size:      [2]f32,
	uv:        [4]f32,
	color_add: [4]f32, // RGB + intensity for blink/flash effects
	offset:    [2]i32, // TODO implement in shader
}

Sprite_Pipe :: struct {
	pip:  sg.Pipeline,
	bind: sg.Bindings,
	// atlas_size: [2]f32,
}

sprites_cleanup :: proc(pipe: ^Sprite_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	free(pipe)
}

sprites_init :: proc(tex0: sg.Image) -> ^Sprite_Pipe {
	pipe := new(Sprite_Pipe)
	pipe.bind.samplers[SMP_sprite_default_sampler] = sg.make_sampler({})
	pipe.bind.views[VIEW_sprite_tex0] = sg.make_view({texture = {image = tex0}})

	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = sg.Buffer_Usage{vertex_buffer = true, immutable = true},
			data = {ptr = &BASE_VERTICES, size = size_of(BASE_VERTICES)},
		},
	)

	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = sg.Buffer_Usage{index_buffer = true, immutable = true},
			data = {ptr = &BASE_INDICES, size = size_of(BASE_INDICES)},
		},
	)

	pipe.bind.vertex_buffers[1] = sg.make_buffer(
		{
			usage = sg.Buffer_Usage{vertex_buffer = true, stream_update = true},
			size = SPRITE_RENDER_MAX * size_of(Sprite),
		},
	)

	pipeline_desc: sg.Pipeline_Desc = {
		shader = sg.make_shader(sprite_shader_desc(sg.query_backend())),
		cull_mode = .BACK,
		depth = {compare = .LESS_EQUAL, write_enabled = true},
		index_type = .UINT16,
		layout = {
			buffers = {1 = {step_func = .PER_INSTANCE}},
			attrs = {
				ATTR_sprite_sprite_pos = {format = .FLOAT2, buffer_index = 0},
				ATTR_sprite_sprite_inst_pos = {format = .FLOAT2, buffer_index = 1},
				ATTR_sprite_sprite_inst_z = {format = .FLOAT, buffer_index = 1},
				ATTR_sprite_sprite_inst_opacity = {format = .FLOAT, buffer_index = 1},
				ATTR_sprite_sprite_inst_flip_flags = {format = .UBYTE4, buffer_index = 1},
				ATTR_sprite_sprite_inst_size = {format = .FLOAT2, buffer_index = 1},
				ATTR_sprite_sprite_inst_uv = {format = .FLOAT4, buffer_index = 1},
				ATTR_sprite_sprite_inst_color_add = {format = .FLOAT4, buffer_index = 1},
				ATTR_sprite_sprite_inst_offset = {format = .INT2, buffer_index = 1},
			},
		},
	}

	blend_state: sg.Blend_State = {
		enabled          = true,
		src_factor_rgb   = .SRC_ALPHA,
		dst_factor_rgb   = .ONE_MINUS_SRC_ALPHA,
		op_rgb           = .ADD,
		src_factor_alpha = .ONE,
		dst_factor_alpha = .ONE_MINUS_SRC_ALPHA,
		op_alpha         = .ADD,
	}

	pipeline_desc.colors[0] = {
		blend = blend_state,
	}

	pipe.pip = sg.make_pipeline(pipeline_desc)

	return pipe
}
