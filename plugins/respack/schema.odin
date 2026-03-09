package respack

import jsmn "jsmn"

MAX_TYPES :: 256
MAX_FIELDS :: 1024
MAX_ENUM_VALUES :: 1024
MAX_ONEOF_OPTIONS :: 1024

TypeKind :: enum int {
	Invalid,
	Bool,
	U8,
	U16,
	U32,
	U64,
	I8,
	I16,
	I32,
	I64,
	F32,
	F64,
	String,
	Bytes,
	Alias,
	Enum,
	Struct,
	Array,
	Vector,
	Oneof,
}

TypeDef :: struct {
	kind: TypeKind,
	has_name: bool,
	name_start: int,
	name_end: int,
	target_type: int,
	fixed_len: int,
	field_start: int,
	field_count: int,
	enum_start: int,
	enum_count: int,
	option_start: int,
	option_count: int,
	max_len: int,
}

FieldDef :: struct {
	name_start: int,
	name_end: int,
	type_index: int,
	has_default: bool,
	default_token: int,
	has_min: bool,
	has_max: bool,
	min_value: f64,
	max_value: f64,
	max_len: int,
}

EnumValue :: struct {
	name_start: int,
	name_end: int,
	value: i64,
}

schema_tokens: [SCHEMA_TOKEN_MAX]jsmn.Token
schema_token_count: int
types: [MAX_TYPES]TypeDef
type_count: int
fields: [MAX_FIELDS]FieldDef
field_count: int
enum_values: [MAX_ENUM_VALUES]EnumValue
enum_value_count: int
oneof_options: [MAX_ONEOF_OPTIONS]int
oneof_option_count: int
data_slots: [MAX_SLOTS]int
data_slot_count: int
schema_package_start: int
schema_package_end: int

reset_schema_state :: proc() {
	schema_token_count = 0
	type_count = 0
	field_count = 0
	enum_value_count = 0
	oneof_option_count = 0
	data_slot_count = 0
	schema_package_start = 0
	schema_package_end = 0
	add_builtin_types()
}

compile_schema :: proc(input: []u8) -> (bool, string) {
	reset_schema_state()
	parser: jsmn.Parser
	jsmn.init(&parser)
	schema_token_count = jsmn.parse(&parser, input, schema_tokens[:])
	if schema_token_count < 0 {
		return false, json_error_string(schema_token_count)
	}
	if schema_token_count == 0 || schema_tokens[0].type != jsmn.JsmnType.Object {
		return false, "schema root must be object"
	}
	package_start, package_end, _ := find_top_level_value_bounds(input, "package")
	if package_start >= 0 && package_end > package_start {
		schema_package_start = package_start + 1
		schema_package_end = package_end - 1
	}
	types_start, types_end, has_types := find_top_level_value_bounds(input, "types")
	if !has_types {
		return false, "schema missing types object"
	}
	types_idx := find_token_by_start(schema_tokens[:schema_token_count], types_start, jsmn.JsmnType.Object)
	if types_idx < 0 || schema_tokens[types_idx].type != jsmn.JsmnType.Object {
		return false, "schema types must be object"
	}
	data_start, data_end, has_data := find_top_level_value_bounds(input, "data")
	if !has_data {
		return false, "schema missing data array"
	}
	if input[data_start] != '[' {
		return false, "schema data is not array"
	}

	for i in 0..<(schema_token_count - 1) {
		key := schema_tokens[i]
		if key.parent != types_idx || key.type != jsmn.JsmnType.String {
			continue
		}
		_, err := declare_named_type(key)
		if err != "" {
			return false, err
		}
	}

	for i in 0..<(schema_token_count - 1) {
		key := schema_tokens[i]
		if key.parent != types_idx || key.type != jsmn.JsmnType.String {
			continue
		}
		value_idx := i + 1
		type_idx, found := lookup_named_type(input, key)
		if !found {
			return false, "type declaration lookup failed"
		}
		err := compile_named_type(input, value_idx, type_idx)
		if err != "" {
			return false, err
		}
	}

	data_parser: jsmn.Parser
	jsmn.init(&data_parser)
	data_tokens_array: [MAX_SLOTS + 1]jsmn.Token
	data_tokens := data_tokens_array[:]
	data_slice := input[data_start:data_end]
	data_count := jsmn.parse(&data_parser, data_slice, data_tokens)
	if data_count < 0 {
		return false, json_error_string(data_count)
	}
	if data_count == 0 || data_tokens[0].type != jsmn.JsmnType.Array {
		return false, "schema data is not array"
	}
	slot_idx := 0
	for i in 0..<data_count {
		if data_tokens[i].parent != 0 {
			continue
		}
		if slot_idx >= MAX_SLOTS {
			return false, "schema data array exceeds slot limit"
		}
		if data_tokens[i].type != jsmn.JsmnType.String {
			return false, "schema data entries must be strings"
		}
		type_idx, resolve_ok := resolve_named_type_bytes(data_slice, data_tokens[i])
		if resolve_ok != "" {
			return false, resolve_ok
		}
		data_slots[slot_idx] = type_idx
		slot_idx += 1
	}
	data_slot_count = slot_idx
	return true, ""
}

find_token_by_bounds :: proc(tokens: []jsmn.Token, start, end: int, kind: jsmn.JsmnType) -> int {
	for i in 0..<len(tokens) {
		if tokens[i].start == start && tokens[i].end == end && tokens[i].type == kind {
			return i
		}
	}
	return -1
}

find_token_by_start :: proc(tokens: []jsmn.Token, start: int, kind: jsmn.JsmnType) -> int {
	for i in 0..<len(tokens) {
		if tokens[i].start == start && tokens[i].type == kind {
			return i
		}
	}
	return -1
}

resolve_named_type_bytes :: proc(input: []u8, tok: jsmn.Token) -> (int, string) {
	for i in 0..<type_count {
		if !types[i].has_name {
			continue
		}
		if type_name_matches(i, input, tok) {
			return i, ""
		}
	}
	return -1, "unknown type reference"
}

find_top_level_value_bounds :: proc(input: []u8, key: string) -> (int, int, bool) {
	depth := 0
	in_string := false
	escaped := false
	i := 0
	for i < len(input) {
		c := input[i]
		if in_string {
			if escaped {
				escaped = false
			} else if c == '\\' {
				escaped = true
			} else if c == '"' {
				in_string = false
			}
			i += 1
			continue
		}
		switch c {
		case '"':
			if depth == 1 && match_key_at(input, i, key) {
				j := i + len(key) + 2
				for j < len(input) && is_space(input[j]) {
					j += 1
				}
				if j >= len(input) || input[j] != ':' {
					i += 1
					continue
				}
				j += 1
				for j < len(input) && is_space(input[j]) {
					j += 1
				}
				end, ok := scan_json_value_end(input, j)
				if !ok {
					return -1, -1, false
				}
				return j, end, true
			}
			in_string = true
		case '{', '[':
			depth += 1
		case '}', ']':
			depth -= 1
		case:
		}
		i += 1
	}
	return -1, -1, false
}

match_key_at :: proc(input: []u8, quote_idx: int, key: string) -> bool {
	if quote_idx + len(key) + 1 >= len(input) {
		return false
	}
	if input[quote_idx] != '"' {
		return false
	}
	for i in 0..<len(key) {
		if input[quote_idx + 1 + i] != key[i] {
			return false
		}
	}
	return input[quote_idx + len(key) + 1] == '"'
}

scan_json_value_end :: proc(input: []u8, start: int) -> (int, bool) {
	if start >= len(input) {
		return -1, false
	}
	if input[start] == '{' || input[start] == '[' {
		depth := 0
		in_string := false
		escaped := false
		for i in start..<len(input) {
			c := input[i]
			if in_string {
				if escaped {
					escaped = false
				} else if c == '\\' {
					escaped = true
				} else if c == '"' {
					in_string = false
				}
				continue
			}
			switch c {
			case '"':
				in_string = true
			case '{', '[':
				depth += 1
			case '}', ']':
				depth -= 1
				if depth == 0 {
					return i + 1, true
				}
			case:
			}
		}
		return -1, false
	}
	if input[start] == '"' {
		escaped := false
		for i in start + 1..<len(input) {
			if escaped {
				escaped = false
				continue
			}
			if input[i] == '\\' {
				escaped = true
				continue
			}
			if input[i] == '"' {
				return i + 1, true
			}
		}
		return -1, false
	}
	for i in start..<len(input) {
		if input[i] == ',' || input[i] == '}' || input[i] == ']' {
			return i, true
		}
	}
	return len(input), true
}

is_space :: proc(c: u8) -> bool {
	return c == ' ' || c == '\n' || c == '\r' || c == '\t'
}

add_builtin_types :: proc() {
	add_builtin_type(.Bool, "bool")
	add_builtin_type(.U8, "u8")
	add_builtin_type(.U16, "u16")
	add_builtin_type(.U32, "u32")
	add_builtin_type(.U64, "u64")
	add_builtin_type(.I8, "i8")
	add_builtin_type(.I16, "i16")
	add_builtin_type(.I32, "i32")
	add_builtin_type(.I64, "i64")
	add_builtin_type(.F32, "f32")
	add_builtin_type(.F64, "f64")
	add_builtin_type(.String, "string")
	add_builtin_type(.Bytes, "bytes")
}

add_builtin_type :: proc(kind: TypeKind, name: string) {
	idx := type_count
	types[idx].kind = kind
	types[idx].has_name = true
	types[idx].name_start = -1
	types[idx].name_end = -1
	type_count += 1
	store_builtin_name(idx, name)
}

builtin_names: [13]string

store_builtin_name :: proc(idx: int, name: string) {
	builtin_names[idx] = name
}

declare_named_type :: proc(tok: jsmn.Token) -> (int, string) {
	if type_count >= MAX_TYPES {
		return -1, "type limit exceeded"
	}
	if _, found := lookup_named_type(schema_buffer[:schema_len], tok); found {
		return -1, "duplicate type name"
	}
	idx := type_count
	types[idx] = TypeDef{
		kind = .Invalid,
		has_name = true,
		name_start = tok.start,
		name_end = tok.end,
		max_len = -1,
		target_type = -1,
		fixed_len = -1,
	}
	type_count += 1
	return idx, ""
}

new_anonymous_type :: proc() -> (int, string) {
	if type_count >= MAX_TYPES {
		return -1, "type limit exceeded"
	}
	idx := type_count
	types[idx] = TypeDef{target_type = -1, fixed_len = -1, max_len = -1}
	type_count += 1
	return idx, ""
}

lookup_named_type :: proc(input: []u8, tok: jsmn.Token) -> (int, bool) {
	for i in 0..<type_count {
		if !types[i].has_name {
			continue
		}
		if type_name_matches(i, input, tok) {
			return i, true
		}
	}
	return -1, false
}

type_name_matches :: proc(type_idx: int, input: []u8, tok: jsmn.Token) -> bool {
	if type_idx < len(builtin_names) && builtin_names[type_idx] != "" && types[type_idx].name_start == -1 {
		name := builtin_names[type_idx]
		return token_matches(input, tok, name)
	}
	name_tok := types[type_idx]
	span := tok.end - tok.start
	if !name_tok.has_name || span != name_tok.name_end - name_tok.name_start {
		return false
	}
	for i in 0..<span {
		if input[tok.start + i] != schema_buffer[name_tok.name_start + i] {
			return false
		}
	}
	return true
}

compile_named_type :: proc(input: []u8, token_idx: int, type_idx: int) -> string {
	tok := schema_tokens[token_idx]
	if tok.type == jsmn.JsmnType.String {
		target_idx, err := resolve_type_from_token(input, token_idx)
		if err != "" {
			return err
		}
		types[type_idx].kind = .Alias
		types[type_idx].target_type = target_idx
		return ""
	}
	if tok.type != jsmn.JsmnType.Object {
		return "type definition must be string or object"
	}
	type_field := find_object_value(input, schema_tokens[:schema_token_count], token_idx, "type")
	if type_field < 0 {
		return "type definition missing type field"
	}
	type_name := schema_tokens[type_field]
	if type_name.type != jsmn.JsmnType.String {
		return "type field must be string"
	}
	if token_matches(input, type_name, "enum") {
		return compile_enum_type(input, token_idx, type_idx)
	}
	if token_matches(input, type_name, "struct") {
		return compile_struct_type(input, token_idx, type_idx)
	}
	if token_matches(input, type_name, "array") {
		return compile_array_type(input, token_idx, type_idx)
	}
	if token_matches(input, type_name, "vector") {
		return compile_vector_type(input, token_idx, type_idx)
	}
	if token_matches(input, type_name, "oneof") {
		return compile_oneof_type(input, token_idx, type_idx)
	}
	if token_matches(input, type_name, "string") {
		types[type_idx].kind = .String
		types[type_idx].max_len = read_optional_int(input, token_idx, "max_len")
		return ""
	}
	if token_matches(input, type_name, "bytes") {
		types[type_idx].kind = .Bytes
		types[type_idx].max_len = read_optional_int(input, token_idx, "max_len")
		return ""
	}
	target_idx, err := resolve_type_from_token(input, type_field)
	if err != "" {
		return err
	}
	types[type_idx].kind = .Alias
	types[type_idx].target_type = target_idx
	return ""
}

compile_enum_type :: proc(input: []u8, obj_idx: int, type_idx: int) -> string {
	value_idx := find_object_value(input, schema_tokens[:schema_token_count], obj_idx, "value")
	if value_idx < 0 {
		return "enum missing value"
	}
	start := enum_value_count
	tok := schema_tokens[value_idx]
	if tok.type == jsmn.JsmnType.Array {
		ordinal: i64 = 0
		for i in 0..<schema_token_count {
			if schema_tokens[i].parent != value_idx {
				continue
			}
			if schema_tokens[i].type != jsmn.JsmnType.String {
				return "enum array values must be strings"
			}
			if enum_value_count >= MAX_ENUM_VALUES {
				return "enum value limit exceeded"
			}
			enum_values[enum_value_count] = EnumValue{name_start = schema_tokens[i].start, name_end = schema_tokens[i].end, value = ordinal}
			enum_value_count += 1
			ordinal += 1
		}
	} else if tok.type == jsmn.JsmnType.Object {
		for i in 0..<(schema_token_count - 1) {
			if schema_tokens[i].parent != value_idx || schema_tokens[i].type != jsmn.JsmnType.String {
				continue
			}
			if schema_tokens[i + 1].parent != value_idx {
				continue
			}
			if enum_value_count >= MAX_ENUM_VALUES {
				return "enum value limit exceeded"
			}
			v, ok := parse_i64_bytes(input[schema_tokens[i + 1].start:schema_tokens[i + 1].end])
			if !ok {
				return "enum object values must be integers"
			}
			enum_values[enum_value_count] = EnumValue{name_start = schema_tokens[i].start, name_end = schema_tokens[i].end, value = v}
			enum_value_count += 1
		}
	} else {
		return "enum value must be array or object"
	}
	types[type_idx].kind = .Enum
	types[type_idx].enum_start = start
	types[type_idx].enum_count = enum_value_count - start
	return ""
}

compile_struct_type :: proc(input: []u8, obj_idx: int, type_idx: int) -> string {
	fields_idx := find_object_value(input, schema_tokens[:schema_token_count], obj_idx, "fields")
	if fields_idx < 0 {
		return "struct missing fields object"
	}
	if schema_tokens[fields_idx].type != jsmn.JsmnType.Object {
		return "struct fields must be object"
	}
	start := field_count
	for i in 0..<(schema_token_count - 1) {
		key := schema_tokens[i]
		if key.parent != fields_idx || key.type != jsmn.JsmnType.String {
			continue
		}
		if field_count >= MAX_FIELDS {
			return "field limit exceeded"
		}
		field, err := compile_field(input, key, i + 1)
		if err != "" {
			return err
		}
		fields[field_count] = field
		field_count += 1
	}
	types[type_idx].kind = .Struct
	types[type_idx].field_start = start
	types[type_idx].field_count = field_count - start
	return ""
}

compile_array_type :: proc(input: []u8, obj_idx: int, type_idx: int) -> string {
	len_idx := find_object_value(input, schema_tokens[:schema_token_count], obj_idx, "len")
	value_idx := find_object_value(input, schema_tokens[:schema_token_count], obj_idx, "value")
	if len_idx < 0 || value_idx < 0 {
		return "array requires len and value"
	}
	length, ok := parse_i64_bytes(input[schema_tokens[len_idx].start:schema_tokens[len_idx].end])
	if !ok || length < 0 {
		return "array len must be non-negative integer"
	}
	value_type, err := resolve_type_from_token(input, value_idx)
	if err != "" {
		return err
	}
	types[type_idx].kind = .Array
	types[type_idx].target_type = value_type
	types[type_idx].fixed_len = int(length)
	return ""
}

compile_vector_type :: proc(input: []u8, obj_idx: int, type_idx: int) -> string {
	value_idx := find_object_value(input, schema_tokens[:schema_token_count], obj_idx, "value")
	if value_idx < 0 {
		return "vector requires value"
	}
	value_type, err := resolve_type_from_token(input, value_idx)
	if err != "" {
		return err
	}
	types[type_idx].kind = .Vector
	types[type_idx].target_type = value_type
	return ""
}

compile_oneof_type :: proc(input: []u8, obj_idx: int, type_idx: int) -> string {
	value_idx := find_object_value(input, schema_tokens[:schema_token_count], obj_idx, "value")
	if value_idx < 0 {
		return "oneof requires value"
	}
	if schema_tokens[value_idx].type != jsmn.JsmnType.Array {
		return "oneof value must be array"
	}
	start := oneof_option_count
	for i in 0..<schema_token_count {
		if schema_tokens[i].parent != value_idx {
			continue
		}
		if oneof_option_count >= MAX_ONEOF_OPTIONS {
			return "oneof option limit exceeded"
		}
		option_type, err := resolve_type_from_token(input, i)
		if err != "" {
			return err
		}
		oneof_options[oneof_option_count] = option_type
		oneof_option_count += 1
	}
	types[type_idx].kind = .Oneof
	types[type_idx].option_start = start
	types[type_idx].option_count = oneof_option_count - start
	return ""
}

compile_field :: proc(input: []u8, name_tok: jsmn.Token, value_idx: int) -> (FieldDef, string) {
	field := FieldDef{name_start = name_tok.start, name_end = name_tok.end, default_token = -1, max_len = -1}
	tok := schema_tokens[value_idx]
	if tok.type == jsmn.JsmnType.String {
		type_idx, err := resolve_type_from_token(input, value_idx)
		if err != "" {
			return FieldDef{}, err
		}
		field.type_index = type_idx
		return field, ""
	}
	if tok.type != jsmn.JsmnType.Object {
		return FieldDef{}, "field definition must be string or object"
	}
	type_field := find_object_value(input, schema_tokens[:schema_token_count], value_idx, "type")
	if type_field < 0 {
		return FieldDef{}, "field definition missing type"
	}
	type_idx, err := resolve_field_type(input, value_idx, type_field)
	if err != "" {
		return FieldDef{}, err
	}
	field.type_index = type_idx
	default_idx := find_object_value(input, schema_tokens[:schema_token_count], value_idx, "default")
	if default_idx >= 0 {
		field.has_default = true
		field.default_token = default_idx
	}
	if min_idx := find_object_value(input, schema_tokens[:schema_token_count], value_idx, "min"); min_idx >= 0 {
		v, ok := parse_f64_bytes(input[schema_tokens[min_idx].start:schema_tokens[min_idx].end])
		if !ok {
			return FieldDef{}, "field min must be numeric"
		}
		field.has_min = true
		field.min_value = v
	}
	if max_idx := find_object_value(input, schema_tokens[:schema_token_count], value_idx, "max"); max_idx >= 0 {
		v, ok := parse_f64_bytes(input[schema_tokens[max_idx].start:schema_tokens[max_idx].end])
		if !ok {
			return FieldDef{}, "field max must be numeric"
		}
		field.has_max = true
		field.max_value = v
	}
	field.max_len = read_optional_int(input, value_idx, "max_len")
	return field, ""
}

resolve_field_type :: proc(input: []u8, obj_idx: int, type_field_idx: int) -> (int, string) {
	type_tok := schema_tokens[type_field_idx]
	if token_matches(input, type_tok, "enum") || token_matches(input, type_tok, "struct") || token_matches(input, type_tok, "array") || token_matches(input, type_tok, "vector") || token_matches(input, type_tok, "oneof") || token_matches(input, type_tok, "string") || token_matches(input, type_tok, "bytes") {
		idx, err := new_anonymous_type()
		if err != "" {
			return -1, err
		}
		err = compile_named_type(input, obj_idx, idx)
		if err != "" {
			return -1, err
		}
		return idx, ""
	}
	return resolve_type_from_token(input, type_field_idx)
}

resolve_type_from_token :: proc(input: []u8, token_idx: int) -> (int, string) {
	tok := schema_tokens[token_idx]
	if tok.type != jsmn.JsmnType.String {
		return -1, "type reference must be string"
	}
	if type_idx, found := lookup_named_type(input, tok); found {
		return type_idx, ""
	}
	return -1, "unknown type reference"
}

read_optional_int :: proc(input: []u8, obj_idx: int, key: string) -> int {
	value_idx := find_object_value(input, schema_tokens[:schema_token_count], obj_idx, key)
	if value_idx < 0 {
		return -1
	}
	v, ok := parse_i64_bytes(input[schema_tokens[value_idx].start:schema_tokens[value_idx].end])
	if !ok {
		return -1
	}
	return int(v)
}

find_object_value :: proc(input: []u8, tokens: []jsmn.Token, object_idx: int, key: string) -> int {
	for i in 0..<(len(tokens) - 1) {
		tok := tokens[i]
		if tok.parent != object_idx || tok.type != jsmn.JsmnType.String {
			continue
		}
		if token_matches(input, tok, key) {
			return i + 1
		}
	}
	return -1
}

find_any_key_value :: proc(input: []u8, tokens: []jsmn.Token, key: string) -> int {
	for i in 0..<(len(tokens) - 1) {
		if tokens[i].type != jsmn.JsmnType.String {
			continue
		}
		if token_matches(input, tokens[i], key) {
			return i + 1
		}
	}
	return -1
}

count_array_children :: proc(tokens: []jsmn.Token, array_idx: int) -> int {
	count := 0
	for i in 0..<len(tokens) {
		if tokens[i].parent == array_idx {
			count += 1
		}
	}
	return count
}

type_name_string :: proc(type_idx: int) -> string {
	if type_idx < len(builtin_names) && builtin_names[type_idx] != "" && types[type_idx].name_start == -1 {
		return builtin_names[type_idx]
	}
	return string(schema_buffer[types[type_idx].name_start:types[type_idx].name_end])
}

field_name_string :: proc(field_idx: int) -> string {
	field := fields[field_idx]
	return string(schema_buffer[field.name_start:field.name_end])
}

enum_name_string :: proc(enum_idx: int) -> string {
	value := enum_values[enum_idx]
	return string(schema_buffer[value.name_start:value.name_end])
}

parse_i64_bytes :: proc(data: []u8) -> (i64, bool) {
	if len(data) == 0 {
		return 0, false
	}
	neg := false
	idx := 0
	if data[0] == '-' {
		neg = true
		idx = 1
	}
	if idx >= len(data) {
		return 0, false
	}
	value: i64 = 0
	for idx < len(data) {
		c := data[idx]
		if c < '0' || c > '9' {
			return 0, false
		}
		value = value * 10 + i64(c - '0')
		idx += 1
	}
	if neg {
		value = -value
	}
	return value, true
}

parse_f64_bytes :: proc(data: []u8) -> (f64, bool) {
	if len(data) == 0 {
		return 0, false
	}
	neg := false
	idx := 0
	if data[0] == '-' {
		neg = true
		idx = 1
	}
	if idx >= len(data) {
		return 0, false
	}
	whole: f64 = 0
	has_digit := false
	for idx < len(data) && data[idx] >= '0' && data[idx] <= '9' {
		whole = whole * 10 + f64(data[idx] - '0')
		idx += 1
		has_digit = true
	}
	frac: f64 = 0
	divisor: f64 = 1
	if idx < len(data) && data[idx] == '.' {
		idx += 1
		for idx < len(data) && data[idx] >= '0' && data[idx] <= '9' {
			frac = frac * 10 + f64(data[idx] - '0')
			divisor *= 10
			idx += 1
			has_digit = true
		}
	}
	if !has_digit || idx != len(data) {
		return 0, false
	}
	value := whole + frac / divisor
	if neg {
		value = -value
	}
	return value, true
}

effective_type_max_len :: proc(type_idx: int, field: FieldDef) -> int {
	max_len := types[type_idx].max_len
	if field.max_len >= 0 && (max_len < 0 || field.max_len < max_len) {
		max_len = field.max_len
	}
	return max_len
}
