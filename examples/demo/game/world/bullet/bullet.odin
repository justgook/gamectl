package bullet

import "../../decoder2"
import "core:math"

@(private = "file")
MAX_TICK_STEPS :: 1024

Event_Kind :: enum {
	Spawn,
	Vanish,
	ChangeDirection,
	ChangeSpeed,
	Accel,
	Done,
}

Event :: struct {
	kind:               Event_Kind,

	// Spawn payload. The caller decides how to map this to ECS/world state.
	bullet_index:       int,
	direction:          f64,
	speed:              f64,
	child_state:        State,

	// Motion-change payloads.
	term:               int,
	previous_direction: f64,
	previous_speed:     f64,
	horizontal:         f64,
	vertical:           f64,
}

Tick_Context :: struct {
	// BulletML variables.
	rank:          f64,
	rand:          f64,

	// Caller-provided aiming direction for `aim` directions.
	aim_direction: f64,
}

State :: struct {
	pattern:             ^decoder2.Bullet_Pattern,
	frames:              [dynamic]Frame,
	wait:                int,
	done:                bool,

	// Current motion context. The VM updates this for relative motion commands;
	// the caller may also mirror it into ECS velocity/state.
	direction:           f64,
	speed:               f64,

	// BulletML sequence fire context. Sequence fire directions/speeds are relative
	// to the previously fired bullet, not to this bullet's own motion direction.
	last_fire_direction: f64,
	last_fire_speed:     f64,
}

@(private = "file")
Frame :: struct {
	action_index:        int,
	command_index:       int,
	params:              []f64,
	repeat_action_index: int,
	repeat_remaining:    int,
}

init_pattern_state :: proc(pattern: ^decoder2.Bullet_Pattern, action_index := 0, done := false) -> State {
	state := State {
		done                = done,
		pattern             = pattern,
		frames              = make([dynamic]Frame),
		direction           = 180,
		speed               = 0,
		last_fire_direction = 180,
		last_fire_speed     = 1,
	}
	push_action(&state, action_index, nil)

	return state
}
restart :: proc(state: ^State, action_index := 0) {
	clear(&state.frames)
	state.wait = 0
	state.done = false
	push_action(state, action_index, nil)
}

init_bullet_state :: proc(
	pattern: ^decoder2.Bullet_Pattern,
	bullet_index: int,
	parent_params: []f64,
	ctx: Tick_Context,
) -> State {
	assert(pattern != nil)
	assert(bullet_index >= 0 && bullet_index < len(pattern.bullets))

	bullet_def := pattern.bullets[bullet_index]
	direction := eval_direction(bullet_def.direction, 0, parent_params, ctx)
	speed := eval_speed(bullet_def.speed, 0, parent_params, ctx)
	state := State {
		pattern             = pattern,
		frames              = make([dynamic]Frame),
		direction           = direction,
		speed               = speed,
		last_fire_direction = direction,
		last_fire_speed     = speed,
	}

	// Stack is LIFO, so push refs in reverse to execute source order.
	for i := len(bullet_def.action_refs) - 1; i >= 0; i -= 1 {
		action_index, params := resolve_ref(bullet_def.action_refs[i], parent_params, ctx)
		push_action(&state, action_index, params)
		if i == 0 {break}
	}

	return state
}

@(require_results)
tick :: proc(state: ^State, ctx: Tick_Context) -> [dynamic]Event {
	events := make([dynamic]Event)
	if state.done {
		return events
	}

	if state.wait > 0 {
		state.wait -= 1
		return events
	}

	steps := 0
	for !state.done && state.wait == 0 {
		assert(steps < MAX_TICK_STEPS)
		steps += 1

		if len(state.frames) == 0 {
			state.done = true
			append(&events, Event{kind = .Done})
			break
		}

		frame := &state.frames[len(state.frames) - 1]
		assert(frame.action_index >= 0 && frame.action_index < len(state.pattern.actions))
		action := state.pattern.actions[frame.action_index]

		if frame.command_index >= len(action) {
			complete_frame(state)
			continue
		}

		command := action[frame.command_index]
		frame.command_index += 1
		execute_command(state, command, frame.params, ctx, &events)
	}

	return events
}

@(private = "file")
push_action :: proc(state: ^State, action_index: int, params: []f64, repeat_remaining := 1) {
	assert(state.pattern != nil)
	assert(action_index >= 0 && action_index < len(state.pattern.actions))
	append(
		&state.frames,
		Frame {
			action_index = action_index,
			command_index = 0,
			params = params,
			repeat_action_index = action_index,
			repeat_remaining = repeat_remaining,
		},
	)
}

@(private = "file")
complete_frame :: proc(state: ^State) {
	assert(len(state.frames) > 0)
	frame := &state.frames[len(state.frames) - 1]
	if frame.repeat_remaining > 1 {
		frame.repeat_remaining -= 1
		frame.command_index = 0
		frame.action_index = frame.repeat_action_index
		return
	}
	pop_frame(state)
}

destroy_state :: proc(state: ^State) {
	for i in 0 ..< len(state.frames) {
		if state.frames[i].params != nil {
			delete(state.frames[i].params)
		}
	}
	if state.frames != nil {
		delete(state.frames)
	}
	state^ = State{}
}

destroy_patterns :: proc(patterns: ^decoder2.Bullet_Patterns) {
	for &pattern in patterns^ {
		destroy_pattern(&pattern)
	}
	delete(patterns^)
	patterns^ = nil
}

@(private = "file")
destroy_pattern :: proc(pattern: ^decoder2.Bullet_Pattern) {
	for &b in pattern.bullets {
		for &ref in b.action_refs {
			destroy_ref(&ref)
		}
		delete(b.action_refs)
	}
	delete(pattern.bullets)

	for action in pattern.actions {
		for &command in action {
			destroy_command(&command)
		}
		delete(action)
	}
	delete(pattern.actions)

	for &fire in pattern.fires {
		destroy_ref(&fire.bullet_ref)
	}
	delete(pattern.fires)

	pattern^ = {}
}

@(private = "file")
destroy_command :: proc(command: ^decoder2.Command) {
	#partial switch command.kind {
	case .Fire_Ref:
		destroy_ref(&command.fire_ref)
	case .Action_Ref:
		destroy_ref(&command.action_ref)
	case .Repeat:
		destroy_ref(&command.repeat.action_ref)
	case:
	}
	command^ = {}
}

@(private = "file")
destroy_ref :: proc(ref: ^decoder2.Ref) {
	if ref.kind == .Ref_With_Params {
		delete(ref.ref_with_params.params)
	}
	ref^ = {}
}

@(private = "file")
pop_frame :: proc(state: ^State) {
	assert(len(state.frames) > 0)
	frame := &state.frames[len(state.frames) - 1]
	if frame.params != nil {
		delete(frame.params)
	}
	ordered_remove(&state.frames, len(state.frames) - 1)
}

@(private = "file")
execute_command :: proc(
	state: ^State,
	command: decoder2.Command,
	params: []f64,
	ctx: Tick_Context,
	events: ^[dynamic]Event,
) {
	switch command.kind {
	case .None:
		panic("empty BulletML command")
	case .Fire_Ref:
		execute_fire_ref(state, command.fire_ref, params, ctx, events)
	case .Action_Ref:
		action_index, action_params := resolve_ref(command.action_ref, params, ctx)
		push_action(state, action_index, action_params)
	case .Wait:
		state.wait = max(0, int(eval_expr(command.wait, params, ctx)))
	case .Repeat:
		repeat_count := max(0, int(eval_expr(command.repeat.times, params, ctx)))
		if repeat_count > 0 {
			action_index, action_params := resolve_ref(command.repeat.action_ref, params, ctx)
			push_action(state, action_index, action_params, repeat_count)
		}
	case .Vanish:
		state.done = true
		append(events, Event{kind = .Vanish})
	case .Change_Direction:
		previous_direction := state.direction
		new_direction := eval_direction(command.change_direction.direction, state.direction, params, ctx)
		state.direction = new_direction
		append(
			events,
			Event {
				kind = .ChangeDirection,
				previous_direction = previous_direction,
				direction = new_direction,
				term = max(0, int(eval_expr(command.change_direction.term, params, ctx))),
			},
		)
	case .Change_Speed:
		previous_speed := state.speed
		new_speed := eval_speed(command.change_speed.speed, state.speed, params, ctx)
		state.speed = new_speed
		append(
			events,
			Event {
				kind = .ChangeSpeed,
				previous_speed = previous_speed,
				speed = new_speed,
				term = max(0, int(eval_expr(command.change_speed.term, params, ctx))),
			},
		)
	case .Accel:
		append(
			events,
			Event {
				kind = .Accel,
				horizontal = eval_expr(command.accel.horizontal.value, params, ctx),
				vertical = eval_expr(command.accel.vertical.value, params, ctx),
				term = max(0, int(eval_expr(command.accel.term, params, ctx))),
			},
		)
	case:
		panic("unsupported BulletML command")
	}
}

@(private = "file")
execute_fire_ref :: proc(
	state: ^State,
	fire_ref: decoder2.Fire_Ref,
	params: []f64,
	ctx: Tick_Context,
	events: ^[dynamic]Event,
) {
	fire_index, fire_params := resolve_ref(fire_ref, params, ctx)
	assert(fire_index >= 0 && fire_index < len(state.pattern.fires))
	fire_def := state.pattern.fires[fire_index]

	bullet_index, bullet_params := resolve_ref(fire_def.bullet_ref, fire_params, ctx)
	direction := eval_direction(fire_def.direction, state.last_fire_direction, fire_params, ctx)
	speed := eval_speed(fire_def.speed, state.last_fire_speed, fire_params, ctx)
	child := init_bullet_state(state.pattern, bullet_index, bullet_params, ctx)
	child.direction = direction
	child.speed = speed
	child.last_fire_direction = direction
	child.last_fire_speed = speed
	state.last_fire_direction = direction
	state.last_fire_speed = speed

	append(
		events,
		Event{kind = .Spawn, bullet_index = bullet_index, direction = direction, speed = speed, child_state = child},
	)
}

@(private = "file")
resolve_ref :: proc(ref: decoder2.Ref, parent_params: []f64, ctx: Tick_Context) -> (int, []f64) {
	switch ref.kind {
	case .None:
		panic("empty BulletML ref")
	case .Ref_Index:
		return int(ref.ref_index), nil
	case .Ref_With_Params:
		params := make([]f64, len(ref.ref_with_params.params))
		for i in 0 ..< len(ref.ref_with_params.params) {
			params[i] = eval_expr(ref.ref_with_params.params[i], parent_params, ctx)
		}
		return int(ref.ref_with_params.ref), params
	case:
		panic("unsupported BulletML ref")
	}
}

@(private = "file")
eval_direction :: proc(direction: decoder2.Direction, current: f64, params: []f64, ctx: Tick_Context) -> f64 {
	value := eval_expr(direction.value, params, ctx)
	switch direction.type {
	case .Aim:
		return normalize_direction(ctx.aim_direction + value)
	case .Absolute:
		return normalize_direction(value)
	case .Relative:
		return normalize_direction(current + value)
	case .Sequence:
		return normalize_direction(current + value)
	}
	panic("unsupported BulletML direction type")
}

@(private = "file")
normalize_direction :: proc(direction: f64) -> f64 {
	normalized := math.mod(direction, 360)
	if normalized < 0 {
		return normalized + 360
	}
	return normalized
}

@(private = "file")
eval_speed :: proc(speed: decoder2.Speed, current: f64, params: []f64, ctx: Tick_Context) -> f64 {
	value := eval_expr(speed.value, params, ctx)
	switch speed.type {
	case .Absolute:
		return value
	case .Relative:
		return current + value
	case .Sequence:
		return current + value
	}
	panic("unsupported BulletML speed type")
}

@(private = "file")
eval_expr :: proc(expr: decoder2.Expr, params: []f64, ctx: Tick_Context) -> f64 {
	switch expr.kind {
	case .None:
		panic("empty BulletML expr")
	case .Expr_Number:
		return f64(expr.expr_number)
	case .Expr_String:
		parser := Expr_Parser {
			source = string(expr.expr_string),
			params = params,
			ctx    = ctx,
		}
		value := parse_expression(&parser)
		skip_spaces(&parser)
		assert(parser.index == len(parser.source))
		return value
	case:
		panic("unsupported BulletML expr")
	}
}

@(private = "file")
Expr_Parser :: struct {
	source: string,
	index:  int,
	params: []f64,
	ctx:    Tick_Context,
}

@(private = "file")
parse_expression :: proc(p: ^Expr_Parser) -> f64 {
	value := parse_term(p)
	for {
		skip_spaces(p)
		if match_char(p, '+') {
			value += parse_term(p)
		} else if match_char(p, '-') {
			value -= parse_term(p)
		} else {
			return value
		}
	}
}

@(private = "file")
parse_term :: proc(p: ^Expr_Parser) -> f64 {
	value := parse_factor(p)
	for {
		skip_spaces(p)
		if match_char(p, '*') {
			value *= parse_factor(p)
		} else if match_char(p, '/') {
			value /= parse_factor(p)
		} else {
			return value
		}
	}
}

@(private = "file")
parse_factor :: proc(p: ^Expr_Parser) -> f64 {
	skip_spaces(p)
	if match_char(p, '+') {
		return parse_factor(p)
	}
	if match_char(p, '-') {
		return -parse_factor(p)
	}
	if match_char(p, '(') {
		value := parse_expression(p)
		assert(match_char(p, ')'))
		return value
	}
	if match_char(p, '$') {
		return parse_variable(p)
	}
	return parse_number(p)
}

@(private = "file")
parse_variable :: proc(p: ^Expr_Parser) -> f64 {
	if match_word(p, "rank") {
		return p.ctx.rank
	}
	if match_word(p, "rand") {
		return p.ctx.rand
	}
	param_index := parse_integer(p)
	assert(param_index > 0 && param_index <= len(p.params))
	return p.params[param_index - 1]
}

@(private = "file")
parse_number :: proc(p: ^Expr_Parser) -> f64 {
	start := p.index
	if p.index < len(p.source) && p.source[p.index] == '.' {
		p.index += 1
	}
	for p.index < len(p.source) && is_digit(p.source[p.index]) {
		p.index += 1
	}
	if p.index < len(p.source) && p.source[p.index] == '.' {
		p.index += 1
		for p.index < len(p.source) && is_digit(p.source[p.index]) {
			p.index += 1
		}
	}
	assert(p.index > start)
	return parse_decimal(p.source[start:p.index])
}

@(private = "file")
parse_integer :: proc(p: ^Expr_Parser) -> int {
	start := p.index
	for p.index < len(p.source) && is_digit(p.source[p.index]) {
		p.index += 1
	}
	assert(p.index > start)
	value := 0
	for i in start ..< p.index {
		value = value * 10 + int(p.source[i] - '0')
	}
	return value
}

@(private = "file")
parse_decimal :: proc(data: string) -> f64 {
	idx := 0
	whole: f64 = 0
	for idx < len(data) && is_digit(data[idx]) {
		whole = whole * 10 + f64(data[idx] - '0')
		idx += 1
	}
	frac: f64 = 0
	divisor: f64 = 1
	if idx < len(data) && data[idx] == '.' {
		idx += 1
		for idx < len(data) && is_digit(data[idx]) {
			frac = frac * 10 + f64(data[idx] - '0')
			divisor *= 10
			idx += 1
		}
	}
	assert(idx == len(data))
	return whole + frac / divisor
}

@(private = "file")
skip_spaces :: proc(p: ^Expr_Parser) {
	for p.index < len(p.source) && is_space(p.source[p.index]) {
		p.index += 1
	}
}

@(private = "file")
match_char :: proc(p: ^Expr_Parser, c: u8) -> bool {
	if p.index < len(p.source) && p.source[p.index] == c {
		p.index += 1
		return true
	}
	return false
}

@(private = "file")
match_word :: proc(p: ^Expr_Parser, word: string) -> bool {
	if p.index + len(word) > len(p.source) {
		return false
	}
	if p.source[p.index:p.index + len(word)] != word {
		return false
	}
	p.index += len(word)
	return true
}

@(private = "file")
is_digit :: proc(c: u8) -> bool {
	return c >= '0' && c <= '9'
}

@(private = "file")
is_space :: proc(c: u8) -> bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r'
}
