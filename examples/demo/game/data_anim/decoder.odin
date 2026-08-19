package data_anim

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
	offsets: [4]u32,
	lengths: [4]u32,
}

open_respack :: proc(data: []u8) -> (Package, bool) {
	if len(data) < 8 {return Package{}, false}
	if data[0] != 'R' || data[1] != 'S' || data[2] != 'P' || data[3] != 'K' {return Package{}, false}
	if read_u16(data, 4) != RSPK_VERSION {return Package{}, false}
	if int(read_u16(data, 6)) != 4 {return Package{}, false}
	if len(data) < 40 {return Package{}, false}
	pkg := Package {
		data = data,
	}
	for i in 0 ..< 4 {
		entry := 8 + i * 8
		pkg.offsets[i] = read_u32(data, entry)
		pkg.lengths[i] = read_u32(data, entry + 4)
	}
	return pkg, true
}

@(private = "file")
slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 4 {return Reader{}, false}
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

Atlas :: []u8

Normal_Atlas :: []u8

Uv :: [4]f32

U_Vs :: []Uv

@(private = "file")
DecodedSlots :: struct {
	has_slot_0: bool,
	slot_0:     U_Vs,
	has_slot_1: bool,
	slot_1:     Atlas,
	has_slot_2: bool,
	slot_2:     world.Animation_Atlas,
	has_slot_3: bool,
	slot_3:     Normal_Atlas,
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
decode_atlas :: proc(r: ^Reader, out: ^Atlas) -> bool {
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
decode_normal_atlas :: proc(r: ^Reader, out: ^Normal_Atlas) -> bool {
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
decode_uv :: proc(r: ^Reader, out: ^Uv) -> bool {
	{
		for decode_index_0 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[decode_index_0] = transmute(f32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_u_vs :: proc(r: ^Reader, out: ^U_Vs) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(U_Vs, int(count))
		for decode_index_1 in 0 ..< int(count) {
			{
				for decode_index_2 in 0 ..< 4 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out^[decode_index_1][decode_index_2] = transmute(f32)v
					}
				}
			}
		}
	}
	return true
}

@(private = "file")
decode_world_anim_frame :: proc(r: ^Reader, out: ^world.AnimFrame) -> bool {
	{
		for decode_index_3 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.uv[decode_index_3] = transmute(f32)v
			}
		}
	}
	{
		for decode_index_4 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.offset[decode_index_4] = transmute(i32)v
			}
		}
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.duration = transmute(f32)v
	}
	{
		v, ok := read_u8_reader(r)
		if !ok {return false}
		out.flip = v
	}
	return true
}

@(private = "file")
decode_world_anim_def :: proc(r: ^Reader, out: ^world.AnimDef) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.frame_start = v
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.frame_count = v
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.repeat = v
	}
	return true
}

@(private = "file")
decode_world_animation_atlas :: proc(r: ^Reader, out: ^world.Animation_Atlas) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.defs = make([]world.AnimDef, int(count))
		for decode_index_5 in 0 ..< int(count) {
			{
				if !decode_world_anim_def(r, &out.defs[decode_index_5]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.frames = make([]world.AnimFrame, int(count))
		for decode_index_6 in 0 ..< int(count) {
			{
				if !decode_world_anim_frame(r, &out.frames[decode_index_6]) {return false}
			}
		}
	}
	return true
}

read_slot_0_u_vs :: proc(pkg: Package) -> (U_Vs, bool) {
	r, ok := slot_reader(pkg, 0)
	if !ok {return nil, false}
	value: U_Vs
	if !decode_u_vs(&r, &value) {return nil, false}
	return value, true
}

read_slot_1_atlas :: proc(pkg: Package) -> (Atlas, bool) {
	r, ok := slot_reader(pkg, 1)
	if !ok {return nil, false}
	value: Atlas
	if !decode_atlas(&r, &value) {return nil, false}
	return value, true
}

read_slot_2_world_animation_atlas :: proc(pkg: Package) -> (world.Animation_Atlas, bool) {
	r, ok := slot_reader(pkg, 2)
	if !ok {return world.Animation_Atlas{}, false}
	value: world.Animation_Atlas
	if !decode_world_animation_atlas(&r, &value) {return world.Animation_Atlas{}, false}
	return value, true
}

read_slot_3_normal_atlas :: proc(pkg: Package) -> (Normal_Atlas, bool) {
	r, ok := slot_reader(pkg, 3)
	if !ok {return nil, false}
	value: Normal_Atlas
	if !decode_normal_atlas(&r, &value) {return nil, false}
	return value, true
}
