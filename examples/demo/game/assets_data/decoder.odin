package assets_data

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
	offsets: [5]u32,
	lengths: [5]u32,
}

open_respack :: proc(data: []u8) -> (Package, bool) {
	if len(data) < 8 {return Package{}, false}
	if data[0] != 'R' || data[1] != 'S' || data[2] != 'P' || data[3] != 'K' {return Package{}, false}
	if read_u16(data, 4) != RSPK_VERSION {return Package{}, false}
	if int(read_u16(data, 6)) != 5 {return Package{}, false}
	if len(data) < 48 {return Package{}, false}
	pkg := Package {
		data = data,
	}
	for i in 0 ..< 5 {
		entry := 8 + i * 8
		pkg.offsets[i] = read_u32(data, entry)
		pkg.lengths[i] = read_u32(data, entry + 4)
	}
	return pkg, true
}

@(private = "file")
slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 5 {return Reader{}, false}
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

Vec2 :: [2]f32

I_Vec4 :: [4]i32

Atlas :: []u8

Uv :: [4]f32

U_Vs :: []Uv

Platformer_Zones :: []world.Platformer_Zone

Segments :: []I_Vec4

@(private = "file")
DecodedSlots :: struct {
	has_slot_0: bool,
	slot_0:     U_Vs,
	has_slot_1: bool,
	slot_1:     Atlas,
	has_slot_2: bool,
	slot_2:     world.Animation_Atlas,
	has_slot_3: bool,
	slot_3:     Segments,
	has_slot_4: bool,
	slot_4:     Platformer_Zones,
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
decode_vec2 :: proc(r: ^Reader, out: ^Vec2) -> bool {
	{
		for i0 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i0] = transmute(f32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_i_vec4 :: proc(r: ^Reader, out: ^I_Vec4) -> bool {
	{
		for i1 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i1] = transmute(i32)v
			}
		}
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
decode_uv :: proc(r: ^Reader, out: ^Uv) -> bool {
	{
		for i2 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i2] = transmute(f32)v
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
		for i3 in 0 ..< int(count) {
			{
				for i4 in 0 ..< 4 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out^[i3][i4] = transmute(f32)v
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
		for i5 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.uv[i5] = transmute(f32)v
			}
		}
	}
	{
		for i6 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.offset[i6] = transmute(i32)v
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
		for i7 in 0 ..< int(count) {
			{
				if !decode_world_anim_def(r, &out.defs[i7]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.frames = make([]world.AnimFrame, int(count))
		for i8 in 0 ..< int(count) {
			{
				if !decode_world_anim_frame(r, &out.frames[i8]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_world_platformer_zone_kind :: proc(r: ^Reader, out: ^world.Platformer_Zone_Kind) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = world.Platformer_Zone_Kind(v)
	}
	return true
}

@(private = "file")
decode_world_platformer_zone :: proc(r: ^Reader, out: ^world.Platformer_Zone) -> bool {
	{
		s, ok := read_string_reader(r)
		if !ok {return false}
		out.id = s
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.kind = world.Platformer_Zone_Kind(v)
	}
	{
		for i9 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.bounds[i9] = transmute(i32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_platformer_zones :: proc(r: ^Reader, out: ^Platformer_Zones) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(Platformer_Zones, int(count))
		for i10 in 0 ..< int(count) {
			{
				if !decode_world_platformer_zone(r, &out^[i10]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_segments :: proc(r: ^Reader, out: ^Segments) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(Segments, int(count))
		for i11 in 0 ..< int(count) {
			{
				for i12 in 0 ..< 4 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out^[i11][i12] = transmute(i32)v
					}
				}
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

read_slot_3_segments :: proc(pkg: Package) -> (Segments, bool) {
	r, ok := slot_reader(pkg, 3)
	if !ok {return nil, false}
	value: Segments
	if !decode_segments(&r, &value) {return nil, false}
	return value, true
}

read_slot_4_platformer_zones :: proc(pkg: Package) -> (Platformer_Zones, bool) {
	r, ok := slot_reader(pkg, 4)
	if !ok {return nil, false}
	value: Platformer_Zones
	if !decode_platformer_zones(&r, &value) {return nil, false}
	return value, true
}
