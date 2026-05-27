package markov_junior

import mem "core:mem"
import runtime "base:runtime"

MJ_OUTPUT_CAPACITY :: 8 * 1024 * 1024
mj_output_buffer: [MJ_OUTPUT_CAPACITY]u8
mj_output_len: int

MJ_Node :: struct {
	kind: u32,
	start: int,
	count: int,
	steps: int,
	children_start: int,
	children_count: int,
}

MJ_Markov_State :: struct {
	matches: [dynamic]Match,
	match_mask: [][]bool,
	last_turn: int,
}

@(export)
mj_core_run :: proc "c" (
	model_ptr: rawptr,
	model_len: uintptr,
	initial_ptr: rawptr,
	initial_len: uintptr,
	width: u32,
	height: u32,
	depth: u32,
	seed: u64,
	max_steps: u32,
) -> u32 {
	context = runtime.default_context()
	model := mj_core_input_slice(model_ptr, model_len)
	initial := mj_core_input_slice(initial_ptr, initial_len)
	return mj_run_mjir_v1(model, initial, width, height, depth, seed, max_steps)
}

@(export)
mj_core_output_ptr :: proc "c" () -> rawptr {
	if mj_output_len == 0 {
		return nil
	}
	return rawptr(&mj_output_buffer[0])
}

@(export)
mj_core_output_len :: proc "c" () -> uintptr {
	return uintptr(mj_output_len)
}

mj_core_input_slice :: proc(ptr: rawptr, count: uintptr) -> []u8 {
	if count == 0 {
		return []u8{}
	}
	return mem.slice_ptr(cast(^u8)ptr, int(count))
}

mj_fail :: proc(message: string) -> u32 {
	mj_output_len = 0
	if len(message) > len(mj_output_buffer) {
		return 1
	}
	copy(mj_output_buffer[:], transmute([]u8)message)
	mj_output_len = len(message)
	return 1
}

mj_write_u32 :: proc(pos: ^int, value: u32) -> bool {
	if pos^ + 4 > len(mj_output_buffer) { return false }
	mj_output_buffer[pos^ + 0] = u8(value & 0xff)
	mj_output_buffer[pos^ + 1] = u8((value >> 8) & 0xff)
	mj_output_buffer[pos^ + 2] = u8((value >> 16) & 0xff)
	mj_output_buffer[pos^ + 3] = u8((value >> 24) & 0xff)
	pos^ += 4
	return true
}

mj_read_u32 :: proc(data: []u8, pos: ^int, ok: ^bool) -> u32 {
	if !ok^ || pos^ + 4 > len(data) {
		ok^ = false
		return 0
	}
	value := u32(data[pos^]) | (u32(data[pos^ + 1]) << 8) | (u32(data[pos^ + 2]) << 16) | (u32(data[pos^ + 3]) << 24)
	pos^ += 4
	return value
}

mj_read_f64 :: proc(data: []u8, pos: ^int, ok: ^bool) -> f64 {
	if !ok^ || pos^ + 8 > len(data) {
		ok^ = false
		return 0
	}
	bits := u64(data[pos^]) | (u64(data[pos^ + 1]) << 8) | (u64(data[pos^ + 2]) << 16) | (u64(data[pos^ + 3]) << 24) |
		(u64(data[pos^ + 4]) << 32) | (u64(data[pos^ + 5]) << 40) | (u64(data[pos^ + 6]) << 48) | (u64(data[pos^ + 7]) << 56)
	pos^ += 8
	return transmute(f64)bits
}

mj_run_mjir_v1 :: proc(model: []u8, initial: []u8, width, height, depth: u32, seed: u64, max_steps: u32) -> u32 {
	if len(model) < 20 { return mj_fail("model-ir is too short") }
	if model[0] != 'M' || model[1] != 'J' || model[2] != 'I' || model[3] != 'R' { return mj_fail("model-ir magic mismatch") }
	pos := 4
	ok := true
	version := mj_read_u32(model, &pos, &ok)
	if !ok || version != 1 { return mj_fail("unsupported model-ir version") }
	values_len := int(mj_read_u32(model, &pos, &ok))
	if !ok || values_len <= 0 || pos + values_len > len(model) { return mj_fail("invalid model-ir values") }
	values_start := pos
	values := string(model[values_start:values_start + values_len])
	pos += values_len
	rule_count := int(mj_read_u32(model, &pos, &ok))
	if !ok || rule_count <= 0 { return mj_fail("invalid model-ir rule count") }

	cell_count_u64 := u64(width) * u64(height) * u64(depth)
	if cell_count_u64 > u64(len(initial)) { return mj_fail("initial-cells shorter than configured grid") }
	cell_count := int(cell_count_u64)
	if cell_count > MJ_OUTPUT_CAPACITY { return mj_fail("grid too large for MVP output buffer") }

	g := grid_init(int(width), int(height), int(depth), values, false)
	defer grid_destroy(&g)
	copy(g.state, initial[:cell_count])

	rules := make([dynamic]Rule)
	defer {
		for i in 0..<len(rules) { rule_destroy(&rules[i]) }
		delete(rules)
	}

	nodes := make([dynamic]MJ_Node)
	defer delete(nodes)
	container_kind: u32 = 0
	node_kind: u32 = 1
	node_steps := 0
	node_start := 0
	node_open := false
	container_stack := make([dynamic]int)
	defer delete(container_stack)
	root_marker_seen := false
	for _ in 0..<rule_count {
		op := mj_read_u32(model, &pos, &ok)
		if !ok { return mj_fail("truncated model-ir rule opcode") }
		if op == 100 {
			kind := mj_read_u32(model, &pos, &ok)
			marker_steps := int(mj_read_u32(model, &pos, &ok))
			if !ok || kind < 1 || kind > 5 { return mj_fail("invalid model-ir node kind") }
			if kind >= 4 && !root_marker_seen && len(nodes) == 0 && !node_open {
				container_kind = kind
				root_marker_seen = true
			} else if kind >= 4 {
				if node_open || len(rules) > node_start {
					append(&nodes, MJ_Node{node_kind, node_start, len(rules) - node_start, node_steps, 0, 0})
					node_open = false
				}
				node_start = len(rules)
				node_steps = 0
				container_index := len(nodes)
				append(&nodes, MJ_Node{kind, 0, 0, marker_steps, container_index + 1, 0})
				append(&container_stack, container_index)
			} else {
				if node_open || len(rules) > node_start {
					append(&nodes, MJ_Node{node_kind, node_start, len(rules) - node_start, node_steps, 0, 0})
				}
				node_kind = kind
				node_steps = marker_steps
				node_start = len(rules)
				node_open = true
				root_marker_seen = true
			}
		} else if op == 101 {
			if pos >= len(model) { return mj_fail("truncated model-ir union symbol") }
			symbol := model[pos]; pos += 1
			union_values_len := int(mj_read_u32(model, &pos, &ok))
			if !ok || union_values_len <= 0 || pos + union_values_len > len(model) { return mj_fail("invalid model-ir union values") }
			grid_add_union(&g, symbol, string(model[pos:pos + union_values_len]))
			pos += union_values_len
		} else if op == 102 {
			if node_open || len(rules) > node_start {
				append(&nodes, MJ_Node{node_kind, node_start, len(rules) - node_start, node_steps, 0, 0})
				node_open = false
			}
			if len(container_stack) == 0 { return mj_fail("model-ir container end without start") }
			container_index := container_stack[len(container_stack) - 1]
			_ = pop(&container_stack)
			nodes[container_index].children_count = len(nodes) - nodes[container_index].children_start
			node_start = len(rules)
			node_steps = 0
		} else if op == 1 {
			if pos + 2 > len(model) { return mj_fail("truncated one-cell replace rule") }
			input_index := int(model[pos]); output_index := int(model[pos + 1]); pos += 2
			if input_index >= values_len || output_index >= values_len { return mj_fail("one-cell rule value index out of range") }
			in_chars := []u8{values[input_index]}
			out_chars := []u8{values[output_index]}
			base := rule_from_char_arrays(&g, in_chars, 1, 1, 1, out_chars, 1, 1, 1)
			append_rule_symmetries(&g, &rules, base, "()")
		} else if op == 2 {
			imx := int(mj_read_u32(model, &pos, &ok)); imy := int(mj_read_u32(model, &pos, &ok)); imz := int(mj_read_u32(model, &pos, &ok))
			omx := int(mj_read_u32(model, &pos, &ok)); omy := int(mj_read_u32(model, &pos, &ok)); omz := int(mj_read_u32(model, &pos, &ok))
			probability := mj_read_f64(model, &pos, &ok)
			symmetry_len := int(mj_read_u32(model, &pos, &ok))
			if !ok || imx <= 0 || imy <= 0 || imz <= 0 || omx <= 0 || omy <= 0 || omz <= 0 || symmetry_len < 0 { return mj_fail("invalid pattern rule header") }
			if pos + symmetry_len > len(model) { return mj_fail("truncated pattern rule symmetry") }
			symmetry := string(model[pos:pos + symmetry_len]); pos += symmetry_len
			input_len := imx * imy * imz
			output_len := omx * omy * omz
			if pos + input_len + output_len > len(model) { return mj_fail("truncated pattern rule data") }
			input_chars := model[pos:pos + input_len]; pos += input_len
			output_chars := model[pos:pos + output_len]; pos += output_len
			base := rule_from_char_arrays(&g, input_chars, imx, imy, imz, output_chars, omx, omy, omz, probability)
			append_rule_symmetries(&g, &rules, base, symmetry)
		} else {
			return mj_fail("unsupported model-ir rule opcode")
		}
	}

	if node_open || len(rules) > node_start {
		append(&nodes, MJ_Node{node_kind, node_start, len(rules) - node_start, node_steps, 0, 0})
	}
	if len(container_stack) != 0 { return mj_fail("model-ir unclosed container") }
	if len(rules) == 0 { return mj_fail("model-ir contains no rules") }
	if len(nodes) == 0 { append(&nodes, MJ_Node{node_kind, 0, len(rules), 0, 0, 0}) }

	random := mj_random_init(i32(seed & 0x7fffffff))
	steps_run := 0
	changed := false
	if container_kind == 4 {
		steps_run, changed = mj_run_markov_nodes_with_count(&g, rules[:], nodes[:], &random, int(max_steps))
	} else if container_kind == 5 {
		steps_run, changed = mj_run_sequence_nodes_with_count(&g, rules[:], nodes[:], &random, int(max_steps))
	} else {
		node := nodes[0]
		steps_run, changed = mj_run_node_rules_with_count(&g, node.kind, rules[node.start:node.start + node.count], &random, int(max_steps))
	}
	done := !mj_any_one_match(&g, rules[:])

	return mj_respond_grid(&g, u32(steps_run), changed, done)
}

mj_run_node_rules_with_count :: proc(g: ^Grid, kind: u32, rules: []Rule, random: ^MJRandom, steps: int) -> (int, bool) {
	if kind == 1 do return mj_run_one_rules_with_count(g, rules, random, steps)
	if kind == 2 do return mj_run_all_rules_with_count(g, rules, random, steps)
	return mj_run_parallel_rules_with_count(g, rules, random, steps)
}

mj_prepare_node_states :: proc(g: ^Grid, nodes: []MJ_Node) -> []MJ_Markov_State {
	states := make([]MJ_Markov_State, len(nodes))
	for i in 0..<len(nodes) {
		states[i].last_turn = -1
		if nodes[i].kind == 1 {
			states[i].match_mask = make([][]bool, nodes[i].count)
			for r in 0..<nodes[i].count { states[i].match_mask[r] = make([]bool, len(g.state)) }
		}
	}
	return states
}

mj_destroy_node_states :: proc(states: []MJ_Markov_State) {
	for i in 0..<len(states) {
		if states[i].matches != nil do delete(states[i].matches)
		if states[i].match_mask != nil {
			for r in 0..<len(states[i].match_mask) { if states[i].match_mask[r] != nil do delete(states[i].match_mask[r]) }
			delete(states[i].match_mask)
		}
	}
	delete(states)
}

mj_markov_nodes_go :: proc(g: ^Grid, rules: []Rule, nodes: []MJ_Node, random: ^MJRandom, states: []MJ_Markov_State, counters: []int, changes: ^[dynamic]Cell, first: ^[dynamic]int, counter: int) -> bool {
	for i := 0; i < len(nodes); i += 1 {
		node := nodes[i]
		if node.kind >= 4 && node.children_count > 0 {
			if node.steps > 0 && counters[i] >= node.steps { i += node.children_count; continue }
			node_changed := false
			if node.kind == 4 {
				node_changed = mj_markov_nodes_go(g, rules, nodes[node.children_start:node.children_start + node.children_count], random, states[node.children_start:node.children_start + node.children_count], counters[node.children_start:node.children_start + node.children_count], changes, first, counter)
			} else {
				_, node_changed = mj_run_sequence_nodes_with_count(g, rules, nodes[node.children_start:node.children_start + node.children_count], random, 1)
			}
			if node_changed {
				counters[i] += 1
				return true
			}
			i += node.children_count
			continue
		}
		if node.count <= 0 { continue }
		if node.steps > 0 && counters[i] >= node.steps { continue }
		if node.kind == 1 {
			if mj_markov_one_go(g, rules[node.start:node.start + node.count], random, &states[i], changes[:], first[:], counter, changes) {
				counters[i] += 1
				return true
			}
		} else {
			_, node_changed := mj_run_node_rules_with_count(g, node.kind, rules[node.start:node.start + node.count], random, 1)
			if node_changed {
				counters[i] += 1
				return true
			}
		}
	}
	return false
}

mj_run_markov_nodes_with_count :: proc(g: ^Grid, rules: []Rule, nodes: []MJ_Node, random: ^MJRandom, steps: int) -> (int, bool) {
	counter := 0
	changed_any := false
	states := mj_prepare_node_states(g, nodes)
	defer mj_destroy_node_states(states)
	counters := make([]int, len(nodes))
	defer delete(counters)

	changes := make([dynamic]Cell)
	defer delete(changes)
	first := make([dynamic]int)
	defer delete(first)
	append(&first, 0)

	for steps <= 0 || counter < steps {
		changed := mj_markov_nodes_go(g, rules, nodes, random, states, counters, &changes, &first, counter)
		if !changed { break }
		changed_any = true
		counter += 1
		append(&first, len(changes))
	}
	return counter, changed_any
}

mj_reset_runtime_range :: proc(states: []MJ_Markov_State, counters, positions: []int, start, count: int) {
	for i in start..<start + count {
		counters[i] = 0
		positions[i] = 0
		states[i].last_turn = -1
		if states[i].matches != nil do clear(&states[i].matches)
		if states[i].match_mask != nil {
			for r in 0..<len(states[i].match_mask) { for c in 0..<len(states[i].match_mask[r]) { states[i].match_mask[r][c] = false } }
		}
	}
}

mj_sequence_range_go :: proc(g: ^Grid, rules: []Rule, nodes: []MJ_Node, start, count: int, random: ^MJRandom, states: []MJ_Markov_State, counters, positions: []int, changes: ^[dynamic]Cell, first: ^[dynamic]int, counter: int, child: ^int) -> bool {
	for child^ < count {
		idx := start + child^
		node := nodes[idx]
		if node.kind >= 4 && node.children_count > 0 {
			if node.steps > 0 && counters[idx] >= node.steps {
				child^ += node.children_count + 1
				continue
			}
			node_changed := false
			if node.kind == 4 {
				node_changed = mj_markov_nodes_go(g, rules, nodes[node.children_start:node.children_start + node.children_count], random, states[node.children_start:node.children_start + node.children_count], counters[node.children_start:node.children_start + node.children_count], changes, first, counter)
			} else {
				node_changed = mj_sequence_range_go(g, rules, nodes, node.children_start, node.children_count, random, states, counters, positions, changes, first, counter, &positions[idx])
			}
			if node_changed {
				counters[idx] += 1
				return true
			}
			child^ += node.children_count + 1
			continue
		}
		if node.count <= 0 || (node.steps > 0 && counters[idx] >= node.steps) {
			child^ += 1
			continue
		}
		if node.kind == 1 {
			if mj_markov_one_go(g, rules[node.start:node.start + node.count], random, &states[idx], changes[:], first[:], counter, changes) {
				counters[idx] += 1
				return true
			}
		} else {
			_, node_changed := mj_run_node_rules_with_count(g, node.kind, rules[node.start:node.start + node.count], random, 1)
			if node_changed {
				counters[idx] += 1
				return true
			}
		}
		child^ += 1
	}
	mj_reset_runtime_range(states, counters, positions, start, count)
	child^ = 0
	return false
}

mj_run_sequence_nodes_with_count :: proc(g: ^Grid, rules: []Rule, nodes: []MJ_Node, random: ^MJRandom, steps: int) -> (int, bool) {
	states := mj_prepare_node_states(g, nodes)
	defer mj_destroy_node_states(states)
	counters := make([]int, len(nodes))
	defer delete(counters)
	positions := make([]int, len(nodes))
	defer delete(positions)
	changes := make([dynamic]Cell)
	defer delete(changes)
	first := make([dynamic]int)
	defer delete(first)
	append(&first, 0)

	child := 0
	counter := 0
	changed_any := false
	for child < len(nodes) && (steps <= 0 || counter < steps) {
		changed := mj_sequence_range_go(g, rules, nodes, 0, len(nodes), random, states, counters, positions, &changes, &first, counter, &child)
		if changed do changed_any = true
		counter += 1
		append(&first, len(changes))
		if !changed && steps <= 0 { break }
	}
	return counter, changed_any
}

mj_markov_one_go :: proc(g: ^Grid, rules: []Rule, random: ^MJRandom, state: ^MJ_Markov_State, changes_snapshot: []Cell, first: []int, turn: int, changes: ^[dynamic]Cell) -> bool {
	if len(rules) == 0 { return false }
	if state.last_turn >= 0 {
		start := first[state.last_turn]
		for ci := start; ci < len(changes_snapshot); ci += 1 {
			c := changes_snapshot[ci]
			value := g.state[c.x + c.y * g.mx + c.z * g.mx * g.my]
			for r in 0..<len(rules) {
				rule := &rules[r]
				for shift in rule.ishifts[value] {
					mj_markov_one_try_add(g, rules, r, c.x - shift.x, c.y - shift.y, c.z - shift.z, state)
				}
			}
		}
	} else {
		clear(&state.matches)
		for r in 0..<len(state.match_mask) { for i in 0..<len(state.match_mask[r]) { state.match_mask[r][i] = false } }
		for r in 0..<len(rules) {
			rule := &rules[r]
			for z := rule.imz - 1; z < g.mz; z += rule.imz {
				for y := rule.imy - 1; y < g.my; y += rule.imy {
					for x := rule.imx - 1; x < g.mx; x += rule.imx {
						value := g.state[x + y * g.mx + z * g.mx * g.my]
						for shift in rule.ishifts[value] {
							mj_markov_one_try_add(g, rules, r, x - shift.x, y - shift.y, z - shift.z, state)
						}
					}
				}
			}
		}
	}
	state.last_turn = turn

	for len(state.matches) > 0 {
		arg := int(mj_random_next_max(random, i32(len(state.matches))))
		m := state.matches[arg]
		si := m.x + m.y * g.mx + m.z * g.mx * g.my
		state.match_mask[m.r][si] = false
		state.matches[arg] = state.matches[len(state.matches) - 1]
		_ = pop(&state.matches)

		if grid_matches(g, &rules[m.r], m.x, m.y, m.z) {
			one_apply(g, &rules[m.r], m.x, m.y, m.z, changes)
			return true
		}
	}
	return false
}

mj_markov_one_try_add :: proc(g: ^Grid, rules: []Rule, r, sx, sy, sz: int, state: ^MJ_Markov_State) {
	rule := &rules[r]
	if sx < 0 || sy < 0 || sz < 0 || sx + rule.imx > g.mx || sy + rule.imy > g.my || sz + rule.imz > g.mz { return }
	si := sx + sy * g.mx + sz * g.mx * g.my
	if !state.match_mask[r][si] && grid_matches(g, rule, sx, sy, sz) {
		state.match_mask[r][si] = true
		append(&state.matches, Match{r, sx, sy, sz})
	}
}

mj_run_one_rules_with_count :: proc(g: ^Grid, rules: []Rule, random: ^MJRandom, steps: int) -> (int, bool) {
	matches := make([dynamic]Match)
	defer delete(matches)
	match_mask := make([][]bool, len(rules))
	defer {
		for i in 0..<len(match_mask) { if match_mask[i] != nil do delete(match_mask[i]) }
		delete(match_mask)
	}
	for r in 0..<len(rules) { match_mask[r] = make([]bool, len(g.state)) }
	one_initial_scan(g, rules, &matches, match_mask)
	changes := make([dynamic]Cell)
	defer delete(changes)

	counter := 0
	changed := false
	for (steps <= 0 || counter < steps) && len(matches) > 0 {
		for len(matches) > 0 {
			match_index := int(mj_random_next_max(random, i32(len(matches))))
			m := matches[match_index]
			i := m.x + m.y * g.mx + m.z * g.mx * g.my
			match_mask[m.r][i] = false
			matches[match_index] = matches[len(matches) - 1]
			_ = pop(&matches)

			if grid_matches(g, &rules[m.r], m.x, m.y, m.z) {
				clear(&changes)
				one_apply(g, &rules[m.r], m.x, m.y, m.z, &changes)
				one_add_around_changes(g, rules, changes[:], &matches, match_mask)
				counter += 1
				changed = true
				break
			}
		}
	}
	return counter, changed
}

mj_run_all_rules_with_count :: proc(g: ^Grid, rules: []Rule, random: ^MJRandom, steps: int) -> (int, bool) {
	matches := make([dynamic]Match)
	defer delete(matches)
	match_mask := make([][]bool, len(rules))
	defer {
		for i in 0..<len(match_mask) { if match_mask[i] != nil do delete(match_mask[i]) }
		delete(match_mask)
	}
	for r in 0..<len(rules) { match_mask[r] = make([]bool, len(g.state)) }

	mask := make([]bool, len(g.state))
	defer delete(mask)
	previous_changes := make([dynamic]Cell)
	defer delete(previous_changes)
	current_changes := make([dynamic]Cell)
	defer delete(current_changes)

	counter := 0
	changed := false
	first_turn := true
	for steps <= 0 || counter < steps {
		clear(&matches)
		if first_turn {
			one_initial_scan(g, rules, &matches, match_mask)
			first_turn = false
		} else {
			one_add_around_changes(g, rules, previous_changes[:], &matches, match_mask)
		}

		if len(matches) == 0 { break }

		shuffle := make([]int, len(matches))
		for i in 0..<len(shuffle) {
			j := int(mj_random_next_max(random, i32(i + 1)))
			shuffle[i] = shuffle[j]
			shuffle[j] = i
		}

		clear(&current_changes)
		for k in 0..<len(shuffle) {
			m := matches[shuffle[k]]
			si := m.x + m.y * g.mx + m.z * g.mx * g.my
			match_mask[m.r][si] = false
			all_fit(g, &rules[m.r], m.x, m.y, m.z, mask, &current_changes)
		}
		delete(shuffle)

		for c in current_changes { mask[c.x + c.y * g.mx + c.z * g.mx * g.my] = false }

		clear(&previous_changes)
		for c in current_changes { append(&previous_changes, c) }

		counter += 1
		changed = true
	}
	return counter, changed
}

mj_run_parallel_rules_with_count :: proc(g: ^Grid, rules: []Rule, random: ^MJRandom, steps: int) -> (int, bool) {
	current_changes := make([dynamic]Cell)
	defer delete(current_changes)
	newstate := make([]u8, len(g.state))
	defer delete(newstate)

	counter := 0
	changed := false
	for steps <= 0 || counter < steps {
		clear(&current_changes)
		parallel_initial_scan(g, rules, random, newstate, &current_changes)

		if len(current_changes) == 0 { break }

		for c in current_changes {
			i := c.x + c.y * g.mx + c.z * g.mx * g.my
			g.state[i] = newstate[i]
		}

		counter += 1
		changed = true
	}
	return counter, changed
}

mj_any_one_match :: proc(g: ^Grid, rules: []Rule) -> bool {
	for r in 0..<len(rules) {
		rule := &rules[r]
		for z := rule.imz - 1; z < g.mz; z += rule.imz {
			for y := rule.imy - 1; y < g.my; y += rule.imy {
				for x := rule.imx - 1; x < g.mx; x += rule.imx {
					value := g.state[x + y * g.mx + z * g.mx * g.my]
					for shift in rule.ishifts[value] {
						sx := x - shift.x; sy := y - shift.y; sz := z - shift.z
						if sx < 0 || sy < 0 || sz < 0 || sx + rule.imx > g.mx || sy + rule.imy > g.my || sz + rule.imz > g.mz { continue }
						if grid_matches(g, rule, sx, sy, sz) { return true }
					}
				}
			}
		}
	}
	return false
}

mj_respond_grid :: proc(g: ^Grid, steps_run: u32, changed, done: bool) -> u32 {
	values_len := len(g.characters)
	cell_count := len(g.state)
	out_pos := 0
	if out_pos + 32 + values_len + cell_count > len(mj_output_buffer) { return mj_fail("result too large") }
	mj_output_buffer[0] = 'M'; mj_output_buffer[1] = 'J'; mj_output_buffer[2] = 'R'; mj_output_buffer[3] = 'O'
	out_pos = 4
	_ = mj_write_u32(&out_pos, u32(g.mx)); _ = mj_write_u32(&out_pos, u32(g.my)); _ = mj_write_u32(&out_pos, u32(g.mz))
	_ = mj_write_u32(&out_pos, steps_run)
	_ = mj_write_u32(&out_pos, 0); if changed { mj_output_buffer[out_pos - 4] = 1 }
	_ = mj_write_u32(&out_pos, 0); if done { mj_output_buffer[out_pos - 4] = 1 }
	_ = mj_write_u32(&out_pos, u32(values_len))
	copy(mj_output_buffer[out_pos:out_pos + values_len], transmute([]u8)g.characters); out_pos += values_len
	_ = mj_write_u32(&out_pos, u32(cell_count))
	copy(mj_output_buffer[out_pos:out_pos + cell_count], g.state)
	mj_output_len = out_pos + cell_count
	return 0
}
