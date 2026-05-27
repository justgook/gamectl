package markov_junior

import mem "core:mem"
import runtime "base:runtime"

MJ_OUTPUT_CAPACITY :: 8 * 1024 * 1024
mj_output_buffer: [MJ_OUTPUT_CAPACITY]u8
mj_output_len: int

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

	for _ in 0..<rule_count {
		op := mj_read_u32(model, &pos, &ok)
		if !ok { return mj_fail("truncated model-ir rule opcode") }
		if op == 1 {
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
			symmetry_len := int(mj_read_u32(model, &pos, &ok))
			if !ok || imx <= 0 || imy <= 0 || imz <= 0 || omx <= 0 || omy <= 0 || omz <= 0 || symmetry_len < 0 { return mj_fail("invalid pattern rule header") }
			if pos + symmetry_len > len(model) { return mj_fail("truncated pattern rule symmetry") }
			symmetry := string(model[pos:pos + symmetry_len]); pos += symmetry_len
			input_len := imx * imy * imz
			output_len := omx * omy * omz
			if pos + input_len + output_len > len(model) { return mj_fail("truncated pattern rule data") }
			input_chars := model[pos:pos + input_len]; pos += input_len
			output_chars := model[pos:pos + output_len]; pos += output_len
			base := rule_from_char_arrays(&g, input_chars, imx, imy, imz, output_chars, omx, omy, omz)
			append_rule_symmetries(&g, &rules, base, symmetry)
		} else {
			return mj_fail("unsupported model-ir rule opcode")
		}
	}

	random := mj_random_init(i32(seed & 0x7fffffff))
	steps_run, changed := mj_run_one_rules_with_count(&g, rules[:], &random, int(max_steps))
	done := !mj_any_one_match(&g, rules[:])

	return mj_respond_grid(&g, u32(steps_run), changed, done)
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
