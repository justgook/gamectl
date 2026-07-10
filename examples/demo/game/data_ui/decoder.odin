package data_ui

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

Atlas :: []u8

Nines :: [12]world.Nine_Patch

Fonts :: [6]world.Text_Font

@(private = "file")
DecodedSlots :: struct {
	has_slot_0: bool,
	slot_0:     Atlas,
	has_slot_1: bool,
	slot_1:     Nines,
	has_slot_2: bool,
	slot_2:     Fonts,
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
decode_nines :: proc(r: ^Reader, out: ^Nines) -> bool {
	{
		for i0 in 0 ..< 12 {
			{
				if !decode_world_nine_patch(r, &out^[i0]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_world_nine_patch :: proc(r: ^Reader, out: ^world.Nine_Patch) -> bool {
	{
		for i1 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.slices[i1] = transmute(f32)v
			}
		}
	}
	{
		for i2 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.size[i2] = transmute(f32)v
			}
		}
	}
	{
		for i3 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.uv[i3] = transmute(f32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_fonts :: proc(r: ^Reader, out: ^Fonts) -> bool {
	{
		for i4 in 0 ..< 6 {
			{
				if !decode_world_text_font(r, &out^[i4]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_world_text_font :: proc(r: ^Reader, out: ^world.Text_Font) -> bool {
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
				out.glyph_size[i6] = transmute(f32)v
			}
		}
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.columns = v
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.rows = v
	}
	return true
}

read_slot_0_atlas :: proc(pkg: Package) -> (Atlas, bool) {
	r, ok := slot_reader(pkg, 0)
	if !ok {return nil, false}
	value: Atlas
	if !decode_atlas(&r, &value) {return nil, false}
	return value, true
}

read_slot_1_nines :: proc(pkg: Package) -> (Nines, bool) {
	r, ok := slot_reader(pkg, 1)
	if !ok {return Nines{}, false}
	value: Nines
	if !decode_nines(&r, &value) {return Nines{}, false}
	return value, true
}

read_slot_2_fonts :: proc(pkg: Package) -> (Fonts, bool) {
	r, ok := slot_reader(pkg, 2)
	if !ok {return Fonts{}, false}
	value: Fonts
	if !decode_fonts(&r, &value) {return Fonts{}, false}
	return value, true
}
