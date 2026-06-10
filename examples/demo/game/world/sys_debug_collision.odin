package world

import "../host"
import sg "../sokol/gfx"
import "core:c"
import "core:math"
import "core:math/linalg"
import "logic"
import "shape"

DEBUG_COLLISION_MAX_VERTICES :: 65536
DEBUG_COLLISION_CIRCLE_SEGMENTS :: 24
DEBUG_COLLISION_NORMAL_LENGTH :: 16.0

Debug_Collision_Vertex :: struct {
	pos:   [2]f32,
	color: [4]f32,
}

@(private = "file")
Debug_Collision_State :: struct {
	initialized: bool,
	pip:         sg.Pipeline,
	bind:        sg.Bindings,
	vertices:    [dynamic]Debug_Collision_Vertex,
}

@(private = "file")
debug_collision_state: Debug_Collision_State

sys_debug_collision :: proc(w: ^World, ortho: ^linalg.Matrix4f32) {
	debug_collision_init_once()
	debug_collision_clear()

	// Static world collision.
	for &segment in w.segments {
		debug_collision_add_segment_subpixel(&segment, {1.0, 0.9, 0.1, 1.0})
	}

	// Physical movement colliders, status-colored from Platformer state when present.
	collider_view := logic.view(&w.position, &w.collider)
	for entity, pos, collider in logic.each(&collider_view) {
		color := [4]f32{0.0, 0.9, 1.0, 1.0}
		if platformer, ok := logic.get_component(&w.platformer, entity); ok {
			if platformer.hit_ceiling {
				color = {1.0, 0.1, 0.1, 1.0}
			} else if platformer.on_wall {
				color = {1.0, 0.45, 0.0, 1.0}
			} else if platformer.on_ground {
				color = {0.1, 1.0, 0.2, 1.0}
			}
		}
		debug_collision_add_capsule_at_position(pos, collider, color)
	}

	// Combat hurt / hit volumes.
	debug_collision_add_capsule_storage(&w.position, &w.player_hurt, {0.1, 0.35, 1.0, 1.0})
	debug_collision_add_circle_storage(&w.position, &w.player_hit, {0.65, 0.9, 1.0, 1.0})
	debug_collision_add_capsule_storage(&w.position, &w.enemy_hurt, {0.75, 0.2, 1.0, 1.0})
	debug_collision_add_circle_storage(&w.position, &w.enemy_hit, {1.0, 0.1, 0.1, 1.0})

	// Platformer contact normals.
	platformer_view := logic.view(&w.position, &w.platformer)
	for entity, pos, platformer in logic.each(&platformer_view) {
		collider, has_collider := logic.get_component(&w.collider, entity)
		assert(has_collider)

		center := debug_collision_capsule_center_px(pos, collider)
		if platformer.on_ground {
			start := [2]f32{center.x, to_pixelf(int(pos.y) + collider.y - collider.height / 2 - collider.radius)}
			debug_collision_add_normal(start, platformer.ground_normal, {0.1, 1.0, 0.2, 1.0})
		}
		if platformer.on_wall {
			bounds := debug_collision_capsule_bounds_subpixel(pos, collider)
			start_x := bounds.z if platformer.wall_normal.x < 0 else bounds.x
			debug_collision_add_normal({start_x, center.y}, platformer.wall_normal, {1.0, 0.45, 0.0, 1.0})
		}
	}

	debug_collision_flush(ortho)
}

@(private = "file")
debug_collision_init_once :: proc() {
	if debug_collision_state.initialized {
		return
	}

	debug_collision_state.vertices = make([dynamic]Debug_Collision_Vertex, 0, 4096)
	debug_collision_state.bind.vertex_buffers[0] = sg.make_buffer(
		{
			usage = {vertex_buffer = true, stream_update = true},
			size = DEBUG_COLLISION_MAX_VERTICES * size_of(Debug_Collision_Vertex),
		},
	)

	pipeline_desc := sg.Pipeline_Desc {
		shader = sg.make_shader(debug_collision_shader_desc(sg.query_backend())),
		primitive_type = .LINES,
		cull_mode = .NONE,
		depth = {compare = .ALWAYS, write_enabled = false},
		layout = {
			attrs = {
				ATTR_debug_collision_debug_collision_pos = {format = .FLOAT2, buffer_index = 0},
				ATTR_debug_collision_debug_collision_color0 = {format = .FLOAT4, buffer_index = 0},
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

	debug_collision_state.pip = sg.make_pipeline(pipeline_desc)
	debug_collision_state.initialized = true
}

@(private = "file")
debug_collision_clear :: proc() {
	clear(&debug_collision_state.vertices)
}

@(private = "file")
debug_collision_flush :: proc(ortho: ^linalg.Matrix4f32) {
	count := len(debug_collision_state.vertices)
	if count == 0 {
		return
	}
	assert(count <= DEBUG_COLLISION_MAX_VERTICES)

	params := Debug_Collision_Vs_Params {
		ortho = ortho^,
	}
	sg.update_buffer(
		debug_collision_state.bind.vertex_buffers[0],
		{ptr = raw_data(debug_collision_state.vertices[:]), size = c.size_t(count * size_of(Debug_Collision_Vertex))},
	)
	sg.apply_pipeline(debug_collision_state.pip)
	sg.apply_bindings(debug_collision_state.bind)
	sg.apply_uniforms(UB_debug_collision_vs_params, {ptr = &params, size = size_of(params)})
	sg.draw(0, i32(count), 1)
}

@(private = "file")
debug_collision_add_line :: proc(a, b: [2]f32, color: [4]f32) {
	append(&debug_collision_state.vertices, Debug_Collision_Vertex{pos = a, color = color})
	append(&debug_collision_state.vertices, Debug_Collision_Vertex{pos = b, color = color})
}

@(private = "file")
debug_collision_add_segment_subpixel :: proc(segment: ^[4]int, color: [4]f32) {
	debug_collision_add_line(
		{to_pixelf(segment.x), to_pixelf(segment.y)},
		{to_pixelf(segment.z), to_pixelf(segment.w)},
		color,
	)
}

@(private = "file")
debug_collision_add_circle :: proc(center: [2]f32, radius: f32, color: [4]f32) {
	angle_step := 2.0 * math.PI / f32(DEBUG_COLLISION_CIRCLE_SEGMENTS)
	for i := 0; i < DEBUG_COLLISION_CIRCLE_SEGMENTS; i += 1 {
		a0 := f32(i) * angle_step
		a1 := f32(i + 1) * angle_step
		debug_collision_add_line(
			{center.x + radius * math.cos(a0), center.y + radius * math.sin(a0)},
			{center.x + radius * math.cos(a1), center.y + radius * math.sin(a1)},
			color,
		)
	}
}

@(private = "file")
debug_collision_add_capsule_at_position :: proc(pos: ^Position, capsule: ^shape.Capsule, color: [4]f32) {
	center := debug_collision_capsule_center_px(pos, capsule)
	radius := to_pixelf(capsule.radius)
	height := to_pixelf(capsule.height)
	half_height := height * 0.5
	top_y := center.y + half_height
	bottom_y := center.y - half_height
	left_x := center.x - radius
	right_x := center.x + radius

	debug_collision_add_line({left_x, bottom_y}, {left_x, top_y}, color)
	debug_collision_add_line({right_x, bottom_y}, {right_x, top_y}, color)

	angle_step := math.PI / f32(DEBUG_COLLISION_CIRCLE_SEGMENTS / 2)
	for i := 0; i < DEBUG_COLLISION_CIRCLE_SEGMENTS / 2; i += 1 {
		a0 := f32(i) * angle_step
		a1 := f32(i + 1) * angle_step
		debug_collision_add_line(
			{center.x + radius * math.cos(a0), top_y + radius * math.sin(a0)},
			{center.x + radius * math.cos(a1), top_y + radius * math.sin(a1)},
			color,
		)
	}
	for i := DEBUG_COLLISION_CIRCLE_SEGMENTS / 2; i < DEBUG_COLLISION_CIRCLE_SEGMENTS; i += 1 {
		a0 := f32(i) * angle_step
		a1 := f32(i + 1) * angle_step
		debug_collision_add_line(
			{center.x + radius * math.cos(a0), bottom_y + radius * math.sin(a0)},
			{center.x + radius * math.cos(a1), bottom_y + radius * math.sin(a1)},
			color,
		)
	}
}

@(private = "file")
debug_collision_add_capsule_storage :: proc(
	position: ^logic.Component_Storage(Position),
	storage: ^logic.Component_Storage(shape.Capsule),
	color: [4]f32,
) {
	view := logic.view(position, storage)
	for _, pos, capsule in logic.each(&view) {
		debug_collision_add_capsule_at_position(pos, capsule, color)
	}
}

@(private = "file")
debug_collision_add_circle_storage :: proc(
	position: ^logic.Component_Storage(Position),
	storage: ^logic.Component_Storage(shape.Circle),
	color: [4]f32,
) {
	view := logic.view(position, storage)
	for _, pos, circle in logic.each(&view) {
		// host.info("debug_circle", "circle", pos)
		center := [2]f32{to_pixelf(int(pos.x) + circle.x), to_pixelf(int(pos.y) + circle.y)}
		debug_collision_add_circle(center, to_pixelf(circle.radius), color)
	}
}

@(private = "file")
debug_collision_add_normal :: proc(start: [2]f32, normal: [2]int, color: [4]f32) {
	length := math.sqrt(f32(normal.x * normal.x + normal.y * normal.y))
	if length == 0 {
		return
	}
	end := start + [2]f32{f32(normal.x) / length, f32(normal.y) / length} * DEBUG_COLLISION_NORMAL_LENGTH
	debug_collision_add_line(start, end, color)
	debug_collision_add_circle(end, 1.5, color)
}

@(private = "file")
debug_collision_capsule_center_px :: proc(pos: ^Position, capsule: ^shape.Capsule) -> [2]f32 {
	return {to_pixelf(int(pos.x) + capsule.x), to_pixelf(int(pos.y) + capsule.y)}
}

@(private = "file")
debug_collision_capsule_bounds_subpixel :: proc(pos: ^Position, capsule: ^shape.Capsule) -> [4]f32 {
	half_height := capsule.height / 2
	return {
		to_pixelf(int(pos.x) + capsule.x - capsule.radius),
		to_pixelf(int(pos.y) + capsule.y - half_height - capsule.radius),
		to_pixelf(int(pos.x) + capsule.x + capsule.radius),
		to_pixelf(int(pos.y) + capsule.y + half_height + capsule.radius),
	}
}
