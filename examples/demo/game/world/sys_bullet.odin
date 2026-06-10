package world
import "../host"
import "bullet"
import "logic"


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

sys_bullet :: proc(w: ^World) {
	ctx := bullet.Tick_Context {
		// BulletML variables.
		rank          = 0.5,
		rand          = 0.3,

		// Caller-provided aiming direction for `aim` directions.
		aim_direction = 10,
	}
	// bullet.State
	view := logic.view(&w.bullet, &w.position, &w.velocity)

	for entity, pew, pos, vel in logic.each(&view) {
		cmds := bullet.tick(pew, ctx)
		for &cmd, _ in cmds {
			switch cmd.kind {
			case .Spawn:
				child := create_entity(w)
				logic.add_component(&w.bullet, child, cmd.child_state)
				logic.add_component(&w.position, child, pos^)
				logic.add_component(&w.velocity, child, Velocity{})
			case .ChangeDirection:
			case .ChangeSpeed:
			case .Accel:
			case .Vanish, .Done:
				entity_delete(w, entity)
			}

			host.info("sys_nullet", "result", cmd.kind)
		}
		host.info("sys_nullet", "result", len(cmds))
	}

}
