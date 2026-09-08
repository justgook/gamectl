package content

import director "../director"
import station "../station"

@(private = "file")
RSPK_VERSION :: u16(1)

@(private = "file")
Reader :: struct {
	data: []u8,
	pos:  int,
}

Package :: struct {
	data:    []u8,
	offsets: [2]u32,
	lengths: [2]u32,
}

open_respack :: proc(data: []u8) -> (Package, bool) {
	if len(data) < 8 {return Package{}, false}
	if data[0] != 'R' || data[1] != 'S' || data[2] != 'P' || data[3] != 'K' {return Package{}, false}
	if read_u16(data, 4) != RSPK_VERSION {return Package{}, false}
	if int(read_u16(data, 6)) != 2 {return Package{}, false}
	if len(data) < 24 {return Package{}, false}
	pkg := Package {
		data = data,
	}
	for i in 0 ..< 2 {
		entry := 8 + i * 8
		pkg.offsets[i] = read_u32(data, entry)
		pkg.lengths[i] = read_u32(data, entry + 4)
	}
	return pkg, true
}

@(private = "file")
slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 2 {return Reader{}, false}
	offset := u64(pkg.offsets[slot])
	length := u64(pkg.lengths[slot])
	data_length := u64(len(pkg.data))
	if length == 0 || offset > data_length || length > data_length - offset {return Reader{}, false}
	start := int(offset)
	end := start + int(length)
	return Reader{data = pkg.data[start:end]}, true
}

@(private = "file")
can_read :: proc(r: ^Reader, size: u64) -> bool {
	return r.pos >= 0 && u64(r.pos) <= u64(len(r.data)) && size <= u64(len(r.data) - r.pos)
}

@(private = "file")
count_fits :: proc(r: ^Reader, count: u32, element_size: u64) -> bool {
	return can_read(r, 0) && element_size > 0 && u64(count) <= u64(len(r.data) - r.pos) / element_size
}

@(private = "file")
read_u8_reader :: proc(r: ^Reader) -> (u8, bool) {
	if !can_read(r, 1) {return 0, false}
	v := r.data[r.pos]
	r.pos += 1
	return v, true
}

@(private = "file")
read_u16_reader :: proc(r: ^Reader) -> (u16, bool) {
	if !can_read(r, 2) {return 0, false}
	v := u16(r.data[r.pos]) | (u16(r.data[r.pos + 1]) << 8)
	r.pos += 2
	return v, true
}

@(private = "file")
read_u32_reader :: proc(r: ^Reader) -> (u32, bool) {
	if !can_read(r, 4) {return 0, false}
	v :=
		u32(r.data[r.pos]) |
		(u32(r.data[r.pos + 1]) << 8) |
		(u32(r.data[r.pos + 2]) << 16) |
		(u32(r.data[r.pos + 3]) << 24)
	r.pos += 4
	return v, true
}

@(private = "file")
read_u64_reader :: proc(r: ^Reader) -> (u64, bool) {
	if !can_read(r, 8) {return 0, false}
	v := u64(0)
	for i in 0 ..< 8 {v |= u64(r.data[r.pos + i]) << (8 * u64(i))}
	r.pos += 8
	return v, true
}

@(private = "file")
read_u16 :: proc(data: []u8, offset: int) -> u16 {return u16(data[offset]) | (u16(data[offset + 1]) << 8)}
@(private = "file")
read_u32 :: proc(data: []u8, offset: int) -> u32 {return(
		u32(data[offset]) |
		(u32(data[offset + 1]) << 8) |
		(u32(data[offset + 2]) << 16) |
		(u32(data[offset + 3]) << 24) \
	)}

@(private = "file")
read_string_reader :: proc(r: ^Reader) -> (string, bool) {
	count, ok := read_u32_reader(r)
	if !ok {return "", false}
	if !can_read(r, u64(count)) {return "", false}
	start := r.pos
	r.pos += int(count)
	return string(r.data[start:r.pos]), true
}

@(private = "file")
decode_bool :: proc(r: ^Reader, out: ^bool) -> bool {
	{
		b, ok := read_u8_reader(r)
		if !ok || b > 1 {return false}
		out^ = b == 1
	}
	return true
}

@(private = "file")
decode_u8 :: proc(r: ^Reader, out: ^u8) -> bool {
	{
		v, ok := read_u8_reader(r)
		if !ok {return false}
		out^ = v
	}
	return true
}

@(private = "file")
decode_u16 :: proc(r: ^Reader, out: ^u16) -> bool {
	{
		v, ok := read_u16_reader(r)
		if !ok {return false}
		out^ = v
	}
	return true
}

@(private = "file")
decode_u32 :: proc(r: ^Reader, out: ^u32) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = v
	}
	return true
}

@(private = "file")
decode_u64 :: proc(r: ^Reader, out: ^u64) -> bool {
	{
		v, ok := read_u64_reader(r)
		if !ok {return false}
		out^ = v
	}
	return true
}

@(private = "file")
decode_i8 :: proc(r: ^Reader, out: ^i8) -> bool {
	{
		v, ok := read_u8_reader(r)
		if !ok {return false}
		out^ = transmute(i8)v
	}
	return true
}

@(private = "file")
decode_i16 :: proc(r: ^Reader, out: ^i16) -> bool {
	{
		v, ok := read_u16_reader(r)
		if !ok {return false}
		out^ = transmute(i16)v
	}
	return true
}

@(private = "file")
decode_i32 :: proc(r: ^Reader, out: ^i32) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = transmute(i32)v
	}
	return true
}

@(private = "file")
decode_i64 :: proc(r: ^Reader, out: ^i64) -> bool {
	{
		v, ok := read_u64_reader(r)
		if !ok {return false}
		out^ = transmute(i64)v
	}
	return true
}

@(private = "file")
decode_f32 :: proc(r: ^Reader, out: ^f32) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = transmute(f32)v
	}
	return true
}

@(private = "file")
decode_f64 :: proc(r: ^Reader, out: ^f64) -> bool {
	{
		v, ok := read_u64_reader(r)
		if !ok {return false}
		out^ = transmute(f64)v
	}
	return true
}

@(private = "file")
decode_string :: proc(r: ^Reader, out: ^string) -> bool {
	{
		s, ok := read_string_reader(r)
		if !ok {return false}
		out^ = s
	}
	return true
}

@(private = "file")
decode_bytes :: proc(r: ^Reader, out: ^[]u8) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !can_read(r, u64(count)) {return false}
		start := r.pos
		r.pos += int(count)
		out^ = r.data[start:r.pos]
	}
	return true
}

@(private = "file")
decode_director_entity_id :: proc(r: ^Reader, out: ^director.Entity_Id) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out^ = director.Entity_Id(value)
	}
	return true
}

@(private = "file")
decode_director_word_id :: proc(r: ^Reader, out: ^director.Word_Id) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out^ = director.Word_Id(value)
	}
	return true
}

@(private = "file")
decode_director_rule_id :: proc(r: ^Reader, out: ^director.Rule_Id) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out^ = director.Rule_Id(value)
	}
	return true
}

@(private = "file")
decode_director_range :: proc(r: ^Reader, out: ^director.Range) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.offset = v
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.count = v
	}
	return true
}

@(private = "file")
decode_director_selector_kind :: proc(r: ^Reader, out: ^director.Selector_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Selector_Kind.Trigger) {return false}
		out^ = director.Selector_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_selector :: proc(r: ^Reader, out: ^director.Selector) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Selector_Kind.Trigger) {return false}
		out.kind = director.Selector_Kind(v)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.entity = director.Entity_Id(value)
	}
	return true
}

@(private = "file")
decode_director_compare_op :: proc(r: ^Reader, out: ^director.Compare_Op) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Compare_Op.Lt) {return false}
		out^ = director.Compare_Op(v)
	}
	return true
}

@(private = "file")
decode_director_query_kind :: proc(r: ^Reader, out: ^director.Query_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Query_Kind.Not) {return false}
		out^ = director.Query_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_stat_value_kind :: proc(r: ^Reader, out: ^director.Stat_Value_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Stat_Value_Kind.From_Trigger_Stat) {return false}
		out^ = director.Stat_Value_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_stat_value :: proc(r: ^Reader, out: ^director.Stat_Value) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Stat_Value_Kind.From_Trigger_Stat) {return false}
		out.kind = director.Stat_Value_Kind(v)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.entity = director.Entity_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.key = director.Word_Id(value)
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.value = transmute(i32)v
	}
	return true
}

@(private = "file")
decode_director_link_value_kind :: proc(r: ^Reader, out: ^director.Link_Value_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Link_Value_Kind.From_Trigger_Link) {return false}
		out^ = director.Link_Value_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_link_value :: proc(r: ^Reader, out: ^director.Link_Value) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Link_Value_Kind.From_Trigger_Link) {return false}
		out.kind = director.Link_Value_Kind(v)
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.matcher_index = v
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.entity = director.Entity_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.key = director.Word_Id(value)
	}
	return true
}

@(private = "file")
decode_director_query :: proc(r: ^Reader, out: ^director.Query) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Query_Kind.Not) {return false}
		out.kind = director.Query_Kind(v)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.key = director.Word_Id(value)
	}
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Compare_Op.Lt) {return false}
		out.op = director.Compare_Op(v)
	}
	{
		if !decode_director_stat_value(r, &out.stat_value) {return false}
	}
	{
		if !decode_director_link_value(r, &out.link_value) {return false}
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.nested = v
	}
	return true
}

@(private = "file")
decode_director_matcher :: proc(r: ^Reader, out: ^director.Matcher) -> bool {
	{
		if !decode_director_selector(r, &out.selector) {return false}
	}
	{
		if !decode_director_range(r, &out.queries) {return false}
	}
	return true
}

@(private = "file")
decode_director_change_kind :: proc(r: ^Reader, out: ^director.Change_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Change_Kind.Remove_Property) {return false}
		out^ = director.Change_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_change_target_kind :: proc(r: ^Reader, out: ^director.Change_Target_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Change_Target_Kind.All_Matching) {return false}
		out^ = director.Change_Target_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_change_target :: proc(r: ^Reader, out: ^director.Change_Target) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Change_Target_Kind.All_Matching) {return false}
		out.kind = director.Change_Target_Kind(v)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.entity = director.Entity_Id(value)
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.matcher_index = v
	}
	return true
}

@(private = "file")
decode_director_link_target_kind :: proc(r: ^Reader, out: ^director.Link_Target_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Link_Target_Kind.Lookup_Trigger_Link) {return false}
		out^ = director.Link_Target_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_link_target :: proc(r: ^Reader, out: ^director.Link_Target) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Link_Target_Kind.Lookup_Trigger_Link) {return false}
		out.kind = director.Link_Target_Kind(v)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.entity = director.Entity_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.key = director.Word_Id(value)
	}
	return true
}

@(private = "file")
decode_director_change :: proc(r: ^Reader, out: ^director.Change) -> bool {
	{
		if !decode_director_change_target(r, &out.target) {return false}
	}
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Change_Kind.Remove_Property) {return false}
		out.kind = director.Change_Kind(v)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.key = director.Word_Id(value)
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.int_value = transmute(i32)v
	}
	{
		if !decode_director_link_target(r, &out.link_target) {return false}
	}
	return true
}

@(private = "file")
decode_director_rule_trigger_kind :: proc(r: ^Reader, out: ^director.Rule_Trigger_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Rule_Trigger_Kind.Entity_Matcher) {return false}
		out^ = director.Rule_Trigger_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_rule_trigger :: proc(r: ^Reader, out: ^director.Rule_Trigger) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok || v > u32(director.Rule_Trigger_Kind.Entity_Matcher) {return false}
		out.kind = director.Rule_Trigger_Kind(v)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.signal = director.Word_Id(value)
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.matcher_index = v
	}
	return true
}

@(private = "file")
decode_director_rule :: proc(r: ^Reader, out: ^director.Rule) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.id = director.Rule_Id(value)
	}
	{
		if !decode_director_rule_trigger(r, &out.trigger) {return false}
	}
	{
		if !decode_director_range(r, &out.conditions) {return false}
	}
	{
		if !decode_director_range(r, &out.changes) {return false}
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.weight = transmute(i32)v
	}
	return true
}

@(private = "file")
decode_director_stat :: proc(r: ^Reader, out: ^director.Stat) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.key = director.Word_Id(value)
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.value = transmute(i32)v
	}
	return true
}

@(private = "file")
decode_director_link :: proc(r: ^Reader, out: ^director.Link) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.key = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.target = director.Entity_Id(value)
	}
	return true
}

@(private = "file")
decode_director_entity_def :: proc(r: ^Reader, out: ^director.Entity_Def) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.id = director.Entity_Id(value)
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !count_fits(r, count, 4) {return false}
		out.tags = make([]director.Word_Id, int(count))
		for decode_index_0 in 0 ..< int(count) {
			{
				value: u32
				{
					v, ok := read_u32_reader(r)
					if !ok {return false}
					value = v
				}
				out.tags[decode_index_0] = director.Word_Id(value)
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !count_fits(r, count, 8) {return false}
		out.stats = make([]director.Stat, int(count))
		for decode_index_1 in 0 ..< int(count) {
			{
				if !decode_director_stat(r, &out.stats[decode_index_1]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !count_fits(r, count, 8) {return false}
		out.links = make([]director.Link, int(count))
		for decode_index_2 in 0 ..< int(count) {
			{
				if !decode_director_link(r, &out.links[decode_index_2]) {return false}
			}
		}
	}
	{
		b, ok := read_u8_reader(r)
		if !ok || b > 1 {return false}
		out.removed = b == 1
	}
	return true
}

@(private = "file")
decode_director_director_data :: proc(r: ^Reader, out: ^director.Director_Data) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !count_fits(r, count, 17) {return false}
		out.entities = make([]director.Entity_Def, int(count))
		for decode_index_3 in 0 ..< int(count) {
			{
				if !decode_director_entity_def(r, &out.entities[decode_index_3]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !count_fits(r, count, 36) {return false}
		out.rules = make([]director.Rule, int(count))
		for decode_index_4 in 0 ..< int(count) {
			{
				if !decode_director_rule(r, &out.rules[decode_index_4]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !count_fits(r, count, 16) {return false}
		out.matchers = make([]director.Matcher, int(count))
		for decode_index_5 in 0 ..< int(count) {
			{
				if !decode_director_matcher(r, &out.matchers[decode_index_5]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !count_fits(r, count, 48) {return false}
		out.queries = make([]director.Query, int(count))
		for decode_index_6 in 0 ..< int(count) {
			{
				if !decode_director_query(r, &out.queries[decode_index_6]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		if !count_fits(r, count, 36) {return false}
		out.changes = make([]director.Change, int(count))
		for decode_index_7 in 0 ..< int(count) {
			{
				if !decode_director_change(r, &out.changes[decode_index_7]) {return false}
			}
		}
	}
	return true
}

Decoded :: struct {
	data:     director.Director_Data,
	bindings: station.Bindings,
}

read :: proc(bytes: []u8) -> (decoded: Decoded, ok: bool) {
	pkg, package_ok := open_respack(bytes)
	if !package_ok {return {}, false}
	r0, slot_0_ok := slot_reader(pkg, 0)
	if !slot_0_ok {return {}, false}

	result: Decoded
	succeeded := false
	defer if !succeeded {destroy(&result)}
	if !decode_director_director_data(&r0, &result.data) || r0.pos != len(r0.data) {
		return {}, false
	}

	r1, slot_1_ok := slot_reader(pkg, 1)
	if !slot_1_ok {return {}, false}
	count, count_ok := read_u32_reader(&r1)
	if !count_ok || !count_fits(&r1, count, 12) {return {}, false}
	result.bindings = make(station.Bindings, int(count))
	for i in 0 ..< int(count) {
		kind, kind_ok := read_u32_reader(&r1)
		if !kind_ok || kind > u32(station.Binding_Kind.Rule) {return {}, false}
		name, name_ok := read_string_reader(&r1)
		if !name_ok {return {}, false}
		value, value_ok := read_u32_reader(&r1)
		if !value_ok {return {}, false}
		result.bindings[i] = {
			kind  = station.Binding_Kind(kind),
			name  = name,
			value = value,
		}
	}
	if r1.pos != len(r1.data) || !validate(&result) {return {}, false}
	succeeded = true
	return result, true
}

destroy :: proc(decoded: ^Decoded) {
	for &entity in decoded.data.entities {
		delete(entity.tags)
		delete(entity.stats)
		delete(entity.links)
	}
	delete(decoded.data.entities)
	delete(decoded.data.rules)
	delete(decoded.data.matchers)
	delete(decoded.data.queries)
	delete(decoded.data.changes)
	delete(decoded.bindings)
	decoded^ = {}
}

validate :: proc(decoded: ^Decoded) -> bool {
	d := &decoded.data
	for entity, index in d.entities {
		if u64(entity.id) != u64(index) {return false}
		for link in entity.links {if !valid_index(u32(link.target), len(d.entities)) {return false}}
	}
	for matcher in d.matchers {
		if !valid_selector(matcher.selector, len(d.entities)) ||
		   !valid_range(matcher.queries, len(d.queries)) {return false}
	}
	for query in d.queries {
		switch query.kind {
		case .Has_Tag:
		case .Has_Stat:
			if query.stat_value.kind == .From_Entity_Stat &&
			   !valid_index(u32(query.stat_value.entity), len(d.entities)) {return false}
		case .Has_Link:
			switch query.link_value.kind {
			case .Specific_Matcher:
				if !valid_index(query.link_value.matcher_index, len(d.matchers)) {return false}
			case .From_Entity_Link:
				if !valid_index(u32(query.link_value.entity), len(d.entities)) {return false}
			case .From_Trigger_Link:
			}
		case .Not:
			if !valid_index(query.nested, len(d.queries)) {return false}
		}
	}
	if has_not_cycle(d.queries) {return false}
	for change in d.changes {
		switch change.target.kind {
		case .Entity:
			if !valid_index(u32(change.target.entity), len(d.entities)) {return false}
		case .All_Matching:
			if !valid_index(change.target.matcher_index, len(d.matchers)) {return false}
		case .Trigger:
		}
		if change.kind == .Set_Link {
			switch change.link_target.kind {
			case .Entity, .Lookup_Entity_Link:
				if !valid_index(u32(change.link_target.entity), len(d.entities)) {return false}
			case .Trigger, .Lookup_Trigger_Link:
			}
		}
	}
	for rule in d.rules {
		if !valid_range(rule.conditions, len(d.matchers)) || !valid_range(rule.changes, len(d.changes)) {return false}
		if rule.trigger.kind == .Entity_Matcher &&
		   !valid_index(rule.trigger.matcher_index, len(d.matchers)) {return false}
	}
	for binding, index in decoded.bindings {
		for other in decoded.bindings[index + 1:] {
			if binding.kind == other.kind && binding.name == other.name {return false}
		}
		switch binding.kind {
		case .Entity:
			if !valid_index(binding.value, len(d.entities)) {return false}
		case .Rule:
			if !has_rule_id(d.rules, director.Rule_Id(binding.value)) {return false}
		case .Word:
		}
	}
	return required_bindings(decoded)
}

valid_index :: proc(index: u32, length: int) -> bool {
	return u64(index) < u64(length)
}

has_rule_id :: proc(rules: []director.Rule, id: director.Rule_Id) -> bool {
	for rule in rules {if rule.id == id {return true}}
	return false
}

has_not_cycle :: proc(queries: []director.Query) -> bool {
	for query, start in queries {
		if query.kind != .Not {continue}
		cursor := u32(start)
		for _ in 0 ..< len(queries) {
			current := queries[int(cursor)]
			if current.kind != .Not {break}
			cursor = current.nested
			if !valid_index(cursor, len(queries)) {return true}
		}
		if queries[int(cursor)].kind == .Not {return true}
	}
	return false
}

valid_selector :: proc(selector: director.Selector, entity_count: int) -> bool {
	return selector.kind != .Entity || valid_index(u32(selector.entity), entity_count)
}

valid_range :: proc(value: director.Range, length: int) -> bool {
	return u64(value.offset) + u64(value.count) <= u64(length)
}

required_bindings :: proc(decoded: ^Decoded) -> bool {
	required_entities := [?]string{"PLAYER", "POWER_SWITCH", "ACCESS_KEY", "EXIT"}
	required_words := [?]string{"powered", "carrying_key", "locked"}
	for name in required_entities {if !has_binding(decoded.bindings, .Entity, name) {return false}}
	for name in required_words {if !has_binding(decoded.bindings, .Word, name) {return false}}
	return true
}

has_binding :: proc(bindings: station.Bindings, kind: station.Binding_Kind, name: string) -> bool {
	for binding in bindings {if binding.kind == kind && binding.name == name {return true}}
	return false
}
