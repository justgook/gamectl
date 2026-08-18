package world

import "../host"
import sg "../sokol/gfx"
import "core:c"
import "core:math"
import "core:math/linalg"
import "logic"

// TODO(light, Part 5 roadmap):
// - [x] 1. Add per-light intensity and an HDR light target, then apply exposure/tone mapping in the composite pass.
// - [x] 2. Load the 1:1 normal atlas and render tilemaps through their dedicated normal-map system/shader.
// - [x] 3. Add the normal canvas to the render graph and expose it in the four-canvas debug display.
// - [x] 4. Add light height and sample the normal canvas for diffuse normal-mapped tile lighting.
// - [x] 5. Make opaque sprites without authored normal maps write a neutral normal, without covering transparent pixels.
// - [x] 6. Read specular strength from the normal atlas alpha channel and add view-dependent highlights.
// - [ ] 7. After the lighting model is stable, evaluate bloom and tile-edge lighting as separate post effects.

Light_Component_Storage :: logic.Component_Storage_Fixed(Light, LIGHT_RENDER_MAX)
Light_Shadow_Component_Storage :: logic.Component_Storage_Fixed(Light_Shadow_Caster, LIGHT_SHADOW_RENDER_MAX)

Light :: struct {
	pos:               [2]f32,
	color:             [4]f32,
	radius:            f32,
	height:            f32,
	intensity:         f32,
	direction_radians: f32,
	inner_fov_radians: f32,
	outer_fov_radians: f32,
	shadow_softness:   f32,
}

light_point :: proc(pos: [2]f32, color: [4]f32, radius, height, intensity: f32, shadow_softness: f32 = 0) -> Light {
	assert(radius > 0)
	assert(height > 0)
	assert(intensity > 0)
	assert(shadow_softness >= 0 && shadow_softness <= 1)
	return {
		pos = pos,
		color = color,
		radius = radius,
		height = height,
		intensity = intensity,
		shadow_softness = shadow_softness,
	}
}

light_spot :: proc(
	pos: [2]f32,
	color: [4]f32,
	radius: f32,
	height: f32,
	intensity: f32,
	direction_radians: f32,
	inner_fov_radians: f32,
	outer_fov_radians: f32,
	shadow_softness: f32 = 0,
) -> Light {
	assert(radius > 0)
	assert(height > 0)
	assert(intensity > 0)
	assert(shadow_softness >= 0 && shadow_softness <= 1)
	assert(inner_fov_radians > 0)
	assert(inner_fov_radians < outer_fov_radians)
	assert(outer_fov_radians < math.TAU)
	return {
		pos = pos,
		color = color,
		radius = radius,
		height = height,
		intensity = intensity,
		direction_radians = direction_radians,
		inner_fov_radians = inner_fov_radians,
		outer_fov_radians = outer_fov_radians,
		shadow_softness = shadow_softness,
	}
}

Light_Shadow_Caster :: struct {
	pos: [4]f32,
}

Light_Pipe :: struct {
	light:          ^Light_Draw_Pipe,
	shadow:         ^Shadow_Pipe,
	composite_pip:  sg.Pipeline,
	composite_bind: sg.Bindings,
	ambient:        f32,
	exposure:       f32,
}

@(private = "file")
Light_Draw_Pipe :: struct {
	pip:  sg.Pipeline,
	bind: sg.Bindings,
}

@(private = "file")
Shadow_Pipe :: struct {
	pip:  sg.Pipeline,
	bind: sg.Bindings,
}

mock_light :: proc(w: ^World) {
	mouseLight := create_entity(w)
	logic.add_component(
		&w.light,
		mouseLight,
		light_spot({}, {1, 1, 1, 1}, 128, 64, 2.0, 0, math.PI / 3, math.PI / 2, 0.2),
	)
	logic.add_component(&w.position, mouseLight, Position{})

	// Fixed point lights keep the lighting buffers useful for deterministic
	// screenshots even when the mouse-controlled spotlight is off-screen.
	logic.add_component(&w.light, create_entity(w), light_point({96, 72}, {1.0, 0.35, 0.2, 1.0}, 88, 48, 2.5))
	logic.add_component(&w.light, create_entity(w), light_point({208, 136}, {0.25, 0.55, 1.0, 1.0}, 104, 56, 2.5))
	logic.add_component(&w.light, create_entity(w), light_point({320, 64}, {0.65, 0.25, 1.0, 1.0}, 80, 44, 2.5))

	// Shadow casters
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
		light := light_point(
			screen_to_world(&w.cam, window_to_screen({w.mouse.x, w.mouse.y}), w.cam.viewport),
			{1, 1, 1, 1},
			128,
			64,
			2.0,
		)

		logic.add_component(&w.light, mouseLight, light)
		host.info("CREATE LIGHT", "p", light.pos)
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
		&w.cam,
	)

	view2 := logic.view(&w.light_shadow)
	for _, shadow in logic.each(&view2) {
		debug_collision_add_line2(shadow.pos, {1.0, 0.0, 0.0, 1.0})
	}
}


@(private = "file")
LIGHT_RENDER_MAX :: 256
@(private = "file")
LIGHT_SHADOW_RENDER_MAX :: 8192

@(private = "file")
LIGHT_BASE_VERTICES := [?][2]f32{{-.5, -.5}, {-.5, .5}, {.5, -.5}, {.5, .5}}

@(private = "file")
LIGHT_BASE_INDICES := [?]u16{0, 1, 2, 2, 1, 3}

light_init :: proc(color_texture, light_texture, normal_texture: sg.View) -> ^Light_Pipe {
	pipe := new(Light_Pipe)
	pipe.light = light_draw_pipe_init(normal_texture, color_texture)
	pipe.shadow = shadow_pipe_init()
	light_composite_init(pipe, color_texture, light_texture)
	pipe.ambient = 0.01
	pipe.exposure = 1.0
	return pipe
}

light_cleanup :: proc(pipe: ^Light_Pipe) {
	sg.destroy_pipeline(pipe.composite_pip)
	sg.destroy_sampler(pipe.composite_bind.samplers[SMP_light_composite_canvas_smp])

	sg.destroy_pipeline(pipe.light.pip)
	sg.destroy_sampler(pipe.light.bind.samplers[SMP_light_canvas_smp])
	sg.destroy_buffer(pipe.light.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.light.bind.index_buffer)

	sg.destroy_pipeline(pipe.shadow.pip)
	sg.destroy_buffer(pipe.shadow.bind.vertex_buffers[0])
	sg.destroy_buffer(pipe.shadow.bind.vertex_buffers[1])
	sg.destroy_buffer(pipe.shadow.bind.index_buffer)

	free(pipe.light)
	free(pipe.shadow)
	free(pipe)
}

@(private = "file")
shadow_pipe_init :: proc() -> ^Shadow_Pipe {
	pipe := new(Shadow_Pipe)

	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &LIGHT_BASE_VERTICES, size = size_of(LIGHT_BASE_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &LIGHT_BASE_INDICES, size = size_of(LIGHT_BASE_INDICES)},
		},
	)
	pipe.bind.vertex_buffers[1] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, stream_update = true},
			size = LIGHT_SHADOW_RENDER_MAX * size_of(Light_Shadow_Caster),
		},
	)

	pipe.pip = sg.make_pipeline(
		{
			shader = sg.make_shader(light_shadow_shader_desc(sg.query_backend())),
			cull_mode = .NONE,
			depth = {pixel_format = .NONE},
			index_type = .UINT16,
			layout = {
				buffers = {1 = {step_func = .PER_INSTANCE}},
				attrs = {
					ATTR_light_shadow_light_shadow_pos = {format = .FLOAT2, buffer_index = 0},
					ATTR_light_shadow_light_shadow_inst_pos = {format = .FLOAT4, buffer_index = 1},
				},
			},
			colors = {
				0 = {
					pixel_format = .RGBA16F,
					write_mask = .A,
					blend = {enabled = true, src_factor_alpha = .ONE, dst_factor_alpha = .ONE, op_alpha = .MAX},
				},
			},
		},
	)
	return pipe
}

@(private = "file")
light_draw_pipe_init :: proc(normal_texture, color_texture: sg.View) -> ^Light_Draw_Pipe {
	pipe := new(Light_Draw_Pipe)

	pipe.bind.views[VIEW_light_normal_tex] = normal_texture
	pipe.bind.views[VIEW_light_color_tex] = color_texture
	pipe.bind.samplers[SMP_light_canvas_smp] = sg.make_sampler(
		{min_filter = .NEAREST, mag_filter = .NEAREST, wrap_u = .CLAMP_TO_EDGE, wrap_v = .CLAMP_TO_EDGE},
	)
	pipe.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, immutable = true},
			data = {ptr = &LIGHT_BASE_VERTICES, size = size_of(LIGHT_BASE_VERTICES)},
		},
	)
	pipe.bind.index_buffer = sg.make_buffer(
		{
			usage = {index_buffer = true, immutable = true},
			data = {ptr = &LIGHT_BASE_INDICES, size = size_of(LIGHT_BASE_INDICES)},
		},
	)

	pipeline_desc: sg.Pipeline_Desc = {
		shader = sg.make_shader(light_shader_desc(sg.query_backend())),
		cull_mode = .NONE,
		depth = {pixel_format = .NONE},
		index_type = .UINT16,
		layout = {attrs = {ATTR_light_light_pos = {format = .FLOAT2, buffer_index = 0}}},
	}
	pipeline_desc.colors[0].pixel_format = .RGBA16F
	pipeline_desc.colors[0].blend = {
		enabled          = true,
		src_factor_rgb   = .ONE_MINUS_DST_ALPHA,
		dst_factor_rgb   = .ONE,
		op_rgb           = .ADD,
		src_factor_alpha = .ZERO,
		dst_factor_alpha = .ZERO,
		op_alpha         = .ADD,
	}
	pipe.pip = sg.make_pipeline(pipeline_desc)
	return pipe
}

@(private = "file")
light_composite_init :: proc(pipe: ^Light_Pipe, color_texture, light_texture: sg.View) {
	pipe.composite_bind.vertex_buffers[0] = pipe.light.bind.vertex_buffers[0]
	pipe.composite_bind.index_buffer = pipe.light.bind.index_buffer
	pipe.composite_bind.views[VIEW_light_composite_color_tex] = color_texture
	pipe.composite_bind.views[VIEW_light_composite_light_tex] = light_texture
	pipe.composite_bind.samplers[SMP_light_composite_canvas_smp] = sg.make_sampler({})

	pipeline_desc: sg.Pipeline_Desc = {
		shader = sg.make_shader(light_composite_shader_desc(sg.query_backend())),
		cull_mode = .NONE,
		depth = {pixel_format = .DEPTH_STENCIL, compare = .ALWAYS, write_enabled = false},
		index_type = .UINT16,
		layout = {attrs = {ATTR_light_composite_light_composite_pos = {format = .FLOAT2, buffer_index = 0}}},
	}
	pipe.composite_pip = sg.make_pipeline(pipeline_desc)
}

lighting_draw :: proc(
	pipe: ^Light_Pipe,
	light_count: int,
	lights: ^[LIGHT_RENDER_MAX]Light,
	shadow_count: int,
	shadows: ^[LIGHT_SHADOW_RENDER_MAX]Light_Shadow_Caster,
	ortho: ^linalg.Matrix4f32,
	cam: ^Camera,
) {
	assert(light_count <= LIGHT_RENDER_MAX)
	assert(shadow_count <= LIGHT_SHADOW_RENDER_MAX)
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
		assert(light.radius > 0)
		assert(light.height > 0)
		assert(light.intensity > 0)
		assert(light.shadow_softness >= 0 && light.shadow_softness <= 1)
		point_light := light.inner_fov_radians == 0 && light.outer_fov_radians == 0
		spot_light :=
			light.inner_fov_radians > 0 &&
			light.inner_fov_radians < light.outer_fov_radians &&
			light.outer_fov_radians < math.TAU
		assert(point_light || spot_light)

		light_screen_pos := world_to_screen(cam, light.pos)
		left := int(math.floor(max(0, light_screen_pos.x - light.radius)))
		right := int(math.ceil(min(f32(GAME_RESOLUTION_WIDTH), light_screen_pos.x + light.radius)))
		bottom := int(math.floor(max(0, light_screen_pos.y - light.radius)))
		top := int(math.ceil(min(f32(GAME_RESOLUTION_HEIGHT), light_screen_pos.y + light.radius)))
		if right <= left || top <= bottom {
			continue
		}

		// Shadow extrusion is otherwise effectively infinite. Restrict both the
		// shadow mask and light draw to the same screen-space bounding box.
		sg.apply_scissor_rect(left, bottom, right - left, top - bottom, false)

		if shadow_count > 0 {
			shadow_params := Light_Shadow_Vs_Params {
				ortho           = ortho^,
				light_pos       = light.pos,
				shadow_softness = light.shadow_softness,
			}
			sg.apply_pipeline(pipe.shadow.pip)
			sg.apply_bindings(pipe.shadow.bind)
			sg.apply_uniforms(UB_light_shadow_vs_params, {ptr = &shadow_params, size = size_of(shadow_params)})
			sg.draw(0, 6, shadow_count)
		}

		light_params := Light_Vs_Params {
			ortho             = ortho^,
			viewport_size     = {GAME_RESOLUTION_WIDTH, GAME_RESOLUTION_HEIGHT},
			light_pos         = light.pos,
			light_color       = light.color,
			light_radius      = light.radius,
			light_height      = light.height,
			light_intensity   = light.intensity,
			direction_radians = light.direction_radians,
			inner_fov_radians = light.inner_fov_radians,
			outer_fov_radians = light.outer_fov_radians,
		}
		sg.apply_pipeline(pipe.light.pip)
		sg.apply_bindings(pipe.light.bind)
		sg.apply_uniforms(UB_light_vs_params, {ptr = &light_params, size = size_of(light_params)})
		sg.draw(0, 6, 1)
	}
}

lighting_composite :: proc(pipe: ^Light_Pipe) {
	params := Light_Composite_Fs_Params {
		ambient  = pipe.ambient,
		exposure = pipe.exposure,
	}
	sg.apply_pipeline(pipe.composite_pip)
	sg.apply_bindings(pipe.composite_bind)
	sg.apply_uniforms(UB_light_composite_fs_params, {ptr = &params, size = size_of(params)})
	sg.draw(0, 6, 1)
}
