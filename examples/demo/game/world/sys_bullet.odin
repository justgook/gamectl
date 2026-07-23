package world
import "../data_bullet"
import "../director"
import "bullet"
import "core:math"
import "logic"
import "shape"


Bullet_Side :: enum u8 {
	Player,
	Enemy,
}

Bullet_Ref :: struct {
	pattern_id: u32,
	side:       Bullet_Side,
}

Bullet :: struct {
	using state:   bullet.State,
	using motion:  Bullet_Motion,
	damage_source: director.Entity_Id,
	side:          Bullet_Side,
}

bullet_restart :: proc(pew: ^Bullet) {
	bullet.restart(pew)
}

bullet_component :: proc(
	pattern: ^data_bullet.Bullet_Pattern,
	damage_source: director.Entity_Id,
	side: Bullet_Side,
) -> Bullet {
	return Bullet{state = bullet.init_pattern_state(pattern, done = true), damage_source = damage_source, side = side}
}

bullet_delete_component :: proc(storage: ^logic.Component_Storage(Bullet), entity: logic.Entity) {
	if pew, ok := logic.get_component(storage, entity); ok {
		bullet.destroy_state(&pew.state)
		logic.delete_component(storage, entity)
	}
}

bullet_destroy_state_storage :: proc(storage: ^logic.Component_Storage(Bullet)) {
	for &pew in storage.components {
		bullet.destroy_state(&pew.state)
	}
	logic.destroy_storage(storage)
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

		cmds := bullet.tick(&pew.state, ctx)
		for &cmd in cmds {
			switch cmd.kind {
			case .Spawn:
				append(
					&spawns,
					Bullet_Spawn {
						position = pos^,
						velocity = bullet_velocity(cmd.direction, cmd.speed),
						state = cmd.child_state,
						damage_source = pew.damage_source,
						side = pew.side,
					},
				)
			case .ChangeDirection:
				if cmd.term > 0 {
					start := bullet_motion_current_direction(&pew.motion, cmd.previous_direction)
					bullet_motion_set_direction(&pew.motion, start, cmd.direction, cmd.term)
				} else {
					speed := bullet_motion_current_speed(&pew.motion, pew.state.speed)
					vel^ = bullet_velocity(pew.state.direction, speed)
				}
			case .ChangeSpeed:
				if cmd.term > 0 {
					start := bullet_motion_current_speed(&pew.motion, cmd.previous_speed)
					bullet_motion_set_speed(&pew.motion, start, cmd.speed, cmd.term)
				} else {
					direction := bullet_motion_current_direction(&pew.motion, pew.state.direction)
					vel^ = bullet_velocity(direction, pew.state.speed)
				}
			case .Accel:
				if cmd.term > 0 {
					bullet_motion_set_accel(&pew.motion, cmd.horizontal, cmd.vertical, cmd.term)
				} else {
					bullet_apply_accel(vel, cmd.horizontal, cmd.vertical)
				}
			case .Vanish:
				delete_entity = true
			case .Done:
			}
		}
		delete(cmds)

		bullet_motion_step(&pew.motion, &pew.state, vel)

		if delete_entity {
			append(&deletes, entity)
			continue
		}

	}

	for entity in deletes {
		entity_delete(w, entity)
	}


	for spawn in spawns {
		child := create_entity(w)
		logic.add_component(
			&w.bullet,
			child,
			Bullet{state = spawn.state, damage_source = spawn.damage_source, side = spawn.side},
		)
		logic.add_component(&w.position, child, spawn.position)
		logic.add_component(&w.velocity, child, spawn.velocity)
		logic.add_component(&w.sprite, child, Sprite{opacity = 1, uv = w.uv[100]})
		switch spawn.side {
		case .Player:
			logic.add_component(&w.player_hit, child, shape.Circle{radius = 4 * UNIT})
		case .Enemy:
			logic.add_component(&w.enemy_hit, child, shape.Circle{radius = 4 * UNIT})
		}
	}
}


@(private = "file")
Bullet_Spawn :: struct {
	position:      Position,
	velocity:      Velocity,
	state:         bullet.State,
	damage_source: director.Entity_Id,
	side:          Bullet_Side,
}

@(private = "file")
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
	return Velocity{i32(math.sin(radians) * speed * f64(UNIT)), i32(math.cos(radians) * speed * f64(UNIT))}
}

@(private = "file")
bullet_apply_accel :: proc(vel: ^Velocity, horizontal, vertical: f64) {
	vel.x += i32(horizontal * f64(UNIT))
	vel.y += i32(vertical * f64(UNIT))
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
