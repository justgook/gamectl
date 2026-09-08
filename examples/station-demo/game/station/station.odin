package station

import "core:math"
import director "../director"

Binding_Kind :: enum u32 {
	Entity,
	Word,
	Rule,
}

Binding :: struct {
	kind:  Binding_Kind,
	name:  string,
	value: u32,
}

Bindings :: []Binding

Vec2 :: struct {x, y: f32}

State :: struct {
	director_state: director.State,
	bindings:       Bindings,
	player:         Vec2,
	move:           [4]bool,
	completed:      bool,
	message:        Message,
}

Message :: enum u8 {
	Explore,
	Power_On,
	Key_Taken,
	Exit_Locked,
	Exit_Open,
	Complete,
}

PLAYER_START :: Vec2{-0.58, 0.42}
SWITCH_POS :: Vec2{-0.48, -0.34}
KEY_POS :: Vec2{0.28, 0.36}
EXIT_POS :: Vec2{0.78, 0}
PLAYER_RADIUS :: f32(0.035)
INTERACTION_RADIUS_SQ :: f32(0.0225)

init :: proc(data: director.Director_Data, bindings: Bindings) -> State {
	state := State {
		director_state = director.init(data),
		bindings = bindings,
		player = PLAYER_START,
		message = .Explore,
	}
	// Required lookups are intentional fail-fast validation at the game boundary.
	_ = entity_binding(&state, "PLAYER")
	_ = entity_binding(&state, "POWER_SWITCH")
	_ = entity_binding(&state, "ACCESS_KEY")
	_ = entity_binding(&state, "EXIT")
	_ = word_binding(&state, "powered")
	_ = word_binding(&state, "carrying_key")
	_ = word_binding(&state, "locked")
	return state
}

destroy :: proc(state: ^State) {
	director.destroy(&state.director_state)
	state^ = {}
}

restart :: proc(state: ^State) {
	data := state.director_state.data
	bindings := state.bindings
	destroy(state)
	state^ = init(data, bindings)
}

set_action :: proc(state: ^State, action: u32, down: bool) {
	switch action {
	case 1: state.move[0] = down
	case 2: state.move[1] = down
	case 3: state.move[2] = down
	case 4: state.move[3] = down
	case 5:
		if down && !state.completed {interact(state)}
	case 6:
		if down {restart(state)}
	case:
		assert(false, "unknown station action")
	}
}

step :: proc(state: ^State, elapsed: f64) {
	if state.completed {return}
	dt := f32(min(elapsed, 0.05))
	direction := Vec2 {
		x = f32(i32(state.move[1]) - i32(state.move[3])),
		y = f32(i32(state.move[0]) - i32(state.move[2])),
	}
	if direction.x != 0 && direction.y != 0 {
		direction.x *= 0.70710678
		direction.y *= 0.70710678
	}
	SPEED :: f32(0.72)
	move_axis(state, direction.x * SPEED * dt, true)
	move_axis(state, direction.y * SPEED * dt, false)
	if !is_locked(state) && state.player.x > 0.98 && math.abs(state.player.y) < 0.16 {
		state.completed = true
		state.message = .Complete
	}
}

interact :: proc(state: ^State) {
	if near(state.player, SWITCH_POS) {
		result := director.trigger(
			&state.director_state,
			director.Trigger{kind = .Entity, entity = entity_binding(state, "POWER_SWITCH")},
		)
		state.message = result.matched ? .Power_On : .Explore
		return
	}
	if near(state.player, KEY_POS) && !has_key(state) {
		result := director.trigger(
			&state.director_state,
			director.Trigger{kind = .Entity, entity = entity_binding(state, "ACCESS_KEY")},
		)
		state.message = result.matched ? .Key_Taken : .Explore
		return
	}
	if near(state.player, EXIT_POS) {
		result := director.trigger(
			&state.director_state,
			director.Trigger{kind = .Entity, entity = entity_binding(state, "EXIT")},
		)
		state.message = !result.matched || is_locked(state) ? .Exit_Locked : .Exit_Open
	}
}

has_power :: proc(state: ^State) -> bool {
	return director.entity_has_tag(
		&state.director_state,
		entity_binding(state, "PLAYER"),
		word_binding(state, "powered"),
	)
}

has_key :: proc(state: ^State) -> bool {
	return director.entity_has_tag(
		&state.director_state,
		entity_binding(state, "PLAYER"),
		word_binding(state, "carrying_key"),
	)
}

is_locked :: proc(state: ^State) -> bool {
	return director.entity_has_tag(
		&state.director_state,
		entity_binding(state, "EXIT"),
		word_binding(state, "locked"),
	)
}

entity_binding :: proc(state: ^State, name: string) -> director.Entity_Id {
	for binding in state.bindings {
		if binding.kind == .Entity && binding.name == name {
			return director.Entity_Id(binding.value)
		}
	}
	assert(false, "missing required Director entity binding")
	return director.INVALID_ENTITY
}

word_binding :: proc(state: ^State, name: string) -> director.Word_Id {
	for binding in state.bindings {
		if binding.kind == .Word && binding.name == name {
			return director.Word_Id(binding.value)
		}
	}
	assert(false, "missing required Director word binding")
	return director.INVALID_WORD
}

near :: proc(a, b: Vec2) -> bool {
	dx := a.x - b.x
	dy := a.y - b.y
	return dx * dx + dy * dy <= INTERACTION_RADIUS_SQ
}

move_axis :: proc(state: ^State, amount: f32, horizontal: bool) {
	candidate := state.player
	if horizontal {candidate.x += amount} else {candidate.y += amount}
	candidate.y = clamp(candidate.y, -0.68, 0.68)
	candidate.x = max(candidate.x, -0.86)
	if candidate.x > 0.86 {
		in_exit := math.abs(candidate.y) < 0.16
		if !in_exit || is_locked(state) {candidate.x = 0.86}
	}
	candidate.x = min(candidate.x, 1.08)
	state.player = candidate
}
