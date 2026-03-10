package sprite

import sg "../../sokol/gfx"
import "core:c"
import "core:math/linalg"

MAX_SPRITES :: 128
BASE_VERTICES := [?][2]f32{{-0.5, -0.5}, {-0.5, 0.5}, {0.5, -0.5}, {0.5, 0.5}}
BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

Instance :: struct {
	pos:  [2]f32,
	size: [2]f32,
	uv:   [4]f32,
}

Renderer :: struct {
	pip:       sg.Pipeline,
	bind:      sg.Bindings,
	view:      sg.View,
	sampler:   sg.Sampler,
	count:     int,
	instances: [MAX_SPRITES]Instance,
	owned:     bool,
}

init :: proc(texture: sg.Image) -> Renderer {
	renderer: Renderer
	renderer.sampler = sg.make_sampler({})
	renderer.view = sg.make_view({texture = {image = texture}})
	renderer.bind.views[VIEW_tex0] = renderer.view
	renderer.bind.samplers[SMP_smp] = renderer.sampler
	renderer.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &BASE_VERTICES, size = size_of(BASE_VERTICES)},
		},
	)
	renderer.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &BASE_INDICES, size = size_of(BASE_INDICES)},
		},
	)
	renderer.bind.vertex_buffers[1] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, stream_update = true},
			size = MAX_SPRITES * size_of(Instance),
		},
	)

	pipeline_desc := sg.Pipeline_Desc {
		shader = sg.make_shader(sprite_shader_desc(sg.query_backend())),
		index_type = .UINT16,
		cull_mode = .NONE,
		layout = {
			buffers = {1 = {step_func = .PER_INSTANCE}},
			attrs = {
				ATTR_sprite_pos = {format = .FLOAT2, buffer_index = 0},
				ATTR_sprite_inst_pos = {format = .FLOAT2, buffer_index = 1},
				ATTR_sprite_inst_size = {format = .FLOAT2, buffer_index = 1},
				ATTR_sprite_inst_uv = {format = .FLOAT4, buffer_index = 1},
			},
		},
	}
	pipeline_desc.colors[0].blend = {
		enabled          = true,
		src_factor_rgb   = .SRC_ALPHA,
		dst_factor_rgb   = .ONE_MINUS_SRC_ALPHA,
		op_rgb           = .ADD,
		src_factor_alpha = .ONE,
		dst_factor_alpha = .ONE_MINUS_SRC_ALPHA,
		op_alpha         = .ADD,
	}
	renderer.pip = sg.make_pipeline(pipeline_desc)
	renderer.owned = true
	return renderer
}

shutdown :: proc(renderer: ^Renderer) {
	if !renderer.owned {
		return
	}
	sg.destroy_pipeline(renderer.pip)
	sg.destroy_buffer(renderer.bind.vertex_buffers[0])
	sg.destroy_buffer(renderer.bind.vertex_buffers[1])
	sg.destroy_buffer(renderer.bind.index_buffer)
	sg.destroy_sampler(renderer.sampler)
	sg.destroy_view(renderer.view)
	renderer^ = {}
}

reset :: proc(renderer: ^Renderer) {
	renderer.count = 0
}

push :: proc(renderer: ^Renderer, pos, size: [2]f32, uv: [4]f32) {
	if renderer.count >= MAX_SPRITES {
		return
	}
	renderer.instances[renderer.count] = {
		pos  = pos,
		size = size,
		uv   = uv,
	}
	renderer.count += 1
}

uv_from_pixels :: proc(x, y, w, h, atlas_width, atlas_height: int) -> [4]f32 {
	aw := f32(atlas_width)
	ah := f32(atlas_height)
	return {f32(x) / aw, f32(y) / ah, f32(x + w) / aw, f32(y + h) / ah}
}

ortho :: proc(width, height: f32) -> linalg.Matrix4f32 {
	return linalg.matrix_ortho3d_f32(0, width, height, 0, -1, 1)
}

draw :: proc(renderer: ^Renderer, framebuffer_width, framebuffer_height: i32) {
	if renderer.count <= 0 {
		return
	}
	vs_params := Vs_Params {
		ortho = ortho(f32(framebuffer_width), f32(framebuffer_height)),
	}
	sg.update_buffer(
		renderer.bind.vertex_buffers[1],
		{ptr = &renderer.instances, size = c.size_t(renderer.count * size_of(Instance))},
	)
	sg.apply_pipeline(renderer.pip)
	sg.apply_bindings(renderer.bind)
	sg.apply_uniforms(UB_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, 6, renderer.count)
}
