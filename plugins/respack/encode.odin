package respack

import jsmn "jsmn"

RSPK_MAGIC_0 :: u8('R')
RSPK_MAGIC_1 :: u8('S')
RSPK_MAGIC_2 :: u8('P')
RSPK_MAGIC_3 :: u8('K')
RSPK_VERSION :: u16(1)

encode_payload_for_slot :: proc(slot_index: int, payload: []u8) -> (bool, string) {
	writer := BinaryWriter{}
	type_idx := data_slots[slot_index]
	field := FieldDef{type_index = type_idx, default_token = -1, max_len = -1}
	ok, err := encode_json_value(&writer, payload, type_idx, field)
	if !ok {
		return false, err
	}
	return store_payload(slot_index, scratch_buffer[:writer.len])
}

BinaryWriter :: struct {
	len: int,
}

writer_write :: proc(w: ^BinaryWriter, data: []u8) -> bool {
	if w.len + len(data) > len(scratch_buffer) {
		return false
	}
	copy(scratch_buffer[w.len:w.len+len(data)], data)
	w.len += len(data)
	return true
}

writer_u8 :: proc(w: ^BinaryWriter, value: u8) -> bool {
	if w.len + 1 > len(scratch_buffer) {
		return false
	}
	scratch_buffer[w.len] = value
	w.len += 1
	return true
}

writer_u16 :: proc(w: ^BinaryWriter, value: u16) -> bool {
	return writer_u8(w, u8(value & 0xff)) && writer_u8(w, u8((value >> 8) & 0xff))
}

writer_u32 :: proc(w: ^BinaryWriter, value: u32) -> bool {
	return writer_u8(w, u8(value & 0xff)) && writer_u8(w, u8((value >> 8) & 0xff)) && writer_u8(w, u8((value >> 16) & 0xff)) && writer_u8(w, u8((value >> 24) & 0xff))
}

writer_u64 :: proc(w: ^BinaryWriter, value: u64) -> bool {
	for shift in 0..<8 {
		if !writer_u8(w, u8((value >> (8 * u64(shift))) & 0xff)) {
			return false
		}
	}
	return true
}

encode_json_value :: proc(w: ^BinaryWriter, raw_input: []u8, type_idx: int, field: FieldDef) -> (bool, string) {
	input := trim_space_slice(raw_input)
	type_def := types[type_idx]
	#partial switch type_def.kind {
	case .Alias:
		return encode_json_value(w, input, type_def.target_type, field)
	case .Bool:
		if bytes_equal_string(input, "true") {
			if !writer_u8(w, 1) { return false, "payload too large" }
			return true, ""
		}
		if bytes_equal_string(input, "false") {
			if !writer_u8(w, 0) { return false, "payload too large" }
			return true, ""
		}
		return false, "invalid bool"
	case .U8, .U16, .U32, .U64, .I8, .I16, .I32, .I64:
		return encode_integer_bytes(w, input, type_def.kind, field)
	case .F32, .F64:
		return encode_float_bytes(w, input, type_def.kind, field)
	case .String:
		if len(input) < 2 || input[0] != '"' || input[len(input)-1] != '"' {
			return false, "expected string"
		}
		bytes := input[1:len(input)-1]
		max_len := effective_type_max_len(type_idx, field)
		if max_len >= 0 && len(bytes) > max_len {
			return false, "string exceeds max_len"
		}
		if !writer_u32(w, u32(len(bytes))) || !writer_write(w, bytes) {
			return false, "payload too large"
		}
		return true, ""
	case .Bytes:
		return encode_bytes_value(w, input, type_idx, field)
	case .Enum:
		return encode_enum_bytes(w, input, type_idx)
	case .Struct:
		if len(input) == 0 || input[0] != '{' {
			return false, "expected object"
		}
		for i in 0..<type_def.field_count {
			field_idx := type_def.field_start + i
			child_slice, found := find_object_field_slice(input, field_name_string(field_idx))
			if !found {
				if !fields[field_idx].has_default {
					return false, "missing required field"
				}
				ok, err := encode_schema_default(w, field_idx)
				if !ok {
					return false, err
				}
				continue
			}
			ok, err := encode_json_value(w, child_slice, fields[field_idx].type_index, fields[field_idx])
			if !ok {
				return false, err
			}
		}
		return true, ""
	case .Array:
		if len(input) == 0 || input[0] != '[' {
			return false, "expected array"
		}
		if count_array_elements(input) != type_def.fixed_len {
			return false, "array length mismatch"
		}
		cursor := 1
		for {
			element, next_cursor, found := next_array_element(input, cursor)
			if !found {
				break
			}
			ok, err := encode_json_value(w, element, type_def.target_type, FieldDef{type_index = type_def.target_type, default_token = -1, max_len = -1})
			if !ok {
				return false, err
			}
			cursor = next_cursor
		}
		return true, ""
	case .Vector:
		if len(input) == 0 || input[0] != '[' {
			return false, "expected array"
		}
		child_count := count_array_elements(input)
		if !writer_u32(w, u32(child_count)) {
			return false, "payload too large"
		}
		cursor := 1
		for {
			element, next_cursor, found := next_array_element(input, cursor)
			if !found {
				break
			}
			ok, err := encode_json_value(w, element, type_def.target_type, FieldDef{type_index = type_def.target_type, default_token = -1, max_len = -1})
			if !ok {
				return false, err
			}
			cursor = next_cursor
		}
		return true, ""
	case .Oneof:
		return false, "oneof encoding not implemented yet"
	case:
		return false, "unsupported type"
	}
}

encode_schema_default :: proc(w: ^BinaryWriter, field_idx: int) -> (bool, string) {
	field := fields[field_idx]
	if !field.has_default || field.default_token < 0 {
		return false, "missing required field"
	}
	default_tok := schema_tokens[field.default_token]
	default_slice := schema_buffer[default_tok.start:default_tok.end]
	if default_tok.type == jsmn.JsmnType.String && default_tok.start > 0 && default_tok.end < schema_len {
		default_slice = schema_buffer[default_tok.start-1:default_tok.end+1]
	}
	return encode_json_value(w, default_slice, field.type_index, field)
}
encode_integer_bytes :: proc(w: ^BinaryWriter, input: []u8, kind: TypeKind, field: FieldDef) -> (bool, string) {
	value, ok := parse_i64_bytes(trim_space_slice(input))
	if !ok {
		return false, "invalid integer"
	}
	if field.has_min && f64(value) < field.min_value {
		return false, "integer below min"
	}
	if field.has_max && f64(value) > field.max_value {
		return false, "integer above max"
	}
	#partial switch kind {
	case .U8:
		if value < 0 || value > 255 { return false, "u8 out of range" }
		if !writer_u8(w, u8(value)) { return false, "payload too large" }
	case .U16:
		if value < 0 || value > 65535 { return false, "u16 out of range" }
		if !writer_u16(w, u16(value)) { return false, "payload too large" }
	case .U32:
		if value < 0 { return false, "u32 out of range" }
		if !writer_u32(w, u32(value)) { return false, "payload too large" }
	case .U64:
		if value < 0 { return false, "u64 out of range" }
		if !writer_u64(w, u64(value)) { return false, "payload too large" }
	case .I8:
		if value < -128 || value > 127 { return false, "i8 out of range" }
		if !writer_u8(w, transmute(u8)i8(value)) { return false, "payload too large" }
	case .I16:
		if value < -32768 || value > 32767 { return false, "i16 out of range" }
		if !writer_u16(w, transmute(u16)i16(value)) { return false, "payload too large" }
	case .I32:
		if value < -2147483648 || value > 2147483647 { return false, "i32 out of range" }
		if !writer_u32(w, transmute(u32)i32(value)) { return false, "payload too large" }
	case .I64:
		if !writer_u64(w, transmute(u64)value) { return false, "payload too large" }
	case:
		return false, "unsupported integer kind"
	}
	return true, ""
}

encode_float_bytes :: proc(w: ^BinaryWriter, input: []u8, kind: TypeKind, field: FieldDef) -> (bool, string) {
	value, ok := parse_f64_bytes(trim_space_slice(input))
	if !ok {
		return false, "invalid number"
	}
	if field.has_min && value < field.min_value {
		return false, "number below min"
	}
	if field.has_max && value > field.max_value {
		return false, "number above max"
	}
	if kind == .F32 {
		bits := transmute(u32)f32(value)
		if !writer_u32(w, bits) { return false, "payload too large" }
		return true, ""
	}
	bits := transmute(u64)value
	if !writer_u64(w, bits) { return false, "payload too large" }
	return true, ""
}

encode_enum_bytes :: proc(w: ^BinaryWriter, input: []u8, type_idx: int) -> (bool, string) {
	value: i64 = 0
	matched := false
	trimmed := trim_space_slice(input)
	if len(trimmed) >= 2 && trimmed[0] == '"' && trimmed[len(trimmed)-1] == '"' {
		name := trimmed[1:len(trimmed)-1]
		for i in 0..<types[type_idx].enum_count {
			enum_idx := types[type_idx].enum_start + i
			if bytes_equal_string(name, enum_name_string(enum_idx)) {
				value = enum_values[enum_idx].value
				matched = true
				break
			}
		}
	} else {
		v, ok := parse_i64_bytes(trimmed)
		if ok {
			value = v
			matched = true
		}
	}
	if !matched {
		return false, "invalid enum value"
	}
	if !writer_u32(w, u32(value)) {
		return false, "payload too large"
	}
	return true, ""
}

encode_bytes_value :: proc(w: ^BinaryWriter, input: []u8, type_idx: int, field: FieldDef) -> (bool, string) {
	max_len := effective_type_max_len(type_idx, field)
	if len(input) >= 2 && input[0] == '"' && input[len(input)-1] == '"' {
		bytes := input[1:len(input)-1]
		if max_len >= 0 && len(bytes) > max_len {
			return false, "bytes exceeds max_len"
		}
		if !writer_u32(w, u32(len(bytes))) || !writer_write(w, bytes) {
			return false, "payload too large"
		}
		return true, ""
	}
	if len(input) == 0 || input[0] != '[' {
		return false, "bytes must be string or array"
	}
	count := count_array_elements(input)
	if max_len >= 0 && count > max_len {
		return false, "bytes exceeds max_len"
	}
	if !writer_u32(w, u32(count)) {
		return false, "payload too large"
	}
	cursor := 1
	for {
		element, next_cursor, found := next_array_element(input, cursor)
		if !found {
			break
		}
		value, ok := parse_i64_bytes(trim_space_slice(element))
		if !ok || value < 0 || value > 255 {
			return false, "bytes array values must be u8"
		}
		if !writer_u8(w, u8(value)) {
			return false, "payload too large"
		}
		cursor = next_cursor
	}
	return true, ""
}

trim_space_slice :: proc(data: []u8) -> []u8 {
	start := 0
	end := len(data)
	for start < end && is_space(data[start]) {
		start += 1
	}
	for end > start && is_space(data[end - 1]) {
		end -= 1
	}
	return data[start:end]
}

bytes_equal_string :: proc(data: []u8, text: string) -> bool {
	if len(data) != len(text) {
		return false
	}
	for i in 0..<len(text) {
		if data[i] != text[i] {
			return false
		}
	}
	return true
}

find_object_field_slice :: proc(data: []u8, key: string) -> ([]u8, bool) {
	trimmed := trim_space_slice(data)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return nil, false
	}
	start, end, ok := find_top_level_value_bounds(trimmed, key)
	if !ok {
		return nil, false
	}
	return trimmed[start:end], true
}

count_array_elements :: proc(data: []u8) -> int {
	count := 0
	cursor := 1
	for {
		_, next_cursor, found := next_array_element(data, cursor)
		if !found {
			break
		}
		count += 1
		cursor = next_cursor
	}
	return count
}

next_array_element :: proc(data: []u8, cursor: int) -> ([]u8, int, bool) {
	trimmed := trim_space_slice(data)
	if len(trimmed) == 0 || trimmed[0] != '[' {
		return nil, cursor, false
	}
	i := cursor
	for i < len(trimmed) && is_space(trimmed[i]) {
		i += 1
	}
	if i >= len(trimmed) || trimmed[i] == ']' {
		return nil, i, false
	}
	end, ok := scan_json_value_end(trimmed, i)
	if !ok {
		return nil, i, false
	}
	next_cursor := end
	for next_cursor < len(trimmed) && is_space(trimmed[next_cursor]) {
		next_cursor += 1
	}
	if next_cursor < len(trimmed) && trimmed[next_cursor] == ',' {
		next_cursor += 1
	}
	return trimmed[i:end], next_cursor, true
}

match_oneof_option :: proc(input: []u8, key: jsmn.Token, type_idx: int) -> int {
	for i in 0..<types[type_idx].option_count {
		option_type := oneof_options[types[type_idx].option_start + i]
		if oneof_name_matches(input, key, option_type) {
			return i
		}
	}
	return -1
}

oneof_name_matches :: proc(input: []u8, key: jsmn.Token, option_type: int) -> bool {
	full := type_name_string(option_type)
	if token_matches(input, key, full) {
		return true
	}
	lower := sanitize_identifier(full)
	if token_matches(input, key, lower) {
		return true
	}
	trimmed := trim_variant_suffix(lower)
	if trimmed != lower && token_matches(input, key, trimmed) {
		return true
	}
	return false
}

trim_variant_suffix :: proc(name: string) -> string {
	if has_suffix(name, "_collider") {
		return name[:len(name)-len("_collider")]
	}
	if has_suffix(name, "_shape") {
		return name[:len(name)-len("_shape")]
	}
	return name
}

has_suffix :: proc(value: string, suffix: string) -> bool {
	if len(suffix) > len(value) {
		return false
	}
	start := len(value) - len(suffix)
	for i in 0..<len(suffix) {
		if value[start + i] != suffix[i] {
			return false
		}
	}
	return true
}

store_payload :: proc(slot_index: int, data: []u8) -> (bool, string) {
	data_len := len(data)
	if data_len > PAYLOAD_CAPACITY {
		return false, "payload too large"
	}
	slot := &slots[slot_index]
	if slot.has_value && data_len <= slot.length {
		copy(payload_buffer[slot.offset:slot.offset+data_len], data)
		slot.length = data_len
		return true, ""
	}
	if payload_used + data_len > PAYLOAD_CAPACITY {
		return false, "payload storage exhausted"
	}
	offset := payload_used
	copy(payload_buffer[offset:offset+data_len], data)
	payload_used += data_len
	slot.offset = offset
	slot.length = data_len
	slot.has_value = true
	return true, ""
}

build_dump_bytes :: proc() -> ([]u8, string) {
	writer := BinaryWriter{}
	header_size := 8 + data_slot_count * 8
	if header_size > len(scratch_buffer) {
		return nil, "dump too large"
	}
	for i in 0..<header_size {
		scratch_buffer[i] = 0
	}
	writer.len = header_size
	for i in 0..<data_slot_count {
		if !slots[i].has_value {
			continue
		}
		if !writer_write(&writer, payload_buffer[slots[i].offset:slots[i].offset+slots[i].length]) {
			return nil, "dump too large"
		}
	}
	scratch_buffer[0] = RSPK_MAGIC_0
	scratch_buffer[1] = RSPK_MAGIC_1
	scratch_buffer[2] = RSPK_MAGIC_2
	scratch_buffer[3] = RSPK_MAGIC_3
	write_u16_at(4, RSPK_VERSION)
	write_u16_at(6, u16(data_slot_count))
	data_cursor := header_size
	for i in 0..<data_slot_count {
		entry := 8 + i * 8
		if slots[i].has_value {
			write_u32_at(entry, u32(data_cursor))
			write_u32_at(entry + 4, u32(slots[i].length))
			data_cursor += slots[i].length
		} else {
			write_u32_at(entry, 0)
			write_u32_at(entry + 4, 0)
		}
	}
	return scratch_buffer[:writer.len], ""
}

write_u16_at :: proc(offset: int, value: u16) {
	scratch_buffer[offset + 0] = u8(value & 0xff)
	scratch_buffer[offset + 1] = u8((value >> 8) & 0xff)
}

write_u32_at :: proc(offset: int, value: u32) {
	scratch_buffer[offset + 0] = u8(value & 0xff)
	scratch_buffer[offset + 1] = u8((value >> 8) & 0xff)
	scratch_buffer[offset + 2] = u8((value >> 16) & 0xff)
	scratch_buffer[offset + 3] = u8((value >> 24) & 0xff)
}
