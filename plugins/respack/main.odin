package respack

import jsmn "jsmn"
import pdk "pdk"

SCHEMA_BUFFER_CAPACITY :: 256 * 1024
MAX_SLOTS :: 512
PAYLOAD_CAPACITY :: 2 * 1024 * 1024
SCHEMA_TOKEN_MAX :: 4096
WRITE_TOKEN_MAX :: 512

SlotValue :: struct {
	has_value: bool,
	offset: int,
	length: int,
}

schema_buffer: [SCHEMA_BUFFER_CAPACITY]u8
schema_len: int
payload_buffer: [PAYLOAD_CAPACITY]u8
payload_used: int
scratch_buffer: [PAYLOAD_CAPACITY]u8
slots: [MAX_SLOTS]SlotValue
writer_initialized: bool

@(export)
init :: proc() -> u32 {
	input := pdk.input_bytes()
	ok, err := handle_init(input)
	if !ok {
		return respond_error(err)
	}
	return respond_ok("ok")
}

@(export)
write :: proc() -> u32 {
	input := pdk.input_bytes()
	ok, err := handle_write(input)
	if !ok {
		return respond_error(err)
	}
	return respond_ok("ok")
}

@(export)
dump :: proc() -> u32 {
	if !writer_initialized {
		return respond_error("writer not initialized")
	}
	output, err := build_dump_bytes()
	if err != "" {
		return respond_error(err)
	}
	pdk.output_bytes(output)
	return 0
}

@(export)
generate_odin :: proc() -> u32 {
	if !writer_initialized {
		return respond_error("writer not initialized")
	}
	package_name := string(pdk.input_bytes())
	if package_name == "" {
		package_name = "respack_generated"
	}
	source, err := build_odin_decoder(package_name)
	if err != "" {
		return respond_error(err)
	}
	pdk.output_string(source)
	return 0
}

respond_ok :: proc(msg: string) -> u32 {
	pdk.output_string(msg)
	return 0
}

respond_error :: proc(msg: string) -> u32 {
	pdk.output_string(msg)
	return 1
}

handle_init :: proc(input: []u8) -> (bool, string) {
	if len(input) == 0 {
		return false, "schema input empty"
	}
	if len(input) > SCHEMA_BUFFER_CAPACITY {
		return false, "schema too large"
	}
	reset_state()
	copy(schema_buffer[:len(input)], input)
	schema_len = len(input)
	ok, err := compile_schema(schema_buffer[:schema_len])
	if !ok {
		reset_state()
		return false, err
	}
	writer_initialized = true
	return true, ""
}

handle_write :: proc(input: []u8) -> (bool, string) {
	if !writer_initialized {
		return false, "writer not initialized"
	}
	if len(input) == 0 {
		return false, "write payload empty"
	}
	request, err := parse_write_request(input)
	if err != "" {
		return false, err
	}
	if request.slot < 0 || request.slot >= data_slot_count {
		return false, "slot index out of range"
	}
	payload := input[request.payload_start:request.payload_end]
	ok, encode_err := encode_payload_for_slot(request.slot, payload)
	if !ok {
		return false, encode_err
	}
	return true, ""
}

reset_state :: proc() {
	schema_len = 0
	payload_used = 0
	reset_schema_state()
	for i in 0..<MAX_SLOTS {
		slots[i] = SlotValue{}
	}
	writer_initialized = false
}

WriteRequest :: struct {
	slot: int,
	payload_start: int,
	payload_end: int,
}

parse_write_request :: proc(input: []u8) -> (WriteRequest, string) {
	slot_start, slot_end, has_slot := find_top_level_value_bounds(input, "slot")
	if !has_slot {
		return WriteRequest{}, "slot field missing"
	}
	payload_start, payload_end, has_payload := find_top_level_value_bounds(input, "payload")
	if !has_payload {
		return WriteRequest{}, "payload missing"
	}
	slot_value, ok := parse_i64_bytes(input[slot_start:slot_end])
	if !ok {
		return WriteRequest{}, "slot parse error"
	}
	req := WriteRequest{slot = int(slot_value), payload_start = payload_start, payload_end = payload_end}
	if req.payload_start < 0 || req.payload_end <= req.payload_start || req.payload_end > len(input) {
		return WriteRequest{}, "payload bounds invalid"
	}
	return req, ""
}

token_matches :: proc(input: []u8, tok: jsmn.Token, text: string) -> bool {
	if tok.start < 0 || tok.end < 0 {
		return false
	}
	span := tok.end - tok.start
	if span != len(text) {
		return false
	}
	for i in 0..<span {
		if input[tok.start + i] != text[i] {
			return false
		}
	}
	return true
}

parse_int_token :: proc(input: []u8, tok: jsmn.Token) -> (int, bool) {
	value, ok := parse_i64_bytes(input[tok.start:tok.end])
	if !ok {
		return 0, false
	}
	return int(value), true
}

json_error_string :: proc(code: int) -> string {
	switch code {
	case int(jsmn.JsmnError.NoMemory):
		return "json parser: token pool exhausted"
	case int(jsmn.JsmnError.Invalid):
		return "json parser: invalid data"
	case int(jsmn.JsmnError.Partial):
		return "json parser: incomplete data"
	case:
		return "json parser error"
	}
}
