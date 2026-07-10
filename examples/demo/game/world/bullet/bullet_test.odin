#+build !freestanding
#+build !js
#+build !orca
#+test

package bullet

import "../../data_bullet"
import "core:testing"

@(private = "file")
test_number :: proc(value: f64) -> data_bullet.Expr {
	return data_bullet.Expr{kind = .Expr_Number, expr_number = data_bullet.Expr_Number(value)}
}

@(private = "file")
test_ref :: proc(index: int) -> data_bullet.Ref {
	return data_bullet.Ref{kind = .Ref_Index, ref_index = data_bullet.Ref_Index(index)}
}

@(private = "file")
test_absolute_direction :: proc(value: f64) -> data_bullet.Direction {
	return data_bullet.Direction{type = .Absolute, value = test_number(value)}
}

@(private = "file")
test_sequence_direction :: proc(value: f64) -> data_bullet.Direction {
	return data_bullet.Direction{type = .Sequence, value = test_number(value)}
}

@(private = "file")
test_absolute_speed :: proc(value: f64) -> data_bullet.Speed {
	return data_bullet.Speed{type = .Absolute, value = test_number(value)}
}

@(private = "file")
test_wait :: proc(value: f64) -> data_bullet.Command {
	return data_bullet.Command{kind = .Wait, wait = test_number(value)}
}

@(private = "file")
test_fire_ref :: proc(index: int) -> data_bullet.Command {
	return data_bullet.Command{kind = .Fire_Ref, fire_ref = test_ref(index)}
}

@(private = "file")
test_repeat :: proc(times, action_index: int) -> data_bullet.Command {
	return data_bullet.Command {
		kind = .Repeat,
		repeat = data_bullet.Repeat{times = test_number(f64(times)), action_ref = test_ref(action_index)},
	}
}

@(test)
test_sequence_fire_direction_uses_previous_fire_direction :: proc(t: ^testing.T) {
	pattern := data_bullet.Bullet_Pattern {
		type    = .Vertical,
		bullets = []data_bullet.Bullet {
			{direction = test_absolute_direction(0), speed = test_absolute_speed(1)},
			{direction = test_absolute_direction(0), speed = test_absolute_speed(1)},
		},
		actions = []data_bullet.Action {
			[]data_bullet.Command{test_repeat(999, 1)},
			[]data_bullet.Command{test_fire_ref(0), test_repeat(7, 2), test_wait(2)},
			[]data_bullet.Command{test_fire_ref(1)},
		},
		fires   = []data_bullet.Fire {
			{direction = test_sequence_direction(-5), speed = test_absolute_speed(1), bullet_ref = test_ref(0)},
			{direction = test_sequence_direction(45), speed = test_absolute_speed(1), bullet_ref = test_ref(1)},
		},
	}

	state := init_pattern_state(&pattern)
	defer destroy_state(&state)

	ctx := Tick_Context {
		rank          = 0.5,
		rand          = 0.3,
		aim_direction = 10,
	}
	commands := tick(&state, ctx)

	expected := [?]f64{175, 220, 265, 310, 355, 40, 85, 130}
	testing.expectf(t, len(commands) == len(expected), "spawn count = %d", len(commands))
	for direction, index in expected {
		testing.expectf(t, commands[index].kind == .Spawn, "command %d kind = %v", index, commands[index].kind)
		testing.expectf(
			t,
			commands[index].direction == direction,
			"command %d direction = %v",
			index,
			commands[index].direction,
		)
	}
	delete(commands)

	commands = tick(&state, ctx)
	testing.expectf(t, len(commands) == 0, "wait tick 1 spawn count = %d", len(commands))
	delete(commands)
	commands = tick(&state, ctx)
	testing.expectf(t, len(commands) == 0, "wait tick 2 spawn count = %d", len(commands))
	delete(commands)
	commands = tick(&state, ctx)
	testing.expectf(t, len(commands) == 0, "wait tick 3 spawn count = %d", len(commands))
	delete(commands)

	commands = tick(&state, ctx)
	defer delete(commands)

	shifted_expected := [?]f64{125, 170, 215, 260, 305, 350, 35, 80}
	testing.expectf(t, len(commands) == len(shifted_expected), "shifted spawn count = %d", len(commands))
	for direction, index in shifted_expected {
		testing.expectf(t, commands[index].kind == .Spawn, "shifted command %d kind = %v", index, commands[index].kind)
		testing.expectf(
			t,
			commands[index].direction == direction,
			"shifted command %d direction = %v",
			index,
			commands[index].direction,
		)
	}
}
