package respack

MAX_CODEGEN_BYTES :: 1024 * 1024
TEMP_STRING_SLOTS :: 256
TEMP_STRING_CAPACITY :: 512

codegen_buffer: [MAX_CODEGEN_BYTES]u8
codegen_len: int
temp_string_slots: [TEMP_STRING_SLOTS][TEMP_STRING_CAPACITY]u8
temp_string_lens: [TEMP_STRING_SLOTS]int
temp_string_index: int

build_odin_decoder :: proc() -> (string, string) {
	codegen_len = 0
	temp_string_index = 0
	resolved_package := schema_odin_package()
	resolved_package = sanitize_identifier(resolved_package)
	if resolved_package == "" {
		resolved_package = "respack_generated"
	}
	emit("package ")
	emit(resolved_package)
	emit("\n\n")
	emit_import_declarations()
	emit("RSPK_VERSION :: u16(1)\n\n")
	emit_reader_runtime()
	emit_named_type_declarations()
	emit_slot_reader_struct()
	emit_named_decoders()
	emit_slot_readers()
	return string(codegen_buffer[:codegen_len]), ""
}

emit_import_declarations :: proc() {
	for i in 0 ..< schema_odin_import_count {
		alias := sanitize_identifier(schema_odin_import_alias(i))
		path := schema_odin_import_path(i)
		if alias == "" || alias == "generated" {
			emit("import \"")
			emit(path)
			emit("\"\n")
			continue
		}
		emit("import ")
		emit(alias)
		emit(" \"")
		emit(path)
		emit("\"\n")
	}
	if schema_odin_import_count > 0 {
		emit("\n")
	}
}

emit_reader_runtime :: proc() {
	emit("Reader :: struct {\n\tdata: []u8,\n\tpos: int,\n}\n\n")
	emit("Package :: struct {\n\tdata: []u8,\n")
	emit("\toffsets: [")
	emit_int(data_slot_count)
	emit("]u32,\n\tlengths: [")
	emit_int(data_slot_count)
	emit("]u32,\n}\n\n")
	emit("open_respack :: proc(data: []u8) -> (Package, bool) {\n")
	emit("\tif len(data) < 8 { return Package{}, false }\n")
	emit(
		"\tif data[0] != 'R' || data[1] != 'S' || data[2] != 'P' || data[3] != 'K' { return Package{}, false }\n",
	)
	emit("\tif read_u16(data, 4) != RSPK_VERSION { return Package{}, false }\n")
	emit("\tif int(read_u16(data, 6)) != ")
	emit_int(data_slot_count)
	emit(" { return Package{}, false }\n")
	emit("\tif len(data) < ")
	emit_int(8 + data_slot_count * 8)
	emit(" { return Package{}, false }\n")
	emit("\tpkg := Package{data = data}\n")
	emit("\tfor i in 0..<")
	emit_int(data_slot_count)
	emit(" {\n")
	emit("\t\tentry := 8 + i * 8\n")
	emit("\t\tpkg.offsets[i] = read_u32(data, entry)\n")
	emit("\t\tpkg.lengths[i] = read_u32(data, entry + 4)\n")
	emit("\t}\n\treturn pkg, true\n}\n\n")
	emit("slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {\n")
	emit("\tif slot < 0 || slot >= ")
	emit_int(data_slot_count)
	emit(" { return Reader{}, false }\n")
	emit("\toffset := int(pkg.offsets[slot])\n\tlength := int(pkg.lengths[slot])\n")
	emit("\tif length == 0 { return Reader{}, false }\n")
	emit("\tif offset < 0 || offset + length > len(pkg.data) { return Reader{}, false }\n")
	emit("\treturn Reader{data = pkg.data[offset:offset+length]}, true\n}\n\n")
	emit(
		"read_u8_reader :: proc(r: ^Reader) -> (u8, bool) {\n\tif r.pos + 1 > len(r.data) { return 0, false }\n\tv := r.data[r.pos]\n\tr.pos += 1\n\treturn v, true\n}\n\n",
	)
	emit(
		"read_u16_reader :: proc(r: ^Reader) -> (u16, bool) {\n\tif r.pos + 2 > len(r.data) { return 0, false }\n\tv := u16(r.data[r.pos]) | (u16(r.data[r.pos+1]) << 8)\n\tr.pos += 2\n\treturn v, true\n}\n\n",
	)
	emit(
		"read_u32_reader :: proc(r: ^Reader) -> (u32, bool) {\n\tif r.pos + 4 > len(r.data) { return 0, false }\n\tv := u32(r.data[r.pos]) | (u32(r.data[r.pos+1]) << 8) | (u32(r.data[r.pos+2]) << 16) | (u32(r.data[r.pos+3]) << 24)\n\tr.pos += 4\n\treturn v, true\n}\n\n",
	)
	emit(
		"read_u64_reader :: proc(r: ^Reader) -> (u64, bool) {\n\tif r.pos + 8 > len(r.data) { return 0, false }\n\tv := u64(0)\n\tfor i in 0..<8 { v |= u64(r.data[r.pos+i]) << (8 * u64(i)) }\n\tr.pos += 8\n\treturn v, true\n}\n\n",
	)
	emit(
		"read_u16 :: proc(data: []u8, offset: int) -> u16 { return u16(data[offset]) | (u16(data[offset+1]) << 8) }\n",
	)
	emit(
		"read_u32 :: proc(data: []u8, offset: int) -> u32 { return u32(data[offset]) | (u32(data[offset+1]) << 8) | (u32(data[offset+2]) << 16) | (u32(data[offset+3]) << 24) }\n\n",
	)
	emit(
		"read_string_reader :: proc(r: ^Reader) -> (string, bool) {\n\tcount, ok := read_u32_reader(r)\n\tif !ok { return \"\", false }\n\tstart := r.pos\n\tend := start + int(count)\n\tif end > len(r.data) { return \"\", false }\n\tr.pos = end\n\treturn string(r.data[start:end]), true\n}\n\n",
	)
}

emit_named_type_declarations :: proc() {
	for i in len(builtin_names) ..< type_count {
		if !types[i].has_name {
			continue
		}
		if is_external_odin_type(type_name_string(i)) {
			continue
		}
		emit_type_declaration(i)
	}
}

emit_type_declaration :: proc(type_idx: int) {
	name := type_name_string(type_idx)
	sanitized_name := sanitize_identifier(name)
	type_def := types[type_idx]
	#partial switch type_def.kind {
	case .Alias:
		emit(sanitized_name)
		emit(" :: ")
		emit(type_expr(type_def.target_type))
		emit("\n\n")
	case .Enum:
		emit(sanitized_name)
		emit(" :: enum u32 {\n")
		for i in 0 ..< type_def.enum_count {
			enum_idx := type_def.enum_start + i
			emit("\t")
			emit(sanitize_identifier(enum_name_string(enum_idx)))
			emit(" = ")
			emit_i64(enum_values[enum_idx].value)
			emit(",\n")
		}
		emit("}\n\n")
	case .Struct:
		emit(sanitized_name)
		emit(" :: struct {\n")
		for i in 0 ..< type_def.field_count {
			field_idx := type_def.field_start + i
			emit("\t")
			emit(sanitize_identifier(field_name_string(field_idx)))
			emit(": ")
			emit(type_expr(fields[field_idx].type_index))
			emit(",\n")
		}
		emit("}\n\n")
	case .Oneof:
		emit(sanitized_name)
		emit("_Kind :: enum u16 {\n\t\tNone = 0,\n")
		for i in 0 ..< type_def.option_count {
			option_type := oneof_options[type_def.option_start + i]
			emit("\t\t")
			emit(sanitize_identifier(type_name_string(option_type)))
			emit(" = ")
			emit_int(i + 1)
			emit(",\n")
		}
		emit("\t}\n")
		emit(sanitized_name)
		emit(" :: struct {\n\t\tkind: ")
		emit(sanitized_name)
		emit("_Kind,\n")
		for i in 0 ..< type_def.option_count {
			option_type := oneof_options[type_def.option_start + i]
			emit("\t\t")
			emit(sanitize_identifier(type_name_string(option_type)))
			emit(": ")
			emit(type_expr(option_type))
			emit(",\n")
		}
		emit("}\n\n")
	case .String, .Bytes, .Array, .Vector:
		emit(sanitized_name)
		emit(" :: ")
		emit(type_expr_expanded(type_idx))
		emit("\n\n")
	case:
	}
}

emit_slot_reader_struct :: proc() {
	emit("DecodedSlots :: struct {\n")
	for i in 0 ..< data_slot_count {
		emit("\thas_slot_")
		emit_int(i)
		emit(": bool,\n\tslot_")
		emit_int(i)
		emit(": ")
		emit(type_expr(data_slots[i]))
		emit(",\n")
	}
	emit("}\n\n")
}

emit_named_decoders :: proc() {
	for i in 0 ..< type_count {
		if !types[i].has_name {
			continue
		}
		if types[i].kind == .Invalid {
			continue
		}
		emit_decoder_proc(i)
	}
}

emit_decoder_proc :: proc(type_idx: int) {
	name := type_name_string(type_idx)
	sanitized_name := sanitize_identifier(name)
	type_def := types[type_idx]
	emit("decode_")
	emit(sanitized_name)
	emit(" :: proc(r: ^Reader, out: ^")
	emit(type_expr(type_idx))
	emit(") -> bool {\n")
	#partial switch type_def.kind {
	case .Struct:
		for i in 0 ..< type_def.field_count {
			field_idx := type_def.field_start + i
			emit_decode_assign(
				fields[field_idx].type_index,
				join2("out.", sanitize_identifier(field_name_string(field_idx))),
				field_name_string(field_idx),
			)
		}
	case .Oneof:
		emit("\ttag, ok := read_u16_reader(r)\n\tif !ok { return false }\n")
		emit("\tout.kind = ")
		emit(sanitized_name)
		emit("_Kind(tag)\n\t#partial switch out.kind {\n")
		for i in 0 ..< type_def.option_count {
			option_type := oneof_options[type_def.option_start + i]
			option_name := sanitize_identifier(type_name_string(option_type))
			emit("\tcase .")
			emit(option_name)
			emit(":\n")
			emit_decode_assign(option_type, join2("out.", option_name), option_name)
		}
		emit("\tcase .None:\n\t\treturn false\n\tcase:\n\t\treturn false\n\t}\n")
	case:
		emit_decode_assign(type_idx, "out^", name)
	}
	emit("\treturn true\n}\n\n")
}

emit_slot_readers :: proc() {
	for i in 0 ..< data_slot_count {
		emit("read_slot_")
		emit_int(i)
		emit("_")
		emit(sanitize_identifier(type_name_string(data_slots[i])))
		emit(" :: proc(pkg: Package) -> (")
		emit(type_expr(data_slots[i]))
		emit(", bool) {\n")
		emit("\tr, ok := slot_reader(pkg, ")
		emit_int(i)
		emit(")\n\tif !ok { return ")
		emit(zero_value_expr(data_slots[i]))
		emit(", false }\n\tvalue: ")
		emit(type_expr(data_slots[i]))
		emit("\n\tif !decode_")
		emit(sanitize_identifier(type_name_string(data_slots[i])))
		emit("(&r, &value) { return ")
		emit(zero_value_expr(data_slots[i]))
		emit(", false }\n\treturn value, true\n}\n\n")
	}
}

emit_decode_assign :: proc(type_idx: int, target: string, _label: string) {
	type_def := types[type_idx]
	emit("\t{\n")
	#partial switch type_def.kind {
	case .Alias:
		emit_alias_decode_assign(type_idx, target)
	case .Bool:
		emit("\tb, ok := read_u8_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = b != 0\n")
	case .U8:
		emit("\tv, ok := read_u8_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = v\n")
	case .U16:
		emit("\tv, ok := read_u16_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = v\n")
	case .U32, .Enum:
		emit("\tv, ok := read_u32_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		if type_def.kind == .Enum {
			emit(" = ")
			emit(type_expr(type_idx))
			emit("(v)\n")
		} else {
			emit(" = v\n")
		}
	case .U64:
		emit("\tv, ok := read_u64_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = v\n")
	case .I8:
		emit("\tv, ok := read_u8_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = transmute(i8)v\n")
	case .I16:
		emit("\tv, ok := read_u16_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = transmute(i16)v\n")
	case .I32:
		emit("\tv, ok := read_u32_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = transmute(i32)v\n")
	case .I64:
		emit("\tv, ok := read_u64_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = transmute(i64)v\n")
	case .F32:
		emit("\tv, ok := read_u32_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = transmute(f32)v\n")
	case .F64:
		emit("\tv, ok := read_u64_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = transmute(f64)v\n")
	case .String:
		emit("\ts, ok := read_string_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = s\n")
	case .Bytes:
		emit(
			"\tcount, ok := read_u32_reader(r)\n\tif !ok { return false }\n\tstart := r.pos\n\tend := start + int(count)\n\tif end > len(r.data) { return false }\n\tr.pos = end\n\t",
		)
		emit(target)
		emit(" = r.data[start:end]\n")
	case .Struct, .Oneof:
		emit("\tif !decode_")
		emit(sanitize_identifier(type_name_string(type_idx)))
		emit("(r, &")
		emit(target)
		emit(") { return false }\n")
	case .Array:
		emit("\tfor j in 0..<")
		emit_int(type_def.fixed_len)
		emit(" {\n")
		emit_decode_assign(type_def.target_type, join2(target, "[j]"), "")
		emit("\t}\n")
	case .Vector:
		emit("\tcount, ok := read_u32_reader(r)\n\tif !ok { return false }\n\t")
		emit(target)
		emit(" = make(")
		emit(type_expr(type_idx))
		emit(", int(count))\n\tfor i in 0..<int(count) {\n")
		emit_decode_assign(type_def.target_type, join2(target, "[i]"), "")
		emit("\t}\n")
	case:
		emit("\treturn false\n")
	}
	emit("\t}\n")
}

emit_alias_decode_assign :: proc(type_idx: int, target: string) {
	target_type := types[type_idx].target_type
	base := type_expr(type_idx)
	#partial switch types[target_type].kind {
	case .Struct, .Oneof:
		emit("\tvalue: ")
		emit(type_expr(target_type))
		emit("\n\tif !decode_")
		emit(sanitize_identifier(type_name_string(target_type)))
		emit("(r, &value) { return false }\n\t")
		emit(target)
		emit(" = ")
		emit(base)
		emit("(value)\n")
	case:
		emit("\tvalue: ")
		emit(type_expr(target_type))
		emit("\n")
		emit_decode_assign(target_type, "value", "")
		emit("\t")
		emit(target)
		emit(" = ")
		emit(base)
		emit("(value)\n")
	}
}

type_expr :: proc(type_idx: int) -> string {
	type_def := types[type_idx]
	if type_idx < len(builtin_names) &&
	   builtin_names[type_idx] != "" &&
	   types[type_idx].name_start == -1 {
		return builtin_type_expr(type_def.kind)
	}
	if type_def.has_name {
		if is_external_odin_type(type_name_string(type_idx)) {
			return type_name_string(type_idx)
		}
		return sanitize_identifier(type_name_string(type_idx))
	}
	return type_expr_expanded(type_idx)
}

type_expr_expanded :: proc(type_idx: int) -> string {
	type_def := types[type_idx]
	if type_idx < len(builtin_names) &&
	   builtin_names[type_idx] != "" &&
	   types[type_idx].name_start == -1 {
		return builtin_type_expr(type_def.kind)
	}
	#partial switch type_def.kind {
	case .Array:
		return join3(
			"[",
			int_string(type_def.fixed_len),
			join2("]", type_expr(type_def.target_type)),
		)
	case .Vector:
		return join2("[]", type_expr(type_def.target_type))
	case .String:
		return "string"
	case .Bytes:
		return "[]u8"
	case:
		if is_external_odin_type(type_name_string(type_idx)) {
			return type_name_string(type_idx)
		}
		return sanitize_identifier(type_name_string(type_idx))
	}
}

builtin_type_expr :: proc(kind: TypeKind) -> string {
	#partial switch kind {
	case .Bool:
		return "bool"
	case .U8:
		return "u8"
	case .U16:
		return "u16"
	case .U32:
		return "u32"
	case .U64:
		return "u64"
	case .I8:
		return "i8"
	case .I16:
		return "i16"
	case .I32:
		return "i32"
	case .I64:
		return "i64"
	case .F32:
		return "f32"
	case .F64:
		return "f64"
	case .String:
		return "string"
	case .Bytes:
		return "[]u8"
	case:
		return "invalid_type"
	}
}

zero_value_expr :: proc(type_idx: int) -> string {
	type_def := types[type_idx]
	#partial switch type_def.kind {
	case .String:
		return "\"\""
	case .Vector, .Bytes:
		return "nil"
	case .Bool:
		return "false"
	case:
		return join2(type_expr(type_idx), "{}")
	}
}

sanitize_identifier :: proc(text: string) -> string {
	if len(text) == 0 {
		return "generated"
	}
	slot := next_temp_string_slot()
	count := 0
	last_underscore := false
	for i in 0 ..< len(text) {
		c := text[i]
		if c >= 'A' && c <= 'Z' {
			if i > 0 &&
			   !last_underscore &&
			   ((text[i - 1] >= 'a' && text[i - 1] <= 'z') ||
					   (i + 1 < len(text) && text[i + 1] >= 'a' && text[i + 1] <= 'z')) {
				if count < TEMP_STRING_CAPACITY {
					temp_string_slots[slot][count] = '_'
					count += 1
				}
			}
			if count < TEMP_STRING_CAPACITY {
				temp_string_slots[slot][count] = c + 32
				count += 1
			}
			last_underscore = false
			continue
		}
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') {
			if count < TEMP_STRING_CAPACITY {
				temp_string_slots[slot][count] = c
				count += 1
			}
			last_underscore = false
			continue
		}
		if !last_underscore {
			if count < TEMP_STRING_CAPACITY {
				temp_string_slots[slot][count] = '_'
				count += 1
			}
			last_underscore = true
		}
	}
	temp_string_lens[slot] = count
	result := string(temp_string_slots[slot][:count])
	if len(result) == 0 {
		return "generated"
	}
	if result[0] >= '0' && result[0] <= '9' {
		return join2("_", result)
	}
	return result
}

is_external_odin_type :: proc(text: string) -> bool {
	for i in 0 ..< len(text) {
		if text[i] == '.' {
			return true
		}
	}
	return false
}

emit :: proc(text: string) {
	if codegen_len + len(text) > len(codegen_buffer) {
		return
	}
	copy(codegen_buffer[codegen_len:codegen_len + len(text)], text)
	codegen_len += len(text)
}

emit_int :: proc(value: int) {
	emit(int_string(value))
}

emit_i64 :: proc(value: i64) {
	emit(i64_string(value))
}

int_string :: proc(value: int) -> string {
	return i64_string(i64(value))
}

i64_string :: proc(value: i64) -> string {
	slot := next_temp_string_slot()
	idx := TEMP_STRING_CAPACITY
	neg := value < 0
	if value == 0 {
		return "0"
	}
	v := value
	if neg {
		v = -v
	}
	for v > 0 {
		idx -= 1
		temp_string_slots[slot][idx] = u8('0') + u8(v % 10)
		v /= 10
	}
	if neg {
		idx -= 1
		temp_string_slots[slot][idx] = '-'
	}
	temp_string_lens[slot] = TEMP_STRING_CAPACITY - idx
	return string(temp_string_slots[slot][idx:TEMP_STRING_CAPACITY])
}

next_temp_string_slot :: proc() -> int {
	idx := temp_string_index % TEMP_STRING_SLOTS
	temp_string_index += 1
	temp_string_lens[idx] = 0
	return idx
}

join2 :: proc(a, b: string) -> string {
	slot := next_temp_string_slot()
	count := 0
	for i in 0 ..< len(a) {
		if count >= TEMP_STRING_CAPACITY {break}
		temp_string_slots[slot][count] = a[i]
		count += 1
	}
	for i in 0 ..< len(b) {
		if count >= TEMP_STRING_CAPACITY {break}
		temp_string_slots[slot][count] = b[i]
		count += 1
	}
	temp_string_lens[slot] = count
	return string(temp_string_slots[slot][:count])
}

join3 :: proc(a, b, c: string) -> string {
	return join2(join2(a, b), c)
}
