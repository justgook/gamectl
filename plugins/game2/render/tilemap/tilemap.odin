package tilemap

import "core:c"
import "core:math/linalg"
import sg "../../sokol/gfx"

MAX_TILEMAPS :: 64
BASE_VERTICES := [?][2]f32{{-0.5, -0.5}, {-0.5, 0.5}, {0.5, -0.5}, {0.5, 0.5}}
BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

Instance :: struct {
	pos:        [2]f32,
	tile_size:  [2]f32,
	tileset_uv: [4]f32,
	lut_uv:     [4]f32,
}

Renderer :: struct {
	pip:              sg.Pipeline,
	bind:             sg.Bindings,
	tileset_view:     sg.View,
	lut_view:         sg.View,
	tileset_sampler:  sg.Sampler,
	lut_sampler:      sg.Sampler,
	count:            int,
	instances:        [MAX_TILEMAPS]Instance,
	tileset_tex_size: [2]f32,
	lut_tex_size:     [2]f32,
	owned:            bool,
}

init :: proc(tileset_tex, lut_tex: sg.Image, tileset_width, tileset_height, lut_width, lut_height: i32) -> Renderer {
	renderer: Renderer
	renderer.tileset_sampler = sg.make_sampler({})
	renderer.lut_sampler = sg.make_sampler({})
	renderer.tileset_view = sg.make_view({texture = {image = tileset_tex}})
	renderer.lut_view = sg.make_view({texture = {image = lut_tex}})
	renderer.bind.views[VIEW_tileset_tex] = renderer.tileset_view
	renderer.bind.views[VIEW_lut_tex] = renderer.lut_view
	renderer.bind.samplers[SMP_tileset_smp] = renderer.tileset_sampler
	renderer.bind.samplers[SMP_lut_smp] = renderer.lut_sampler
	renderer.tileset_tex_size = {f32(tileset_width), f32(tileset_height)}
	renderer.lut_tex_size = {f32(lut_width), f32(lut_height)}

	renderer.bind.vertex_buffers[0] = sg.make_buffer({
		usage = {vertex_buffer = true, immutable = true},
		data = {ptr = &BASE_VERTICES, size = size_of(BASE_VERTICES)},
	})
	renderer.bind.index_buffer = sg.make_buffer({
		usage = {index_buffer = true, immutable = true},
		data = {ptr = &BASE_INDICES, size = size_of(BASE_INDICES)},
	})
	renderer.bind.vertex_buffers[1] = sg.make_buffer({
		usage = {vertex_buffer = true, stream_update = true},
		size = MAX_TILEMAPS * size_of(Instance),
	})

	pipeline_desc := sg.Pipeline_Desc{
		shader = sg.make_shader(tilemap_shader_desc(sg.query_backend())),
		index_type = .UINT16,
		cull_mode = .NONE,
		layout = {
			buffers = {1 = {step_func = .PER_INSTANCE}},
			attrs = {
				ATTR_tilemap_pos = {format = .FLOAT2, buffer_index = 0},
				ATTR_tilemap_inst_pos = {format = .FLOAT2, buffer_index = 1},
				ATTR_tilemap_inst_tile_size = {format = .FLOAT2, buffer_index = 1},
				ATTR_tilemap_inst_tileset_uv = {format = .FLOAT4, buffer_index = 1},
				ATTR_tilemap_inst_lut_uv = {format = .FLOAT4, buffer_index = 1},
			},
		},
	}
	pipeline_desc.colors[0].blend = {
		enabled = true,
		src_factor_rgb = .SRC_ALPHA,
		dst_factor_rgb = .ONE_MINUS_SRC_ALPHA,
		op_rgb = .ADD,
		src_factor_alpha = .ONE,
		dst_factor_alpha = .ONE_MINUS_SRC_ALPHA,
		op_alpha = .ADD,
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
	sg.destroy_sampler(renderer.tileset_sampler)
	sg.destroy_sampler(renderer.lut_sampler)
	sg.destroy_view(renderer.tileset_view)
	sg.destroy_view(renderer.lut_view)
	renderer^ = {}
}

set_tileset_texture :: proc(renderer: ^Renderer, texture: sg.Image, width, height: i32) {
	renderer.tileset_tex_size = {f32(width), f32(height)}
	if renderer.tileset_view.id != 0 {
		sg.destroy_view(renderer.tileset_view)
	}
	renderer.tileset_view = sg.make_view({texture = {image = texture}})
	renderer.bind.views[VIEW_tileset_tex] = renderer.tileset_view
}

set_lut_texture :: proc(renderer: ^Renderer, texture: sg.Image, width, height: i32) {
	renderer.lut_tex_size = {f32(width), f32(height)}
	if renderer.lut_view.id != 0 {
		sg.destroy_view(renderer.lut_view)
	}
	renderer.lut_view = sg.make_view({texture = {image = texture}})
	renderer.bind.views[VIEW_lut_tex] = renderer.lut_view
}

set_textures :: proc(renderer: ^Renderer, tileset_tex, lut_tex: sg.Image, tileset_width, tileset_height, lut_width, lut_height: i32) {
	set_tileset_texture(renderer, tileset_tex, tileset_width, tileset_height)
	set_lut_texture(renderer, lut_tex, lut_width, lut_height)
}

reset :: proc(renderer: ^Renderer) {
	renderer.count = 0
}

push :: proc(renderer: ^Renderer, pos, tile_size: [2]f32, tileset_uv, lut_uv: [4]f32) {
	if renderer.count >= MAX_TILEMAPS {
		return
	}
	renderer.instances[renderer.count] = {
		pos = pos,
		tile_size = tile_size,
		tileset_uv = tileset_uv,
		lut_uv = lut_uv,
	}
	renderer.count += 1
}

ortho :: proc(width, height: f32) -> linalg.Matrix4f32 {
	return linalg.matrix_ortho3d_f32(0, width, height, 0, -1, 1)
}

draw :: proc(renderer: ^Renderer, framebuffer_width, framebuffer_height: i32) {
	if renderer.count <= 0 {
		return
	}
	vs_params := Vs_Params{
		ortho = ortho(f32(framebuffer_width), f32(framebuffer_height)),
		tileset_tex_size = renderer.tileset_tex_size,
		lut_tex_size = renderer.lut_tex_size,
	}
	sg.update_buffer(renderer.bind.vertex_buffers[1], {ptr = &renderer.instances, size = c.size_t(renderer.count * size_of(Instance))})
	sg.apply_pipeline(renderer.pip)
	sg.apply_bindings(renderer.bind)
	sg.apply_uniforms(UB_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, 6, renderer.count)
}
