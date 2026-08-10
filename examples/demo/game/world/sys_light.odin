package world

import "../host"
import sg "../sokol/gfx"
import "core:c"
import "core:math/linalg"
import "logic"

Light :: struct {
	pos:   [2]f32,
	color: [4]f32,
}

Light_Shadow_Caster :: struct {
	pos: [4]f32,
}

Light_Pipe :: struct {
	pip:    sg.Pipeline,
	bind:   sg.Bindings,
	shadow: ^Shadow_Pipe,
}

@(private = "file")
Shadow_Pipe :: struct {
	pip:  sg.Pipeline,
	bind: sg.Bindings,
}

mock_light :: proc(w: ^World) {
	mouseLight := create_entity(w)
	logic.add_component(&w.light, mouseLight, Light{color = {1, 1, 1, 1}})
	logic.add_component(&w.position, mouseLight, Position{})

	//shadow casters
	logic.add_component(&w.light_shadow, create_entity(w), Light_Shadow_Caster{pos = {128, 128, 192, 144}})
	logic.add_component(&w.light_shadow, create_entity(w), Light_Shadow_Caster{pos = {128, 144, 192, 128}})
	logic.add_component(&w.light_shadow, create_entity(w), Light_Shadow_Caster{pos = {48, 128, 112, 144}})
	logic.add_component(&w.light_shadow, create_entity(w), Light_Shadow_Caster{pos = {48, 144, 112, 128}})
	logic.add_component(&w.light_shadow, create_entity(w), Light_Shadow_Caster{pos = {208, 96, 272, 144 - 32}})
	logic.add_component(&w.light_shadow, create_entity(w), Light_Shadow_Caster{pos = {208, 112, 272, 96}})

}

sys_light :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {
	if w.mouse_btn.just_down {
		mouseLight := create_entity(w)
		ll := Light {
			color = {1, 1, 1, 1},
			pos   = screen_to_world(&w.cam, window_to_screen({w.mouse.x, w.mouse.y}), w.cam.viewport),
		}

		logic.add_component(&w.light, mouseLight, ll)
		host.info("CREATE LIGHT", "p", ll.pos)
	}

	view: logic.View2(Position, Light) = logic.view(&w.position, &w.light)
	for _, _, light in logic.each(&view) {
		light.pos = screen_to_world(&w.cam, window_to_screen({w.mouse.x, w.mouse.y}), w.cam.viewport)
		break
	}

	lighting_draw(
		w.light_pipe,
		w.light.count,
		&w.light.components,
		w.light_shadow.count,
		&w.light_shadow.components,
		ortho,
	)

	view2 := logic.view(&w.light_shadow)
	for id, shadow in logic.each(&view2) {
		debug_collision_add_line2(shadow.pos, {1.0, 0.0, 0.0, 1.0})
	}
}


LIGHT_RENDER_MAX :: 256
LIGHT_SHADOW_RENDER_MAX :: 8192


@(private = "file")
BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

light_init :: proc() -> ^Light_Pipe {
	pipe := light_pipe_init()
	pipe.shadow = shadow_pipe_init()
	return pipe
}

light_cleanup :: proc(pipe: ^Light_Pipe) {
	sg.destroy_pipeline(pipe.pip)
	sg.destroy_buffer(pipe.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.bind.index_buffer)

	sg.destroy_pipeline(pipe.shadow.pip)
	sg.destroy_buffer(pipe.shadow.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.shadow.bind.vertex_buffers[1])
	sg.destroy_buffer(pipe.shadow.bind.index_buffer)

	free(pipe.shadow)
	free(pipe)
}

@(private = "file")
shadow_pipe_init :: proc() -> ^Shadow_Pipe {
	pipe := new(Shadow_Pipe)

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
			size = LIGHT_SHADOW_RENDER_MAX * size_of(Light_Shadow_Caster),
		},
	)

	pipeline_desc: sg.Pipeline_Desc = {
		shader = sg.make_shader(light_shadow_shader_desc(sg.query_backend())),
		// cull_mode = .BACK,
		cull_mode = .NONE, // shadow can cast to all sides
		depth = {compare = .LESS_EQUAL, write_enabled = true},
		index_type = .UINT16,
		layout = {
			buffers = {1 = {step_func = .PER_INSTANCE}},
			attrs = {
				ATTR_light_shadow_light_shadow_pos = {format = .FLOAT2, buffer_index = 0},
				ATTR_light_shadow_light_shadow_inst_pos = {format = .FLOAT4, buffer_index = 1},
			},
		},
	}

	pipeline_desc.colors[0].write_mask = .NONE

	pipe.pip = sg.make_pipeline(pipeline_desc)
	return pipe

}

@(private = "file")
light_pipe_init :: proc() -> ^Light_Pipe {
	pipe := new(Light_Pipe)

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

	pipeline_desc: sg.Pipeline_Desc = {
		shader = sg.make_shader(light_shader_desc(sg.query_backend())),
		cull_mode = .BACK,
		depth = {compare = .LESS_EQUAL, write_enabled = true},
		index_type = .UINT16,
		layout = {attrs = {ATTR_light_light_pos = {format = .FLOAT2, buffer_index = 0}}},
	}

	pipeline_desc.colors[0].blend = {
		enabled          = true,
		src_factor_rgb   = .ONE,
		dst_factor_rgb   = .ONE,
		op_rgb           = .ADD,
		src_factor_alpha = .ZERO,
		dst_factor_alpha = .ONE,
		op_alpha         = .ADD,
	}


	pipe.pip = sg.make_pipeline(pipeline_desc)

	return pipe
}

@(private = "file")
LIGHT_DEPTH_STEP :: 1.0 / f32(LIGHT_RENDER_MAX * 2 + 2)

@(private = "file")
lighting_draw :: proc(
	pipe: ^Light_Pipe,
	light_count: int,
	lights: ^[LIGHT_RENDER_MAX]Light,
	shadow_count: int,
	shadows: ^[LIGHT_SHADOW_RENDER_MAX]Light_Shadow_Caster,
	ortho: ^linalg.Matrix4f32,
) {
	if light_count < 1 {
		return
	}

	if shadow_count > 0 {
		sg.update_buffer(
			pipe.shadow.bind.vertex_buffers[1],
			{ptr = shadows, size = c.size_t(shadow_count * size_of(Light_Shadow_Caster))},
		)
	}

	for light_index in 0 ..< light_count {
		light := lights[light_index]
		light_depth := -f32(light_index * 2) * LIGHT_DEPTH_STEP
		shadow_depth := light_depth - LIGHT_DEPTH_STEP

		if shadow_count > 0 {
			shadow_params := Light_Shadow_Vs_Params {
				ortho         = ortho^,
				viewport_size = {GAME_RESOLUTION_WIDTH, GAME_RESOLUTION_HEIGHT},
				light_pos     = light.pos,
				depth         = shadow_depth,
			}
			sg.apply_pipeline(pipe.shadow.pip)
			sg.apply_bindings(pipe.shadow.bind)
			sg.apply_uniforms(UB_light_shadow_vs_params, {ptr = &shadow_params, size = size_of(shadow_params)})
			sg.draw(0, 6, shadow_count)
		}

		light_params := Light_Vs_Params {
			ortho         = ortho^,
			viewport_size = {GAME_RESOLUTION_WIDTH, GAME_RESOLUTION_HEIGHT},
			light_pos     = light.pos,
			light_color   = light.color,
			depth         = light_depth,
		}
		sg.apply_pipeline(pipe.pip)
		sg.apply_bindings(pipe.bind)
		sg.apply_uniforms(UB_light_vs_params, {ptr = &light_params, size = size_of(light_params)})
		sg.draw(0, 6, 1)
	}
}
