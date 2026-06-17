package world

import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"
import "logic"


MAX_TILEMAPS :: 64
@(private = "file")
BASE_VERTICES := [?][2]f32{{-0.5, -0.5}, {-0.5, 0.5}, {0.5, -0.5}, {0.5, 0.5}}
@(private = "file")
BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

Tilemap :: struct {
	pos:        [2]f32,
	tile_size:  [2]f32,
	tileset_uv: [4]f32,
	lut_uv:     [4]f32,
	parallax:   [2]f32,
	repeat:     [2]f32,
}

Tilemap_Instance :: struct {
	pos:        [2]f32,
	tile_size:  [2]f32,
	tileset_uv: [4]f32,
	lut_uv:     [4]f32,
	parallax:   [2]f32,
	repeat:     [2]f32,
}

Tilemap_Pipe :: struct {
	pip:              sg.Pipeline,
	bind:             sg.Bindings,
	tileset_tex_size: [2]f32,
	lut_tex_size:     [2]f32,
}

sys_tilemap :: proc(w: ^World, ortho: ^linalg.Matrix4f32) { 	// proc(renderer: ^Renderer, framebuffer_width, framebuffer_height: i32) {
	if w.tilemap.count < 1 {
		return
	}

	pipe := w.tilemap_pipe
	camera_pos := camera_get_render_position(&w.cam)
	camera_zoom := camera_get_render_zoom(&w.cam)

	instances: [MAX_TILEMAPS]Tilemap_Instance
	view := logic.view(&w.position, &w.tilemap)
	instance_count := 0
	for _, pos, t in logic.each(&view) {
		base_pos := to_pixelf(pos^)
		t.pos = base_pos
		instances[instance_count] = Tilemap_Instance{
			pos = base_pos,
			tile_size = t.tile_size,
			tileset_uv = t.tileset_uv,
			lut_uv = t.lut_uv,
			parallax = t.parallax,
			repeat = t.repeat,
		}
		instance_count += 1
	}

	vs_params := Tilemap_Vs_Params {
		ortho            = ortho^,
		tileset_tex_size = pipe.tileset_tex_size,
		lut_tex_size     = pipe.lut_tex_size,
		camera_pos       = camera_pos,
		viewport_size    = w.cam.viewport,
		camera_zoom      = camera_zoom,
	}

	sg.update_buffer(
		pipe.bind.vertex_buffers[1],
		{
			ptr = &instances[0],
			size = c.size_t(instance_count * size_of(Tilemap_Instance)),
		},
	)
	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_tilemap_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, 6, instance_count)
}

tilemap_init :: proc(atlas_tex, lut_tex: sg.Image) -> ^Tilemap_Pipe {
	pipe := new(Tilemap_Pipe)

	pipe.bind.samplers[SMP_tilemap_tileset_smp] = sg.make_sampler(
		{
			min_filter = .NEAREST,
			mag_filter = .NEAREST,
			wrap_u = .CLAMP_TO_EDGE,
			wrap_v = .CLAMP_TO_EDGE,
		},
	)
	pipe.bind.samplers[SMP_tilemap_lut_smp] = sg.make_sampler(
		{
			min_filter = .NEAREST,
			mag_filter = .NEAREST,
			wrap_u = .CLAMP_TO_EDGE,
			wrap_v = .CLAMP_TO_EDGE,
		},
	)

	pipe.bind.views[VIEW_tilemap_tileset_tex] = sg.make_view({texture = {image = atlas_tex}})
	pipe.bind.views[VIEW_tilemap_lut_tex] = sg.make_view({texture = {image = lut_tex}})

	atlas_desc := sg.query_image_desc(atlas_tex)
	lut_desc := sg.query_image_desc(lut_tex)
	pipe.tileset_tex_size = {f32(atlas_desc.width), f32(atlas_desc.height)}
	pipe.lut_tex_size = {f32(lut_desc.width), f32(lut_desc.height)}

	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &BASE_VERTICES, size = size_of(BASE_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &BASE_INDICES, size = size_of(BASE_INDICES)},
		},
	)
	pipe.bind.vertex_buffers[1] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, stream_update = true},
			size = MAX_TILEMAPS * size_of(Tilemap_Instance),
		},
	)

	pipeline_desc := sg.Pipeline_Desc {
		shader = sg.make_shader(tilemap_shader_desc(sg.query_backend())),
		index_type = .UINT16,
		cull_mode = .NONE,
		layout = {
			buffers = {1 = {step_func = .PER_INSTANCE}},
			attrs = {
				ATTR_tilemap_tilemap_pos = {format = .FLOAT2, buffer_index = 0},
				ATTR_tilemap_tilemap_inst_pos = {format = .FLOAT2, buffer_index = 1},
				ATTR_tilemap_tilemap_inst_tile_size = {format = .FLOAT2, buffer_index = 1},
				ATTR_tilemap_tilemap_inst_tileset_uv = {format = .FLOAT4, buffer_index = 1},
				ATTR_tilemap_tilemap_inst_lut_uv = {format = .FLOAT4, buffer_index = 1},
				ATTR_tilemap_tilemap_inst_parallax = {format = .FLOAT2, buffer_index = 1},
				ATTR_tilemap_tilemap_inst_repeat = {format = .FLOAT2, buffer_index = 1},
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
	pipe.pip = sg.make_pipeline(pipeline_desc)
	return pipe
}

tilemap_cleanup :: proc(renderer: ^Tilemap_Pipe) {
	sg.destroy_pipeline(renderer.pip)
	sg.destroy_sampler(renderer.bind.samplers[SMP_tilemap_tileset_smp])
	sg.destroy_sampler(renderer.bind.samplers[SMP_tilemap_lut_smp])
	sg.destroy_view(renderer.bind.views[VIEW_tilemap_tileset_tex])
	sg.destroy_view(renderer.bind.views[VIEW_tilemap_lut_tex])
	sg.destroy_buffer(renderer.bind.vertex_buffers[0])
	sg.destroy_buffer(renderer.bind.vertex_buffers[1])
	sg.destroy_buffer(renderer.bind.index_buffer)
	free(renderer)
}
