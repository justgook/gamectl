package world
import "../host"
import "bullet"
import "core:math"
import "logic"
import "shape"


bullet_delete_component :: proc(storage: ^logic.Component_Storage(bullet.State), entity: logic.Entity) {
	if state, ok := logic.get_component(storage, entity); ok {
		bullet.destroy_state(state)
		logic.delete_component(storage, entity)
	}
}

bullet_destroy_state_storage :: proc(storage: ^logic.Component_Storage(bullet.State)) {
	for &state in storage.components {
		bullet.destroy_state(&state)
	}
	logic.destroy_storage(storage)
}

@(private = "file")
Bullet_Spawn :: struct {
	position: Position,
	velocity: Velocity,
	state:    bullet.State,
}

Bullet_Motion :: struct {
	direction_value:       f64,
	direction_target:      f64,
	direction_step:        f64,
	direction_remaining:   int,
	speed_value:           f64,
	speed_target:          f64,
	speed_step:            f64,
	speed_remaining:       int,
	accel_horizontal_step: f64,
	accel_vertical_step:   f64,
	accel_remaining:       int,
}

@(private = "file")
bullet_velocity :: proc(direction, speed: f64) -> Velocity {
	// BulletML directions use 0 degrees as up and positive rotation toward right.
	// Game space is y-up, so up is +Y.
	radians := direction * math.PI / 180.0
	return Velocity{i32(math.sin(radians) * speed * UNIT), i32(math.cos(radians) * speed * UNIT)}
}

@(private = "file")
bullet_velocity_from_state :: proc(state: ^bullet.State) -> Velocity {
	return bullet_velocity(state.direction, state.speed)
}

@(private = "file")
bullet_apply_accel :: proc(vel: ^Velocity, horizontal, vertical: f64) {
	vel.x += i32(horizontal * UNIT)
	vel.y += i32(vertical * UNIT)
}

@(private = "file")
bullet_motion_get_or_add :: proc(w: ^World, entity: logic.Entity) -> ^Bullet_Motion {
	if motion, ok := logic.get_component(&w.bullet_motion, entity); ok {
		return motion
	}
	logic.add_component(&w.bullet_motion, entity, Bullet_Motion{})
	motion, ok := logic.get_component(&w.bullet_motion, entity)
	assert(ok)
	return motion
}

@(private = "file")
bullet_motion_current_direction :: proc(motion: ^Bullet_Motion, fallback: f64) -> f64 {
	if motion != nil && motion.direction_remaining > 0 {
		return motion.direction_value
	}
	return fallback
}

@(private = "file")
bullet_motion_current_speed :: proc(motion: ^Bullet_Motion, fallback: f64) -> f64 {
	if motion != nil && motion.speed_remaining > 0 {
		return motion.speed_value
	}
	return fallback
}

@(private = "file")
bullet_motion_set_direction :: proc(motion: ^Bullet_Motion, start, target: f64, term: int) {
	assert(term > 0)
	motion.direction_value = start
	motion.direction_target = target
	motion.direction_step = (target - start) / f64(term)
	motion.direction_remaining = term
}

@(private = "file")
bullet_motion_set_speed :: proc(motion: ^Bullet_Motion, start, target: f64, term: int) {
	assert(term > 0)
	motion.speed_value = start
	motion.speed_target = target
	motion.speed_step = (target - start) / f64(term)
	motion.speed_remaining = term
}

@(private = "file")
bullet_motion_set_accel :: proc(motion: ^Bullet_Motion, horizontal, vertical: f64, term: int) {
	assert(term > 0)
	motion.accel_horizontal_step = horizontal / f64(term)
	motion.accel_vertical_step = vertical / f64(term)
	motion.accel_remaining = term
}

@(private = "file")
bullet_motion_step :: proc(motion: ^Bullet_Motion, state: ^bullet.State, vel: ^Velocity) {
	base_changed := false
	if motion.direction_remaining > 0 {
		motion.direction_value += motion.direction_step
		motion.direction_remaining -= 1
		if motion.direction_remaining == 0 {
			motion.direction_value = motion.direction_target
		}
		base_changed = true
	}
	if motion.speed_remaining > 0 {
		motion.speed_value += motion.speed_step
		motion.speed_remaining -= 1
		if motion.speed_remaining == 0 {
			motion.speed_value = motion.speed_target
		}
		base_changed = true
	}
	if base_changed {
		direction := bullet_motion_current_direction(motion, state.direction)
		speed := bullet_motion_current_speed(motion, state.speed)
		vel^ = bullet_velocity(direction, speed)
	}
	if motion.accel_remaining > 0 {
		bullet_apply_accel(vel, motion.accel_horizontal_step, motion.accel_vertical_step)
		motion.accel_remaining -= 1
	}
}

@(private = "file")
bullet_motion_is_active :: proc(motion: ^Bullet_Motion) -> bool {
	return motion.direction_remaining > 0 || motion.speed_remaining > 0 || motion.accel_remaining > 0
}

sys_bullet :: proc(w: ^World) {
	ctx := bullet.Tick_Context {
		// BulletML variables.
		rank          = 0.5,
		rand          = 0.3,

		// Caller-provided aiming direction for `aim` directions.
		aim_direction = 10,
	}

	spawns := make([dynamic]Bullet_Spawn)
	defer delete(spawns)
	deletes := make([dynamic]logic.Entity)
	defer delete(deletes)

	view := logic.view(&w.bullet, &w.position, &w.velocity)
	for entity, pew, pos, vel in logic.each(&view) {
		delete_entity := false
		moves_with_bullet_velocity := !logic.has_component(&w.platformer, entity)

		motion, has_motion := logic.get_component(&w.bullet_motion, entity)

		cmds := bullet.tick(pew, ctx)
		for &cmd in cmds {
			switch cmd.kind {
			case .Spawn:
				append(
					&spawns,
					Bullet_Spawn {
						position = pos^,
						velocity = bullet_velocity(cmd.direction, cmd.speed),
						state = cmd.child_state,
					},
				)
			case .ChangeDirection:
				if moves_with_bullet_velocity {
					if cmd.term > 0 {
						if !has_motion {
							motion = bullet_motion_get_or_add(w, entity)
							has_motion = true
						}
						start := bullet_motion_current_direction(motion, cmd.previous_direction)
						bullet_motion_set_direction(motion, start, cmd.direction, cmd.term)
					} else {
						speed := bullet_motion_current_speed(motion, pew.speed)
						vel^ = bullet_velocity(pew.direction, speed)
					}
				}
			case .ChangeSpeed:
				if moves_with_bullet_velocity {
					if cmd.term > 0 {
						if !has_motion {
							motion = bullet_motion_get_or_add(w, entity)
							has_motion = true
						}
						start := bullet_motion_current_speed(motion, cmd.previous_speed)
						bullet_motion_set_speed(motion, start, cmd.speed, cmd.term)
					} else {
						direction := bullet_motion_current_direction(motion, pew.direction)
						vel^ = bullet_velocity(direction, pew.speed)
					}
				}
			case .Accel:
				if moves_with_bullet_velocity {
					if cmd.term > 0 {
						if !has_motion {
							motion = bullet_motion_get_or_add(w, entity)
							has_motion = true
						}
						bullet_motion_set_accel(motion, cmd.horizontal, cmd.vertical, cmd.term)
					} else {
						bullet_apply_accel(vel, cmd.horizontal, cmd.vertical)
					}
				}
			case .Vanish:
				delete_entity = true
				host.info("delete", "entity", entity)
			case .Done:
			}
		}
		delete(cmds)

		if moves_with_bullet_velocity && has_motion {
			bullet_motion_step(motion, pew, vel)
			if !bullet_motion_is_active(motion) {
				logic.delete_component(&w.bullet_motion, entity)
			}
		}

		if delete_entity {
			append(&deletes, entity)
			continue
		}

		if moves_with_bullet_velocity {
			pos.x += vel.x
			pos.y += vel.y
			// host.info("THE BULLET", "pos", pos)
		}

	}

	for entity in deletes {
		entity_delete(w, entity)
	}

	if len(spawns) > 0 {
		assert(len(w.uv) > 418)
	}

	for spawn in spawns {
		child := create_entity(w)
		logic.add_component(&w.bullet, child, spawn.state)
		logic.add_component(&w.position, child, spawn.position)
		logic.add_component(&w.velocity, child, spawn.velocity)
		logic.add_component(&w.sprite, child, Sprite{opacity = 1, uv = w.uv[418]})
		logic.add_component(&w.enemy_hit, child, shape.Circle{radius = 4 * UNIT})
	}
}
