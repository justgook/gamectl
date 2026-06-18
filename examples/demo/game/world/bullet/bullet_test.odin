#+build !freestanding
#+build !js
#+build !orca

package bullet

import "../../decoder2"
import "core:testing"

@(private = "file")
test_number :: proc(value: f64) -> decoder2.Expr {
	return decoder2.Expr{kind = .Expr_Number, expr_number = decoder2.Expr_Number(value)}
}

@(private = "file")
test_ref :: proc(index: int) -> decoder2.Ref {
	return decoder2.Ref{kind = .Ref_Index, ref_index = decoder2.Ref_Index(index)}
}

@(private = "file")
test_absolute_direction :: proc(value: f64) -> decoder2.Direction {
	return decoder2.Direction{type = .Absolute, value = test_number(value)}
}

@(private = "file")
test_sequence_direction :: proc(value: f64) -> decoder2.Direction {
	return decoder2.Direction{type = .Sequence, value = test_number(value)}
}

@(private = "file")
test_absolute_speed :: proc(value: f64) -> decoder2.Speed {
	return decoder2.Speed{type = .Absolute, value = test_number(value)}
}

@(private = "file")
test_wait :: proc(value: f64) -> decoder2.Command {
	return decoder2.Command{kind = .Wait, wait = test_number(value)}
}

@(private = "file")
test_fire_ref :: proc(index: int) -> decoder2.Command {
	return decoder2.Command{kind = .Fire_Ref, fire_ref = test_ref(index)}
}

@(private = "file")
test_repeat :: proc(times, action_index: int) -> decoder2.Command {
	return decoder2.Command{
		kind = .Repeat,
		repeat = decoder2.Repeat{times = test_number(f64(times)), action_ref = test_ref(action_index)},
	}
}

@(test)
test_sequence_fire_direction_uses_previous_fire_direction :: proc(t: ^testing.T) {
	pattern := decoder2.Bullet_Pattern{
		type = .Vertical,
		bullets = []decoder2.Bullet{
			{direction = test_absolute_direction(0), speed = test_absolute_speed(1)},
			{direction = test_absolute_direction(0), speed = test_absolute_speed(1)},
		},
		actions = []decoder2.Action{
			[]decoder2.Command{test_repeat(999, 1)},
			[]decoder2.Command{test_fire_ref(0), test_repeat(7, 2), test_wait(2)},
			[]decoder2.Command{test_fire_ref(1)},
		},
		fires = []decoder2.Fire{
			{
				direction = test_sequence_direction(-5),
				speed = test_absolute_speed(1),
				bullet_ref = test_ref(0),
			},
			{
				direction = test_sequence_direction(45),
				speed = test_absolute_speed(1),
				bullet_ref = test_ref(1),
			},
		},
	}

	state := init_pattern_state(&pattern)
	defer destroy_state(&state)

	ctx := Tick_Context{rank = 0.5, rand = 0.3, aim_direction = 10}
	commands := tick(&state, ctx)

	expected := [?]f64{175, 220, 265, 310, 355, 40, 85, 130}
	testing.expectf(t, len(commands) == len(expected), "spawn count = %d", len(commands))
	for direction, index in expected {
		testing.expectf(t, commands[index].kind == .Spawn, "command %d kind = %v", index, commands[index].kind)
		testing.expectf(t, commands[index].direction == direction, "command %d direction = %v", index, commands[index].direction)
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
		testing.expectf(t, commands[index].direction == direction, "shifted command %d direction = %v", index, commands[index].direction)
	}
}
