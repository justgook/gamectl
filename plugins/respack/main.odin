package respack

import jsmn "jsmn"
import pdk "pdk"

SCHEMA_BUFFER_CAPACITY :: 256 * 1024
MAX_SLOTS :: 512
PAYLOAD_CAPACITY :: 2 * 1024 * 1024
SCHEMA_TOKEN_MAX :: 4096
WRITE_TOKEN_MAX :: 256

SlotValue :: struct {
	has_value: bool,
	offset: int,
	length: int,
}

schema_buffer: [SCHEMA_BUFFER_CAPACITY]u8
schema_len: int
slot_count: int
payload_buffer: [PAYLOAD_CAPACITY]u8
payload_used: int
slots: [MAX_SLOTS]SlotValue
writer_initialized: bool

string_bytes :: proc(text: string) -> []u8 {
	return transmute([]byte)text
}

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
	return respond_error("dump not implemented yet")
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
	slot_total, err := parse_schema_slot_count(input)
	if err != "" {
		return false, err
	}
	if slot_total > MAX_SLOTS {
		return false, "schema data array exceeds slot limit"
	}
	input_len := len(input)
	if input_len > SCHEMA_BUFFER_CAPACITY {
		return false, "schema too large"
	}
	reset_state()
	copy(schema_buffer[:input_len], input)
	schema_len = input_len
	slot_count = slot_total
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
	if request.slot < 0 || request.slot >= slot_count {
		return false, "slot index out of range"
	}
	payload := input[request.payload_start:request.payload_end]
	ok, store_err := store_payload(request.slot, payload)
	if !ok {
		return false, store_err
	}
	return true, ""
}

reset_state :: proc() {
	schema_len = 0
	slot_count = 0
	payload_used = 0
	for i in 0..<MAX_SLOTS {
		slots[i].has_value = false
		slots[i].offset = 0
		slots[i].length = 0
	}
	writer_initialized = false
}

parse_schema_slot_count :: proc(input: []u8) -> (int, string) {
	parser: jsmn.Parser
	jsmn.init(&parser)
	tokens_array: [SCHEMA_TOKEN_MAX]jsmn.Token
	tokens := tokens_array[:]
	count := jsmn.parse(&parser, input, tokens)
	if count < 0 {
		return 0, json_error_string(count)
	}
	limit := count - 1
	if limit <= 0 {
		return 0, "schema missing data array"
	}
	for i in 0..<limit {
		tok := tokens[i]
		if tok.type == jsmn.JsmnType.String && token_matches(input, tok, "data") {
			next := tokens[i + 1]
			if next.type != jsmn.JsmnType.Array {
				return 0, "schema data is not array"
			}
			return next.size, ""
		}
	}
	return 0, "schema missing data array"
}

WriteRequest :: struct {
	slot: int,
	payload_start: int,
	payload_end: int,
}

parse_write_request :: proc(input: []u8) -> (WriteRequest, string) {
	parser: jsmn.Parser
	jsmn.init(&parser)
	tokens_array: [WRITE_TOKEN_MAX]jsmn.Token
	tokens := tokens_array[:]
	count := jsmn.parse(&parser, input, tokens)
	if count < 0 {
		return WriteRequest{}, json_error_string(count)
	}
	limit := count - 1
	if limit <= 0 {
		return WriteRequest{}, "write payload malformed"
	}
	input_len := len(input)
	req := WriteRequest{slot = -1}
	payload_found := false
	for i in 0..<limit {
		tok := tokens[i]
		if tok.type != jsmn.JsmnType.String {
			continue
		}
		val := tokens[i + 1]
		if token_matches(input, tok, "slot") {
			if val.type != jsmn.JsmnType.Primitive {
				return WriteRequest{}, "slot must be number"
			}
			slot_value, ok := parse_int_token(input, val)
			if !ok {
				return WriteRequest{}, "slot parse error"
			}
			req.slot = slot_value
		}
		if token_matches(input, tok, "payload") {
			req.payload_start = val.start
			req.payload_end = val.end
			payload_found = true
		}
	}
	if req.slot < 0 {
		return WriteRequest{}, "slot field missing"
	}
	if !payload_found {
		return WriteRequest{}, "payload missing"
	}
	if req.payload_start < 0 || req.payload_end <= req.payload_start || req.payload_end > input_len {
		return WriteRequest{}, "payload bounds invalid"
	}
	return req, ""
}

token_matches :: proc(input: []u8, tok: jsmn.Token, text: string) -> bool {
	if tok.start < 0 || tok.end < 0 {
		return false
	}
	bytes := string_bytes(text)
	span := tok.end - tok.start
	if span != len(bytes) {
		return false
	}
	for i in 0..<span {
		if input[tok.start + i] != bytes[i] {
			return false
		}
	}
	return true
}

parse_int_token :: proc(input: []u8, tok: jsmn.Token) -> (int, bool) {
	if tok.start < 0 || tok.end <= tok.start {
		return 0, false
	}
	slice := input[tok.start:tok.end]
	if len(slice) == 0 {
		return 0, false
	}
	neg := false
	idx := 0
	if slice[0] == '-' {
		neg = true
		idx = 1
	}
	if idx >= len(slice) {
		return 0, false
	}
	value := 0
	for idx < len(slice) {
		c := slice[idx]
		if c < '0' || c > '9' {
			return 0, false
		}
		value = value * 10 + int(c - '0')
		idx += 1
	}
	if neg {
		value = -value
	}
	return value, true
}

store_payload :: proc(slot_index: int, data: []u8) -> (bool, string) {
	data_len := len(data)
	if data_len > PAYLOAD_CAPACITY {
		return false, "payload too large"
	}
	slot := &slots[slot_index]
	if slot.has_value && data_len <= slot.length {
		dst := payload_buffer[slot.offset:slot.offset+data_len]
		copy(dst, data)
		slot.length = data_len
		return true, ""
	}
	if payload_used + data_len > PAYLOAD_CAPACITY {
		return false, "payload storage exhausted"
	}
	offset := payload_used
	dst := payload_buffer[offset:offset+data_len]
	copy(dst, data)
	payload_used += data_len
	slot.offset = offset
	slot.length = data_len
	slot.has_value = true
	return true, ""
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
