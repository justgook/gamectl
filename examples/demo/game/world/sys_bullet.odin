package world
import "../host"
import "bullet"
import "logic"


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

			case .Vanish:
				entity_delete(w, entity)
			case .ChangeDirection:
			case .ChangeSpeed:
			case .Accel:
			case .Done:
				entity_delete(w, entity)
			}

			host.info("sys_nullet", "result", cmd.kind)
		}
		host.info("sys_nullet", "result", len(cmds))
	}

}
