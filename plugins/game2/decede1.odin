package main

RSPK_VERSION :: u16(1)

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
	if data[0] != 'R' ||
	   data[1] != 'S' ||
	   data[2] != 'P' ||
	   data[3] != 'K' {return Package{}, false}
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

slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 3 {return Reader{}, false}
	offset := int(pkg.offsets[slot])
	length := int(pkg.lengths[slot])
	if length == 0 {return Reader{}, false}
	if offset < 0 || offset + length > len(pkg.data) {return Reader{}, false}
	return Reader{data = pkg.data[offset:offset + length]}, true
}

read_u8_reader :: proc(r: ^Reader) -> (u8, bool) {
	if r.pos + 1 > len(r.data) {return 0, false}
	v := r.data[r.pos]
	r.pos += 1
	return v, true
}

read_u16_reader :: proc(r: ^Reader) -> (u16, bool) {
	if r.pos + 2 > len(r.data) {return 0, false}
	v := u16(r.data[r.pos]) | (u16(r.data[r.pos + 1]) << 8)
	r.pos += 2
	return v, true
}

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

read_u64_reader :: proc(r: ^Reader) -> (u64, bool) {
	if r.pos + 8 > len(r.data) {return 0, false}
	v := u64(0)
	for i in 0 ..< 8 {v |= u64(r.data[r.pos + i]) << (8 * u64(i))}
	r.pos += 8
	return v, true
}

read_u16 :: proc(data: []u8, offset: int) -> u16 {return(
		u16(data[offset]) |
		(u16(data[offset + 1]) << 8) \
	)}
read_u32 :: proc(data: []u8, offset: int) -> u32 {return(
		u32(data[offset]) |
		(u32(data[offset + 1]) << 8) |
		(u32(data[offset + 2]) << 16) |
		(u32(data[offset + 3]) << 24) \
	)}

read_string_reader :: proc(r: ^Reader) -> (string, bool) {
	count, ok := read_u32_reader(r)
	if !ok {return "", false}
	start := r.pos
	end := start + int(count)
	if end > len(r.data) {return "", false}
	r.pos = end
	return string(r.data[start:end]), true
}

vec2 :: [2]i32

entity_ids :: []u32

positions :: struct {
	entity_ids: entity_ids,
	components: []vec2,
}

atlas :: []u8

uv :: [4]f32

sprites :: []uv

DecodedSlots :: struct {
	has_slot_0: bool,
	slot_0:     positions,
	has_slot_1: bool,
	slot_1:     atlas,
	has_slot_2: bool,
	slot_2:     sprites,
}

decode_bool :: proc(r: ^Reader, out: ^bool) -> bool {
	{
		b, ok := read_u8_reader(r)
		if !ok {return false}
		out^ = b != 0
	}
	return true
}

decode_u8 :: proc(r: ^Reader, out: ^u8) -> bool {
	{
		v, ok := read_u8_reader(r)
		if !ok {return false}
		out^ = v
	}
	return true
}

decode_u16 :: proc(r: ^Reader, out: ^u16) -> bool {
	{
		v, ok := read_u16_reader(r)
		if !ok {return false}
		out^ = v
	}
	return true
}

decode_u32 :: proc(r: ^Reader, out: ^u32) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = v
	}
	return true
}

decode_u64 :: proc(r: ^Reader, out: ^u64) -> bool {
	{
		v, ok := read_u64_reader(r)
		if !ok {return false}
		out^ = v
	}
	return true
}

decode_i8 :: proc(r: ^Reader, out: ^i8) -> bool {
	{
		v, ok := read_u8_reader(r)
		if !ok {return false}
		out^ = transmute(i8)v
	}
	return true
}

decode_i16 :: proc(r: ^Reader, out: ^i16) -> bool {
	{
		v, ok := read_u16_reader(r)
		if !ok {return false}
		out^ = transmute(i16)v
	}
	return true
}

decode_i32 :: proc(r: ^Reader, out: ^i32) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = transmute(i32)v
	}
	return true
}

decode_i64 :: proc(r: ^Reader, out: ^i64) -> bool {
	{
		v, ok := read_u64_reader(r)
		if !ok {return false}
		out^ = transmute(i64)v
	}
	return true
}

decode_f32 :: proc(r: ^Reader, out: ^f32) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = transmute(f32)v
	}
	return true
}

decode_f64 :: proc(r: ^Reader, out: ^f64) -> bool {
	{
		v, ok := read_u64_reader(r)
		if !ok {return false}
		out^ = transmute(f64)v
	}
	return true
}

decode_string :: proc(r: ^Reader, out: ^string) -> bool {
	{
		s, ok := read_string_reader(r)
		if !ok {return false}
		out^ = s
	}
	return true
}

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

decode_vec2 :: proc(r: ^Reader, out: ^vec2) -> bool {
	{
		for j in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[j] = transmute(i32)v
			}
		}
	}
	return true
}

decode_entity_ids :: proc(r: ^Reader, out: ^entity_ids) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(entity_ids, int(count))
		for i in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[i] = v
			}
		}
	}
	return true
}

decode_positions :: proc(r: ^Reader, out: ^positions) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(entity_ids, int(count))
		for i in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[i] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]vec2, int(count))
		for i in 0 ..< int(count) {
			{
				for j in 0 ..< 2 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out.components[i][j] = transmute(i32)v
					}
				}
			}
		}
	}
	return true
}

decode_atlas :: proc(r: ^Reader, out: ^atlas) -> bool {
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

decode_uv :: proc(r: ^Reader, out: ^uv) -> bool {
	{
		for j in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[j] = transmute(f32)v
			}
		}
	}
	return true
}

decode_sprites :: proc(r: ^Reader, out: ^sprites) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(sprites, int(count))
		for i in 0 ..< int(count) {
			{
				for j in 0 ..< 4 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out^[i][j] = transmute(f32)v
					}
				}
			}
		}
	}
	return true
}

read_slot_0_positions :: proc(pkg: Package) -> (positions, bool) {
	r, ok := slot_reader(pkg, 0)
	if !ok {return positions{}, false}
	value: positions
	if !decode_positions(&r, &value) {return positions{}, false}
	return value, true
}

read_slot_1_atlas :: proc(pkg: Package) -> (atlas, bool) {
	r, ok := slot_reader(pkg, 1)
	if !ok {return nil, false}
	value: atlas
	if !decode_atlas(&r, &value) {return nil, false}
	return value, true
}

read_slot_2_sprites :: proc(pkg: Package) -> (sprites, bool) {
	r, ok := slot_reader(pkg, 2)
	if !ok {return nil, false}
	value: sprites
	if !decode_sprites(&r, &value) {return nil, false}
	return value, true
}
