package data_level

import director "../director"
import shape "../world/shape"
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
	offsets: [14]u32,
	lengths: [14]u32,
}

open_respack :: proc(data: []u8) -> (Package, bool) {
	if len(data) < 8 {return Package{}, false}
	if data[0] != 'R' || data[1] != 'S' || data[2] != 'P' || data[3] != 'K' {return Package{}, false}
	if read_u16(data, 4) != RSPK_VERSION {return Package{}, false}
	if int(read_u16(data, 6)) != 14 {return Package{}, false}
	if len(data) < 120 {return Package{}, false}
	pkg := Package {
		data = data,
	}
	for i in 0 ..< 14 {
		entry := 8 + i * 8
		pkg.offsets[i] = read_u32(data, entry)
		pkg.lengths[i] = read_u32(data, entry + 4)
	}
	return pkg, true
}

@(private = "file")
slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 14 {return Reader{}, false}
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

Next_Entity_Id :: u32

Input_Value :: u8

Vec2f :: [2]f32

Brains :: struct {
	entity_ids: Entity_Ids,
	components: []world.Brain,
}

Inputs :: struct {
	entity_ids: Entity_Ids,
	components: []Input_Value,
}

Velocities :: struct {
	entity_ids: Entity_Ids,
	components: []world.Velocity,
}

Colliders :: struct {
	entity_ids: Entity_Ids,
	components: []shape.Capsule,
}

Player_Hurts :: struct {
	entity_ids: Entity_Ids,
	components: []shape.Capsule,
}

Platformers :: struct {
	entity_ids: Entity_Ids,
	components: []world.Platformer,
}

Sprites :: struct {
	entity_ids: Entity_Ids,
	components: []world.Sprite,
}

I_Vec4 :: [4]i32

Entity_Ids :: []u32

Positions :: struct {
	entity_ids: Entity_Ids,
	components: []world.Position,
}

Director_Trigger_Aabbs :: struct {
	entity_ids: Entity_Ids,
	components: []world.Director_Trigger_Aabb,
}

Director_Entities :: struct {
	entity_ids: Entity_Ids,
	components: []world.Director_Entity,
}

Atlas :: []u8

Platformer_Zones :: []world.Platformer_Zone

Segments :: []I_Vec4

@(private = "file")
DecodedSlots :: struct {
	has_slot_0:  bool,
	slot_0:      Atlas,
	has_slot_1:  bool,
	slot_1:      Segments,
	has_slot_2:  bool,
	slot_2:      Platformer_Zones,
	has_slot_3:  bool,
	slot_3:      Positions,
	has_slot_4:  bool,
	slot_4:      Director_Trigger_Aabbs,
	has_slot_5:  bool,
	slot_5:      Director_Entities,
	has_slot_6:  bool,
	slot_6:      Next_Entity_Id,
	has_slot_7:  bool,
	slot_7:      Brains,
	has_slot_8:  bool,
	slot_8:      Inputs,
	has_slot_9:  bool,
	slot_9:      Velocities,
	has_slot_10: bool,
	slot_10:     Colliders,
	has_slot_11: bool,
	slot_11:     Player_Hurts,
	has_slot_12: bool,
	slot_12:     Platformers,
	has_slot_13: bool,
	slot_13:     Sprites,
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
decode_next_entity_id :: proc(r: ^Reader, out: ^Next_Entity_Id) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out^ = Next_Entity_Id(value)
	}
	return true
}

@(private = "file")
decode_world_brain :: proc(r: ^Reader, out: ^world.Brain) -> bool {
	{
		value: i8
		{
			v, ok := read_u8_reader(r)
			if !ok {return false}
			value = transmute(i8)v
		}
		out^ = world.Brain(value)
	}
	return true
}

@(private = "file")
decode_input_value :: proc(r: ^Reader, out: ^Input_Value) -> bool {
	{
		value: u8
		{
			v, ok := read_u8_reader(r)
			if !ok {return false}
			value = v
		}
		out^ = Input_Value(value)
	}
	return true
}

@(private = "file")
decode_world_velocity :: proc(r: ^Reader, out: ^world.Velocity) -> bool {
	{
		for decode_index_0 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[decode_index_0] = transmute(i32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_shape_capsule :: proc(r: ^Reader, out: ^shape.Capsule) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.x = transmute(i32)v
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.y = transmute(i32)v
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.radius = transmute(i32)v
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.height = transmute(i32)v
	}
	return true
}

@(private = "file")
decode_world_platformer :: proc(r: ^Reader, out: ^world.Platformer) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.facing = transmute(i32)v
	}
	return true
}

@(private = "file")
decode_vec2f :: proc(r: ^Reader, out: ^Vec2f) -> bool {
	{
		for decode_index_1 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[decode_index_1] = transmute(f32)v
			}
		}
	}
	return true
}

@(private = "file")
decode_world_sprite :: proc(r: ^Reader, out: ^world.Sprite) -> bool {
	{
		for decode_index_2 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.pos[decode_index_2] = transmute(f32)v
			}
		}
	}
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.opacity = transmute(f32)v
	}
	return true
}

@(private = "file")
decode_brains :: proc(r: ^Reader, out: ^Brains) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_3 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_3] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Brain, int(count))
		for decode_index_4 in 0 ..< int(count) {
			{
				value: i8
				{
					v, ok := read_u8_reader(r)
					if !ok {return false}
					value = transmute(i8)v
				}
				out.components[decode_index_4] = world.Brain(value)
			}
		}
	}
	return true
}

@(private = "file")
decode_inputs :: proc(r: ^Reader, out: ^Inputs) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_5 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_5] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]Input_Value, int(count))
		for decode_index_6 in 0 ..< int(count) {
			{
				value: u8
				{
					v, ok := read_u8_reader(r)
					if !ok {return false}
					value = v
				}
				out.components[decode_index_6] = Input_Value(value)
			}
		}
	}
	return true
}

@(private = "file")
decode_velocities :: proc(r: ^Reader, out: ^Velocities) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_7 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_7] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Velocity, int(count))
		for decode_index_8 in 0 ..< int(count) {
			{
				for decode_index_9 in 0 ..< 2 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out.components[decode_index_8][decode_index_9] = transmute(i32)v
					}
				}
			}
		}
	}
	return true
}

@(private = "file")
decode_colliders :: proc(r: ^Reader, out: ^Colliders) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_10 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_10] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]shape.Capsule, int(count))
		for decode_index_11 in 0 ..< int(count) {
			{
				if !decode_shape_capsule(r, &out.components[decode_index_11]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_player_hurts :: proc(r: ^Reader, out: ^Player_Hurts) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_12 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_12] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]shape.Capsule, int(count))
		for decode_index_13 in 0 ..< int(count) {
			{
				if !decode_shape_capsule(r, &out.components[decode_index_13]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_platformers :: proc(r: ^Reader, out: ^Platformers) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_14 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_14] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Platformer, int(count))
		for decode_index_15 in 0 ..< int(count) {
			{
				if !decode_world_platformer(r, &out.components[decode_index_15]) {return false}
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
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_16 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_16] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Sprite, int(count))
		for decode_index_17 in 0 ..< int(count) {
			{
				if !decode_world_sprite(r, &out.components[decode_index_17]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_i_vec4 :: proc(r: ^Reader, out: ^I_Vec4) -> bool {
	{
		for decode_index_18 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[decode_index_18] = transmute(i32)v
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
		for decode_index_19 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[decode_index_19] = v
			}
		}
	}
	return true
}

@(private = "file")
decode_world_position :: proc(r: ^Reader, out: ^world.Position) -> bool {
	{
		for decode_index_20 in 0 ..< 2 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out^[decode_index_20] = transmute(i32)v
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
		for decode_index_21 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_21] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Position, int(count))
		for decode_index_22 in 0 ..< int(count) {
			{
				for decode_index_23 in 0 ..< 2 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out.components[decode_index_22][decode_index_23] = transmute(i32)v
					}
				}
			}
		}
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
decode_world_director_trigger_aabb :: proc(r: ^Reader, out: ^world.Director_Trigger_Aabb) -> bool {
	{
		for decode_index_24 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.bounds[decode_index_24] = transmute(i32)v
			}
		}
	}
	{
		b, ok := read_u8_reader(r)
		if !ok {return false}
		out.once = b != 0
	}
	{
		b, ok := read_u8_reader(r)
		if !ok {return false}
		out.used = b != 0
	}
	return true
}

@(private = "file")
decode_world_director_entity :: proc(r: ^Reader, out: ^world.Director_Entity) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out.id = director.Entity_Id(value)
	}
	return true
}

@(private = "file")
decode_director_trigger_aabbs :: proc(r: ^Reader, out: ^Director_Trigger_Aabbs) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_25 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_25] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Director_Trigger_Aabb, int(count))
		for decode_index_26 in 0 ..< int(count) {
			{
				if !decode_world_director_trigger_aabb(r, &out.components[decode_index_26]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_director_entities :: proc(r: ^Reader, out: ^Director_Entities) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.entity_ids = make(Entity_Ids, int(count))
		for decode_index_27 in 0 ..< int(count) {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.entity_ids[decode_index_27] = v
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.components = make([]world.Director_Entity, int(count))
		for decode_index_28 in 0 ..< int(count) {
			{
				if !decode_world_director_entity(r, &out.components[decode_index_28]) {return false}
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
		for decode_index_29 in 0 ..< 4 {
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				out.bounds[decode_index_29] = transmute(i32)v
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
		for decode_index_30 in 0 ..< int(count) {
			{
				if !decode_world_platformer_zone(r, &out^[decode_index_30]) {return false}
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
		for decode_index_31 in 0 ..< int(count) {
			{
				for decode_index_32 in 0 ..< 4 {
					{
						v, ok := read_u32_reader(r)
						if !ok {return false}
						out^[decode_index_31][decode_index_32] = transmute(i32)v
					}
				}
			}
		}
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

read_slot_1_segments :: proc(pkg: Package) -> (Segments, bool) {
	r, ok := slot_reader(pkg, 1)
	if !ok {return nil, false}
	value: Segments
	if !decode_segments(&r, &value) {return nil, false}
	return value, true
}

read_slot_2_platformer_zones :: proc(pkg: Package) -> (Platformer_Zones, bool) {
	r, ok := slot_reader(pkg, 2)
	if !ok {return nil, false}
	value: Platformer_Zones
	if !decode_platformer_zones(&r, &value) {return nil, false}
	return value, true
}

read_slot_3_positions :: proc(pkg: Package) -> (Positions, bool) {
	r, ok := slot_reader(pkg, 3)
	if !ok {return Positions{}, false}
	value: Positions
	if !decode_positions(&r, &value) {return Positions{}, false}
	return value, true
}

read_slot_4_director_trigger_aabbs :: proc(pkg: Package) -> (Director_Trigger_Aabbs, bool) {
	r, ok := slot_reader(pkg, 4)
	if !ok {return Director_Trigger_Aabbs{}, false}
	value: Director_Trigger_Aabbs
	if !decode_director_trigger_aabbs(&r, &value) {return Director_Trigger_Aabbs{}, false}
	return value, true
}

read_slot_5_director_entities :: proc(pkg: Package) -> (Director_Entities, bool) {
	r, ok := slot_reader(pkg, 5)
	if !ok {return Director_Entities{}, false}
	value: Director_Entities
	if !decode_director_entities(&r, &value) {return Director_Entities{}, false}
	return value, true
}

read_slot_6_next_entity_id :: proc(pkg: Package) -> (Next_Entity_Id, bool) {
	r, ok := slot_reader(pkg, 6)
	if !ok {return Next_Entity_Id{}, false}
	value: Next_Entity_Id
	if !decode_next_entity_id(&r, &value) {return Next_Entity_Id{}, false}
	return value, true
}

read_slot_7_brains :: proc(pkg: Package) -> (Brains, bool) {
	r, ok := slot_reader(pkg, 7)
	if !ok {return Brains{}, false}
	value: Brains
	if !decode_brains(&r, &value) {return Brains{}, false}
	return value, true
}

read_slot_8_inputs :: proc(pkg: Package) -> (Inputs, bool) {
	r, ok := slot_reader(pkg, 8)
	if !ok {return Inputs{}, false}
	value: Inputs
	if !decode_inputs(&r, &value) {return Inputs{}, false}
	return value, true
}

read_slot_9_velocities :: proc(pkg: Package) -> (Velocities, bool) {
	r, ok := slot_reader(pkg, 9)
	if !ok {return Velocities{}, false}
	value: Velocities
	if !decode_velocities(&r, &value) {return Velocities{}, false}
	return value, true
}

read_slot_10_colliders :: proc(pkg: Package) -> (Colliders, bool) {
	r, ok := slot_reader(pkg, 10)
	if !ok {return Colliders{}, false}
	value: Colliders
	if !decode_colliders(&r, &value) {return Colliders{}, false}
	return value, true
}

read_slot_11_player_hurts :: proc(pkg: Package) -> (Player_Hurts, bool) {
	r, ok := slot_reader(pkg, 11)
	if !ok {return Player_Hurts{}, false}
	value: Player_Hurts
	if !decode_player_hurts(&r, &value) {return Player_Hurts{}, false}
	return value, true
}

read_slot_12_platformers :: proc(pkg: Package) -> (Platformers, bool) {
	r, ok := slot_reader(pkg, 12)
	if !ok {return Platformers{}, false}
	value: Platformers
	if !decode_platformers(&r, &value) {return Platformers{}, false}
	return value, true
}

read_slot_13_sprites :: proc(pkg: Package) -> (Sprites, bool) {
	r, ok := slot_reader(pkg, 13)
	if !ok {return Sprites{}, false}
	value: Sprites
	if !decode_sprites(&r, &value) {return Sprites{}, false}
	return value, true
}
