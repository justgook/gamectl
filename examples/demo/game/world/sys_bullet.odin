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
			case .ChangeDirection, .ChangeSpeed:
				if moves_with_bullet_velocity {
					vel^ = bullet_velocity_from_state(pew)
				}
			case .Accel:
				if moves_with_bullet_velocity {
					bullet_apply_accel(vel, cmd.horizontal, cmd.vertical)
				}
			case .Vanish, .Done:
				delete_entity = true
				host.info("delete", "entity", entity)
			}
		}
		delete(cmds)

		if delete_entity {
			append(&deletes, entity)
			continue
		}

		if moves_with_bullet_velocity {
			pos.x += vel.x
			pos.y += vel.y
		}

		// host.info("THE BULLET", "pos", pos)
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
		logic.add_component(&w.enemy_hit, child, shape.Circle{radius = 20 * UNIT})
	}
}
