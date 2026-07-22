package data_director

import director "../director"
import world "../world"

@(private = "file")
RSPK_VERSION :: u16(1)

@(private = "file")
Reader :: struct {
	data: []u8,
	pos:  int,
}

Package :: struct {
	data:    []u8,
	offsets: [3]u32,
	lengths: [3]u32,
}

open_respack :: proc(data: []u8) -> (Package, bool) {
	if len(data) < 8 {return Package{}, false}
	if data[0] != 'R' || data[1] != 'S' || data[2] != 'P' || data[3] != 'K' {return Package{}, false}
	if read_u16(data, 4) != RSPK_VERSION {return Package{}, false}
	if int(read_u16(data, 6)) != 3 {return Package{}, false}
	if len(data) < 32 {return Package{}, false}
	pkg := Package {
		data = data,
	}
	for i in 0 ..< 3 {
		entry := 8 + i * 8
		pkg.offsets[i] = read_u32(data, entry)
		pkg.lengths[i] = read_u32(data, entry + 4)
	}
	return pkg, true
}

@(private = "file")
slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 3 {return Reader{}, false}
	offset := int(pkg.offsets[slot])
	length := int(pkg.lengths[slot])
	if length == 0 {return Reader{}, false}
	if offset < 0 || offset + length > len(pkg.data) {return Reader{}, false}
	return Reader{data = pkg.data[offset:offset + length]}, true
}

@(private = "file")
read_u8_reader :: proc(r: ^Reader) -> (u8, bool) {
	if r.pos + 1 > len(r.data) {return 0, false}
	v := r.data[r.pos]
	r.pos += 1
	return v, true
}

@(private = "file")
read_u16_reader :: proc(r: ^Reader) -> (u16, bool) {
	if r.pos + 2 > len(r.data) {return 0, false}
	v := u16(r.data[r.pos]) | (u16(r.data[r.pos + 1]) << 8)
	r.pos += 2
	return v, true
}

@(private = "file")
read_u32_reader :: proc(r: ^Reader) -> (u32, bool) {
	if r.pos + 4 > len(r.data) {return 0, false}
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
	if r.pos + 8 > len(r.data) {return 0, false}
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
	start := r.pos
	end := start + int(count)
	if end > len(r.data) {return "", false}
	r.pos = end
	return string(r.data[start:end]), true
}

Segment_Trigger_Def :: struct {
	segment:         i32,
	once:            bool,
	director_signal: director.Word_Id,
}

Segment_Trigger_Defs :: []Segment_Trigger_Def

@(private = "file")
DecodedSlots :: struct {
	has_slot_0: bool,
	slot_0:     director.Director_Data,
	has_slot_1: bool,
	slot_1:     Segment_Trigger_Defs,
	has_slot_2: bool,
	slot_2:     world.Director_Config,
}

@(private = "file")
decode_bool :: proc(r: ^Reader, out: ^bool) -> bool {
	{
		b, ok := read_u8_reader(r)
		if !ok {return false}
		out^ = b != 0
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
		start := r.pos
		end := start + int(count)
		if end > len(r.data) {return false}
		r.pos = end
		out^ = r.data[start:end]
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
		if !ok {return false}
		out^ = director.Selector_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_selector :: proc(r: ^Reader, out: ^director.Selector) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
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
		if !ok {return false}
		out^ = director.Compare_Op(v)
	}
	return true
}

@(private = "file")
decode_director_query_kind :: proc(r: ^Reader, out: ^director.Query_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = director.Query_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_stat_value_kind :: proc(r: ^Reader, out: ^director.Stat_Value_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = director.Stat_Value_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_stat_value :: proc(r: ^Reader, out: ^director.Stat_Value) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
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
		if !ok {return false}
		out^ = director.Link_Value_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_link_value :: proc(r: ^Reader, out: ^director.Link_Value) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
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
		if !ok {return false}
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
		if !ok {return false}
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
		if !ok {return false}
		out^ = director.Change_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_change_target_kind :: proc(r: ^Reader, out: ^director.Change_Target_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = director.Change_Target_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_change_target :: proc(r: ^Reader, out: ^director.Change_Target) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
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
		if !ok {return false}
		out^ = director.Link_Target_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_link_target :: proc(r: ^Reader, out: ^director.Link_Target) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
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
		if !ok {return false}
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
		if !ok {return false}
		out^ = director.Rule_Trigger_Kind(v)
	}
	return true
}

@(private = "file")
decode_director_rule_trigger :: proc(r: ^Reader, out: ^director.Rule_Trigger) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
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
		out.tags = make([]director.Word_Id, int(count))
		for i0 in 0 ..< int(count) {
			{
				value: u32
				{
					v, ok := read_u32_reader(r)
					if !ok {return false}
					value = v
				}
				out.tags[i0] = director.Word_Id(value)
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.stats = make([]director.Stat, int(count))
		for i1 in 0 ..< int(count) {
			{
				if !decode_director_stat(r, &out.stats[i1]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.links = make([]director.Link, int(count))
		for i2 in 0 ..< int(count) {
			{
				if !decode_director_link(r, &out.links[i2]) {return false}
			}
		}
	}
	{
		b, ok := read_u8_reader(r)
		if !ok {return false}
		out.removed = b != 0
	}
	return true
}

@(private = "file")
decode_director_director_data :: proc(r: ^Reader, out: ^director.Director_Data) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entities = make([]director.Entity_Def, int(count))
		for i3 in 0 ..< int(count) {
			{
				if !decode_director_entity_def(r, &out.entities[i3]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.rules = make([]director.Rule, int(count))
		for i4 in 0 ..< int(count) {
			{
				if !decode_director_rule(r, &out.rules[i4]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.matchers = make([]director.Matcher, int(count))
		for i5 in 0 ..< int(count) {
			{
				if !decode_director_matcher(r, &out.matchers[i5]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.queries = make([]director.Query, int(count))
		for i6 in 0 ..< int(count) {
			{
				if !decode_director_query(r, &out.queries[i6]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.changes = make([]director.Change, int(count))
		for i7 in 0 ..< int(count) {
			{
				if !decode_director_change(r, &out.changes[i7]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_segment_trigger_def :: proc(r: ^Reader, out: ^Segment_Trigger_Def) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.segment = transmute(i32)v
	}
	{
		b, ok := read_u8_reader(r)
		if !ok {return false}
		out.once = b != 0
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.director_signal = director.Word_Id(value)
	}
	return true
}

@(private = "file")
decode_segment_trigger_defs :: proc(r: ^Reader, out: ^Segment_Trigger_Defs) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(Segment_Trigger_Defs, int(count))
		for i8 in 0 ..< int(count) {
			{
				if !decode_segment_trigger_def(r, &out^[i8]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_world_director_config :: proc(r: ^Reader, out: ^world.Director_Config) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.player = director.Entity_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.spawn_x = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.spawn_y = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.world_entity = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.spawn = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.prefab = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.prefab_id = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.vision_enter = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.vision_exit = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.attack_enter = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.attack_exit = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.damage_source = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.behavior = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.target = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.firing = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.patrolling = director.Entity_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.chasing = director.Entity_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.attacking = director.Entity_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.dialog = director.Word_Id(value)
	}
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.text_id = director.Word_Id(value)
	}
	{
		for i9 in 0 ..< 4 {
			{
				value: u32
				{
					v, ok := read_u32_reader(r)
					if !ok {return false}
					value = v
				}
				out.answer_links[i9] = director.Word_Id(value)
			}
		}
	}
	return true
}

read_slot_0_director_director_data :: proc(pkg: Package) -> (director.Director_Data, bool) {
	r, ok := slot_reader(pkg, 0)
	if !ok {return director.Director_Data{}, false}
	value: director.Director_Data
	if !decode_director_director_data(&r, &value) {return director.Director_Data{}, false}
	return value, true
}

read_slot_1_segment_trigger_defs :: proc(pkg: Package) -> (Segment_Trigger_Defs, bool) {
	r, ok := slot_reader(pkg, 1)
	if !ok {return nil, false}
	value: Segment_Trigger_Defs
	if !decode_segment_trigger_defs(&r, &value) {return nil, false}
	return value, true
}

read_slot_2_world_director_config :: proc(pkg: Package) -> (world.Director_Config, bool) {
	r, ok := slot_reader(pkg, 2)
	if !ok {return world.Director_Config{}, false}
	value: world.Director_Config
	if !decode_world_director_config(&r, &value) {return world.Director_Config{}, false}
	return value, true
}
