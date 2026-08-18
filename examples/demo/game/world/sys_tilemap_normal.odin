package world

import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"
import "logic"

Tilemap_Normal_Pipe :: struct {
	pip:             sg.Pipeline,
	bind:            sg.Bindings,
	normal_tex_size: [2]f32,
	lut_tex_size:    [2]f32,
}

sys_tilemap_normal :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {
	if w.tilemap.count < 1 {
		return
	}

	pipe := w.tilemap_normal_pipe
	camera_pos := camera_get_render_position(&w.cam)
	camera_zoom := camera_get_render_zoom(&w.cam)

	instances: [MAX_TILEMAPS]Tilemap_Instance
	view := logic.view(&w.position, &w.tilemap)
	instance_count := 0
	for _, pos, tilemap in logic.each(&view) {
		assert(instance_count < MAX_TILEMAPS)
		instances[instance_count] = Tilemap_Instance {
			pos        = to_pixelf(pos^),
			tile_size  = tilemap.tile_size,
			tileset_uv = tilemap.tileset_uv,
			lut_uv     = tilemap.lut_uv,
			parallax   = tilemap.parallax,
			repeat     = tilemap.repeat,
		}
		instance_count += 1
	}

	vs_params := Tilemap_Normal_Vs_Params {
		ortho           = ortho^,
		normal_tex_size = pipe.normal_tex_size,
		lut_tex_size    = pipe.lut_tex_size,
		camera_pos      = camera_pos,
		viewport_size   = w.cam.viewport,
		camera_zoom     = camera_zoom,
	}

	sg.update_buffer(
		pipe.bind.vertex_buffers[1],
		{ptr = &instances[0], size = c.size_t(instance_count * size_of(Tilemap_Instance))},
	)
	sg.apply_pipeline(pipe.pip)
	sg.apply_bindings(pipe.bind)
	sg.apply_uniforms(UB_tilemap_normal_vs_params, {ptr = &vs_params, size = size_of(vs_params)})
	sg.draw(0, 6, instance_count)
}

tilemap_normal_init :: proc(normal_atlas_tex, lut_tex: sg.Image) -> ^Tilemap_Normal_Pipe {
	pipe := new(Tilemap_Normal_Pipe)

	pipe.bind.samplers[SMP_tilemap_normal_normal_smp] = sg.make_sampler(
		{min_filter = .NEAREST, mag_filter = .NEAREST, wrap_u = .CLAMP_TO_EDGE, wrap_v = .CLAMP_TO_EDGE},
	)
	pipe.bind.samplers[SMP_tilemap_normal_lut_smp] = sg.make_sampler(
		{min_filter = .NEAREST, mag_filter = .NEAREST, wrap_u = .CLAMP_TO_EDGE, wrap_v = .CLAMP_TO_EDGE},
	)
	pipe.bind.views[VIEW_tilemap_normal_normal_tex] = sg.make_view({texture = {image = normal_atlas_tex}})
	pipe.bind.views[VIEW_tilemap_normal_lut_tex] = sg.make_view({texture = {image = lut_tex}})

	normal_desc := sg.query_image_desc(normal_atlas_tex)
	lut_desc := sg.query_image_desc(lut_tex)
	pipe.normal_tex_size = {f32(normal_desc.width), f32(normal_desc.height)}
	pipe.lut_tex_size = {f32(lut_desc.width), f32(lut_desc.height)}

	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &TILEMAP_NORMAL_BASE_VERTICES, size = size_of(TILEMAP_NORMAL_BASE_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &TILEMAP_NORMAL_BASE_INDICES, size = size_of(TILEMAP_NORMAL_BASE_INDICES)},
		},
	)
	pipe.bind.vertex_buffers[1] = sg.make_buffer(
		{usage = {vertex_buffer = true, stream_update = true}, size = MAX_TILEMAPS * size_of(Tilemap_Instance)},
	)

	pipeline_desc := sg.Pipeline_Desc {
		shader = sg.make_shader(tilemap_normal_shader_desc(sg.query_backend())),
		index_type = .UINT16,
		cull_mode = .NONE,
		layout = {
			buffers = {1 = {step_func = .PER_INSTANCE}},
			attrs = {
				ATTR_tilemap_normal_tilemap_normal_pos = {format = .FLOAT2, buffer_index = 0},
				ATTR_tilemap_normal_tilemap_normal_inst_pos = {format = .FLOAT2, buffer_index = 1},
				ATTR_tilemap_normal_tilemap_normal_inst_tile_size = {format = .FLOAT2, buffer_index = 1},
				ATTR_tilemap_normal_tilemap_normal_inst_tileset_uv = {format = .FLOAT4, buffer_index = 1},
				ATTR_tilemap_normal_tilemap_normal_inst_lut_uv = {format = .FLOAT4, buffer_index = 1},
				ATTR_tilemap_normal_tilemap_normal_inst_parallax = {format = .FLOAT2, buffer_index = 1},
				ATTR_tilemap_normal_tilemap_normal_inst_repeat = {format = .FLOAT2, buffer_index = 1},
			},
		},
	}
	// Replace the target pixel instead of alpha blending: normal alpha is
	// reserved for material/specular data, not coverage.
	pipe.pip = sg.make_pipeline(pipeline_desc)
	return pipe
}

tilemap_normal_cleanup :: proc(pipe: ^Tilemap_Normal_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_sampler(pipe.bind.samplers[SMP_tilemap_normal_normal_smp])
	sg.destroy_sampler(pipe.bind.samplers[SMP_tilemap_normal_lut_smp])
	sg.destroy_view(pipe.bind.views[VIEW_tilemap_normal_normal_tex])
	sg.destroy_view(pipe.bind.views[VIEW_tilemap_normal_lut_tex])
	sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.bind.vertex_buffers[1])
	sg.destroy_buffer(pipe.bind.index_buffer)
	free(pipe)
}

@(private = "file")
TILEMAP_NORMAL_BASE_VERTICES := [?][2]f32{{-0.5, -0.5}, {-0.5, 0.5}, {0.5, -0.5}, {0.5, 0.5}}

@(private = "file")
TILEMAP_NORMAL_BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}
