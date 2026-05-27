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
	pos += values_len
	rule_count := int(mj_read_u32(model, &pos, &ok))
	if !ok || rule_count < 0 { return mj_fail("invalid model-ir rule count") }
	if rule_count != 1 { return mj_fail("MVP supports exactly one rule") }
	op := mj_read_u32(model, &pos, &ok)
	if !ok || op != 1 { return mj_fail("MVP supports only one-cell replace rule") }
	if pos + 2 > len(model) { return mj_fail("truncated one-cell replace rule") }
	input := model[pos]
	output := model[pos + 1]
	pos += 2

	cell_count_u64 := u64(width) * u64(height) * u64(depth)
	if cell_count_u64 > u64(len(initial)) { return mj_fail("initial-cells shorter than configured grid") }
	cell_count := int(cell_count_u64)
	if cell_count > MJ_OUTPUT_CAPACITY { return mj_fail("grid too large for MVP output buffer") }

	out_pos := 0
	if out_pos + 28 + values_len + cell_count > len(mj_output_buffer) { return mj_fail("result too large") }
	mj_output_buffer[0] = 'M'; mj_output_buffer[1] = 'J'; mj_output_buffer[2] = 'R'; mj_output_buffer[3] = 'O'
	out_pos = 4
	_ = mj_write_u32(&out_pos, width)
	_ = mj_write_u32(&out_pos, height)
	_ = mj_write_u32(&out_pos, depth)
	steps_run_pos := out_pos; _ = mj_write_u32(&out_pos, 0)
	changed_pos := out_pos; _ = mj_write_u32(&out_pos, 0)
	done_pos := out_pos; _ = mj_write_u32(&out_pos, 0)
	_ = mj_write_u32(&out_pos, u32(values_len))
	copy(mj_output_buffer[out_pos:out_pos + values_len], model[values_start:values_start + values_len])
	out_pos += values_len
	_ = mj_write_u32(&out_pos, u32(cell_count))
	copy(mj_output_buffer[out_pos:out_pos + cell_count], initial[:cell_count])

	matches := make([]int, cell_count)
	defer delete(matches)
	match_count := 0
	for i in 0..<cell_count {
		if mj_output_buffer[out_pos + i] == input {
			matches[match_count] = i
			match_count += 1
		}
	}

	random := mj_random_init(i32(seed & 0x7fffffff))
	steps_run: u32 = 0
	changed := false
	for steps_run < max_steps && match_count > 0 {
		match_index := int(mj_random_next_max(&random, i32(match_count)))
		cell_index := matches[match_index]
		matches[match_index] = matches[match_count - 1]
		match_count -= 1

		if mj_output_buffer[out_pos + cell_index] == input {
			mj_output_buffer[out_pos + cell_index] = output
			steps_run += 1
			changed = true
		}
	}

	done := true
	for i in 0..<cell_count {
		if mj_output_buffer[out_pos + i] == input {
			done = false
			break
		}
	}
	mj_output_buffer[steps_run_pos + 0] = u8(steps_run & 0xff)
	mj_output_buffer[steps_run_pos + 1] = u8((steps_run >> 8) & 0xff)
	mj_output_buffer[steps_run_pos + 2] = u8((steps_run >> 16) & 0xff)
	mj_output_buffer[steps_run_pos + 3] = u8((steps_run >> 24) & 0xff)
	mj_output_buffer[changed_pos] = 0
	if changed { mj_output_buffer[changed_pos] = 1 }
	mj_output_buffer[done_pos] = 0
	if done { mj_output_buffer[done_pos] = 1 }
	mj_output_len = out_pos + cell_count
	return 0
}
