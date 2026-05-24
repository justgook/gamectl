package slope

import "../../grid"
import "../../shape"

Config :: struct {
	enabled:        bool,
	max_rise:      int,
	max_run:       int,
	snap_up:       int,
	snap_down:     int,
	ground_stick:  int,
}

Ground_Result :: struct {
	ok:       bool,
	delta_y:  int,
	normal:   [2]int,
}

Refresh_Ground :: proc(
	g: ^grid.Grid,
	pos: ^[2]i32,
	vel: ^[2]i32,
	collider: ^shape.Capsule,
	cfg: Config,
) -> Ground_Result {
	if vel.y > 0 {
		return {}
	}

	snap_up, snap_down := ground_snap(cfg, collider)
	offsets := [3]int{0, collider.radius, -collider.radius}
	return find_ground_delta_for_offsets(g, pos, collider, cfg, offsets, snap_up, snap_down)
}

Follow_Ground :: proc(
	g: ^grid.Grid,
	old_pos: ^[2]i32,
	pos: ^[2]i32,
	vel: ^[2]i32,
	collider: ^shape.Capsule,
	cfg: Config,
) -> Ground_Result {
	step_snap := slope_step_snap(vel, cfg) + slope_support_snap(collider, cfg)
	offsets := [3]int{}
	if vel.x > 0 {
		offsets = {collider.radius, 0, -collider.radius}
	} else {
		offsets = {-collider.radius, 0, collider.radius}
	}

	for offset in offsets {
		old_x := int(old_pos.x) + collider.x + offset
		new_x := int(pos.x) + collider.x + offset

		segment, old_ground_y, ok := find_walkable_ground_at_x(
			g,
			old_pos,
			collider,
			cfg,
			old_x,
			step_snap,
			step_snap,
		)
		if !ok || abs(segment.w - segment.y) == 0 {
			continue
		}

		new_ground_y, contact_ok := Segment_Y_At_X(segment, new_x)
		if !contact_ok {
			continue
		}

		slope_delta := new_ground_y - old_ground_y
		if slope_delta > step_snap || slope_delta < -step_snap {
			continue
		}

		return {
			ok = true,
			delta_y = int(old_pos.y) + slope_delta - int(pos.y),
			normal = Segment_Up_Normal(segment),
		}
	}

	for offset in offsets {
		result := find_walkable_ground_delta(
			g,
			pos,
			collider,
			cfg,
			int(pos.x) + collider.x + offset,
			step_snap,
			step_snap,
		)
		if result.ok {
			return result
		}
	}

	return {}
}

Stick_To_Ground :: proc(
	g: ^grid.Grid,
	pos: ^[2]i32,
	collider: ^shape.Capsule,
	cfg: Config,
) -> Ground_Result {
	snap_up, snap_down := ground_snap(cfg, collider)
	offsets := [3]int{0, collider.radius, -collider.radius}
	return find_ground_delta_for_offsets(g, pos, collider, cfg, offsets, snap_up, snap_down)
}

Is_Walkable_Ground_Segment :: proc(segment: ^[4]int, cfg: Config) -> bool {
	normal := segment_left_normal(segment)
	if normal.y <= 0 {
		return false
	}

	dx := abs(segment.z - segment.x)
	dy := abs(segment.w - segment.y)
	if dx == 0 {
		return false
	}
	if dy == 0 {
		return true
	}
	if !cfg.enabled {
		return false
	}
	return dy * cfg.max_run <= dx * cfg.max_rise
}

Segment_Up_Normal :: proc(segment: ^[4]int) -> [2]int {
	normal := segment_left_normal(segment)
	if normal.y < 0 {
		normal.x = -normal.x
		normal.y = -normal.y
	}
	return normal
}

Segment_Y_At_X :: proc(segment: ^[4]int, x: int) -> (int, bool) {
	min_x := min(segment.x, segment.z)
	max_x := max(segment.x, segment.z)
	if x < min_x || x > max_x {
		return 0, false
	}
	if segment.x == segment.z {
		return 0, false
	}
	return segment.y + (x - segment.x) * (segment.w - segment.y) / (segment.z - segment.x), true
}

@(private = "file")
ground_snap :: proc(cfg: Config, collider: ^shape.Capsule) -> (snap_up, snap_down: int) {
	snap_up = cfg.ground_stick
	snap_down = cfg.ground_stick
	if cfg.enabled {
		support_snap := slope_support_snap(collider, cfg)
		snap_up = max(snap_up, cfg.snap_up + support_snap)
		snap_down = max(snap_down, cfg.snap_down + support_snap)
	}
	return
}

@(private = "file")
find_ground_delta_for_offsets :: proc(
	g: ^grid.Grid,
	pos: ^[2]i32,
	collider: ^shape.Capsule,
	cfg: Config,
	offsets: [3]int,
	snap_up: int,
	snap_down: int,
) -> Ground_Result {
	for offset in offsets {
		result := find_walkable_ground_delta(
			g,
			pos,
			collider,
			cfg,
			int(pos.x) + collider.x + offset,
			snap_up,
			snap_down,
		)
		if result.ok {
			return result
		}
	}
	return {}
}

@(private = "file")
find_walkable_ground_at_x :: proc(
	g: ^grid.Grid,
	pos: ^[2]i32,
	collider: ^shape.Capsule,
	cfg: Config,
	support_x: int,
	snap_up: int,
	snap_down: int,
) -> (segment: ^[4]int, contact_y: int, ok: bool) {
	bounds := capsule_local_aabb(collider)
	bottom := int(pos.y) + bounds.y
	probe := [4]int {
		int(pos.x) + bounds.x,
		bottom - snap_down,
		int(pos.x) + bounds.z,
		bottom + snap_up,
	}
	found := grid.query_aabb(g, &probe)
	defer delete(found)

	best_delta := snap_up + snap_down + 1
	best_segment: ^[4]int = nil
	best_contact_y := 0
	for floor in found {
		if !Is_Walkable_Ground_Segment(floor, cfg) {
			continue
		}

		candidate_y, contact_ok := Segment_Y_At_X(floor, support_x)
		if !contact_ok {
			continue
		}

		candidate_delta := candidate_y - bottom
		if candidate_delta > snap_up || candidate_delta < -snap_down {
			continue
		}
		if abs(candidate_delta) < abs(best_delta) {
			best_delta = candidate_delta
			best_segment = floor
			best_contact_y = candidate_y
		}
	}

	if best_segment != nil {
		return best_segment, best_contact_y, true
	}
	return nil, 0, false
}

@(private = "file")
find_walkable_ground_delta :: proc(
	g: ^grid.Grid,
	pos: ^[2]i32,
	collider: ^shape.Capsule,
	cfg: Config,
	support_x: int,
	snap_up: int,
	snap_down: int,
) -> Ground_Result {
	segment, contact_y, ok := find_walkable_ground_at_x(g, pos, collider, cfg, support_x, snap_up, snap_down)
	if !ok {
		return {}
	}
	bounds := capsule_local_aabb(collider)
	bottom := int(pos.y) + bounds.y
	return {ok = true, delta_y = contact_y - bottom, normal = Segment_Up_Normal(segment)}
}

@(private = "file")
slope_support_snap :: proc(collider: ^shape.Capsule, cfg: Config) -> int {
	assert(cfg.max_run > 0)
	return collider.radius * cfg.max_rise / cfg.max_run + 1
}

@(private = "file")
slope_step_snap :: proc(vel: ^[2]i32, cfg: Config) -> int {
	assert(cfg.max_run > 0)
	velocity_snap := int(abs(vel.x)) * cfg.max_rise / cfg.max_run + 1
	return max(max(cfg.snap_up, cfg.snap_down), velocity_snap)
}

@(private = "file")
capsule_local_aabb :: proc(capsule: ^shape.Capsule) -> [4]int {
	half_height := capsule.height / 2
	return {
		capsule.x - capsule.radius,
		capsule.y - half_height - capsule.radius,
		capsule.x + capsule.radius,
		capsule.y + half_height + capsule.radius,
	}
}

@(private = "file")
segment_left_normal :: proc(segment: ^[4]int) -> [2]int {
	dx := segment.z - segment.x
	dy := segment.w - segment.y
	return {-dy, dx}
}
