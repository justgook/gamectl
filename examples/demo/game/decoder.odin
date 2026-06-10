package main

import world "world"

@(private = "file")
RSPK_VERSION :: u16(1)

@(private = "file")
Reader :: struct {
	data: []u8,
	pos:  int,
}

Package :: struct {
	data:    []u8,
	offsets: [6]u32,
	lengths: [6]u32,
}

open_respack :: proc(data: []u8) -> (Package, bool) {
	if len(data) < 8 {return Package{}, false}
	if data[0] != 'R' || data[1] != 'S' || data[2] != 'P' || data[3] != 'K' {return Package{}, false}
	if read_u16(data, 4) != RSPK_VERSION {return Package{}, false}
	if int(read_u16(data, 6)) != 6 {return Package{}, false}
	if len(data) < 56 {return Package{}, false}
	pkg := Package {
		data = data,
	}
	for i in 0 ..< 6 {
		entry := 8 + i * 8
		pkg.offsets[i] = read_u32(data, entry)
		pkg.lengths[i] = read_u32(data, entry + 4)
	}
	return pkg, true
}

@(private = "file")
slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 6 {return Reader{}, false}
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

Vec4 :: [4]f32

I_Vec4 :: [4]i32

Entity_Ids :: []u32

Positions :: struct {
	entity_ids: Entity_Ids,
	components: []world.Position,
}

Atlas :: []u8

Uv :: [4]f32

Sprites :: []Uv

Lut :: []u8

Tilemaps :: struct {
	entity_ids: Entity_Ids,
	components: []world.Tilemap,
}

Segments :: []I_Vec4

@(private = "file")
DecodedSlots :: struct {
	has_slot_0: bool,
	slot_0:     Positions,
	has_slot_1: bool,
	slot_1:     Atlas,
	has_slot_2: bool,
	slot_2:     Sprites,
	has_slot_3: bool,
	slot_3:     Lut,
	has_slot_4: bool,
	slot_4:     Tilemaps,
	has_slot_5: bool,
	slot_5:     Segments,
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
decode_vec4 :: proc(r: ^Reader, out: ^Vec4) -> bool {
	{
		for i1 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i1] = transmute(f32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_world_position :: proc(r: ^Reader, out: ^world.Position) -> bool {
	{
		for i2 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i2] = transmute(i32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_i_vec4 :: proc(r: ^Reader, out: ^I_Vec4) -> bool {
	{
		for i3 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i3] = transmute(i32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_entity_ids :: proc(r: ^Reader, out: ^Entity_Ids) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(Entity_Ids, int(count))
		for i4 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i4] = v
			}
		}
	}
	return true
}

@(private = "file")
decode_positions :: proc(r: ^Reader, out: ^Positions) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for i5 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[i5] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Position, int(count))
		for i6 in 0 ..< int(count) {
			{
				for i7 in 0 ..< 2 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out.components[i6][i7] = transmute(i32)v
					}
				}
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
		for i8 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i8] = transmute(f32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_sprites :: proc(r: ^Reader, out: ^Sprites) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(Sprites, int(count))
		for i9 in 0 ..< int(count) {
			{
				for i10 in 0 ..< 4 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out^[i9][i10] = transmute(f32)v
					}
				}
			}
		}
	}
	return true
}

@(private = "file")
decode_lut :: proc(r: ^Reader, out: ^Lut) -> bool {
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
decode_tilemaps :: proc(r: ^Reader, out: ^Tilemaps) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for i11 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[i11] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Tilemap, int(count))
		for i12 in 0 ..< int(count) {
			{
				if !decode_world_tilemap(r, &out.components[i12]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_world_tilemap :: proc(r: ^Reader, out: ^world.Tilemap) -> bool {
	{
		for i13 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.pos[i13] = transmute(f32)v
			}
		}
	}
	{
		for i14 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.tile_size[i14] = transmute(f32)v
			}
		}
	}
	{
		for i15 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.tileset_uv[i15] = transmute(f32)v
			}
		}
	}
	{
		for i16 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.lut_uv[i16] = transmute(f32)v
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
		for i17 in 0 ..< int(count) {
			{
				for i18 in 0 ..< 4 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out^[i17][i18] = transmute(i32)v
					}
				}
			}
		}
	}
	return true
}

read_slot_0_positions :: proc(pkg: Package) -> (Positions, bool) {
	r, ok := slot_reader(pkg, 0)
	if !ok {return Positions{}, false}
	value: Positions
	if !decode_positions(&r, &value) {return Positions{}, false}
	return value, true
}

read_slot_1_atlas :: proc(pkg: Package) -> (Atlas, bool) {
	r, ok := slot_reader(pkg, 1)
	if !ok {return nil, false}
	value: Atlas
	if !decode_atlas(&r, &value) {return nil, false}
	return value, true
}

read_slot_2_sprites :: proc(pkg: Package) -> (Sprites, bool) {
	r, ok := slot_reader(pkg, 2)
	if !ok {return nil, false}
	value: Sprites
	if !decode_sprites(&r, &value) {return nil, false}
	return value, true
}

read_slot_3_lut :: proc(pkg: Package) -> (Lut, bool) {
	r, ok := slot_reader(pkg, 3)
	if !ok {return nil, false}
	value: Lut
	if !decode_lut(&r, &value) {return nil, false}
	return value, true
}

read_slot_4_tilemaps :: proc(pkg: Package) -> (Tilemaps, bool) {
	r, ok := slot_reader(pkg, 4)
	if !ok {return Tilemaps{}, false}
	value: Tilemaps
	if !decode_tilemaps(&r, &value) {return Tilemaps{}, false}
	return value, true
}

read_slot_5_segments :: proc(pkg: Package) -> (Segments, bool) {
	r, ok := slot_reader(pkg, 5)
	if !ok {return nil, false}
	value: Segments
	if !decode_segments(&r, &value) {return nil, false}
	return value, true
}
