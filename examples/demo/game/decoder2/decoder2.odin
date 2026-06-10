package decoder2

RSPK_VERSION :: u16(1)

Reader :: struct {
	data: []u8,
	pos:  int,
}

Package :: struct {
	data:    []u8,
	offsets: [1]u32,
	lengths: [1]u32,
}

open_respack :: proc(data: []u8) -> (Package, bool) {
	if len(data) < 8 {return Package{}, false}
	if data[0] != 'R' || data[1] != 'S' || data[2] != 'P' || data[3] != 'K' {return Package{}, false}
	if read_u16(data, 4) != RSPK_VERSION {return Package{}, false}
	if int(read_u16(data, 6)) != 1 {return Package{}, false}
	if len(data) < 16 {return Package{}, false}
	pkg := Package {
		data = data,
	}
	for i in 0 ..< 1 {
		entry := 8 + i * 8
		pkg.offsets[i] = read_u32(data, entry)
		pkg.lengths[i] = read_u32(data, entry + 4)
	}
	return pkg, true
}

slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 1 {return Reader{}, false}
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

read_u16 :: proc(data: []u8, offset: int) -> u16 {return u16(data[offset]) | (u16(data[offset + 1]) << 8)}
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

bullet_patterns :: []bullet_pattern

bullet_pattern :: struct {
	type:    pattern_type,
	bullets: []bullet,
	actions: []action,
	fires:   []fire,
}

pattern_type :: enum u32 {
	none       = 0,
	vertical   = 1,
	horizontal = 2,
}

expr_Kind :: enum u16 {
	None        = 0,
	expr_number = 1,
	expr_string = 2,
}
expr :: struct {
	kind:        expr_Kind,
	expr_number: expr_number,
	expr_string: expr_string,
}

expr_number :: f64

expr_string :: string

ref_Kind :: enum u16 {
	None            = 0,
	ref_index       = 1,
	ref_with_params = 2,
}
ref :: struct {
	kind:            ref_Kind,
	ref_index:       ref_index,
	ref_with_params: ref_with_params,
}

ref_index :: u32

ref_with_params :: struct {
	ref:    u32,
	params: []expr,
}

bullet :: struct {
	direction:   direction,
	speed:       speed,
	action_refs: []ref,
}

action :: []command

command_Kind :: enum u16 {
	None             = 0,
	fire_ref         = 1,
	action_ref       = 2,
	wait             = 3,
	repeat           = 4,
	vanish           = 5,
	change_direction = 6,
	change_speed     = 7,
	accel            = 8,
}
command :: struct {
	kind:             command_Kind,
	fire_ref:         fire_ref,
	action_ref:       action_ref,
	wait:             wait,
	repeat:           repeat,
	vanish:           vanish,
	change_direction: change_direction,
	change_speed:     change_speed,
	accel:            accel,
}

fire_ref :: ref

action_ref :: ref

wait :: expr

vanish :: bool

repeat :: struct {
	times:      expr,
	action_ref: ref,
}

change_direction :: struct {
	direction: direction,
	term:      expr,
}

change_speed :: struct {
	speed: speed,
	term:  expr,
}

accel :: struct {
	horizontal: accel_value,
	vertical:   accel_value,
	term:       expr,
}

accel_value :: struct {
	type:  speed_type,
	value: expr,
}

fire :: struct {
	direction:  direction,
	speed:      speed,
	bullet_ref: ref,
}

direction :: struct {
	type:  direction_type,
	value: expr,
}

direction_type :: enum u32 {
	aim      = 0,
	absolute = 1,
	relative = 2,
	sequence = 3,
}

speed :: struct {
	type:  speed_type,
	value: expr,
}

speed_type :: enum u32 {
	absolute = 0,
	relative = 1,
	sequence = 2,
}

DecodedSlots :: struct {
	has_slot_0: bool,
	slot_0:     bullet_patterns,
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

decode_bullet_patterns :: proc(r: ^Reader, out: ^bullet_patterns) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(bullet_patterns, int(count))
		for i0 in 0 ..< int(count) {
			{
				if !decode_bullet_pattern(r, &out^[i0]) {return false}
			}
		}
	}
	return true
}

decode_bullet_pattern :: proc(r: ^Reader, out: ^bullet_pattern) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.type = pattern_type(v)
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.bullets = make([]bullet, int(count))
		for i1 in 0 ..< int(count) {
			{
				if !decode_bullet(r, &out.bullets[i1]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.actions = make([]action, int(count))
		for i2 in 0 ..< int(count) {
			{
				count, ok := read_u32_reader(r)
				if !ok {return false}
				out.actions[i2] = make(action, int(count))
				for i3 in 0 ..< int(count) {
					{
						if !decode_command(r, &out.actions[i2][i3]) {return false}
					}
				}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.fires = make([]fire, int(count))
		for i4 in 0 ..< int(count) {
			{
				if !decode_fire(r, &out.fires[i4]) {return false}
			}
		}
	}
	return true
}

decode_pattern_type :: proc(r: ^Reader, out: ^pattern_type) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = pattern_type(v)
	}
	return true
}

decode_expr :: proc(r: ^Reader, out: ^expr) -> bool {
	tag, ok := read_u16_reader(r)
	if !ok {return false}
	out.kind = expr_Kind(tag)
	#partial switch out.kind {
	case .expr_number:
		{
			value: f64
			{
				v, ok := read_u64_reader(r)
				if !ok {return false}
				value = transmute(f64)v
			}
			out.expr_number = expr_number(value)
		}
	case .expr_string:
		{
			value: string
			{
				s, ok := read_string_reader(r)
				if !ok {return false}
				value = s
			}
			out.expr_string = expr_string(value)
		}
	case .None:
		return false
	case:
		return false
	}
	return true
}

decode_expr_number :: proc(r: ^Reader, out: ^expr_number) -> bool {
	{
		value: f64
		{
			v, ok := read_u64_reader(r)
			if !ok {return false}
			value = transmute(f64)v
		}
		out^ = expr_number(value)
	}
	return true
}

decode_expr_string :: proc(r: ^Reader, out: ^expr_string) -> bool {
	{
		value: string
		{
			s, ok := read_string_reader(r)
			if !ok {return false}
			value = s
		}
		out^ = expr_string(value)
	}
	return true
}

decode_ref :: proc(r: ^Reader, out: ^ref) -> bool {
	tag, ok := read_u16_reader(r)
	if !ok {return false}
	out.kind = ref_Kind(tag)
	#partial switch out.kind {
	case .ref_index:
		{
			value: u32
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				value = v
			}
			out.ref_index = ref_index(value)
		}
	case .ref_with_params:
		{
			if !decode_ref_with_params(r, &out.ref_with_params) {return false}
		}
	case .None:
		return false
	case:
		return false
	}
	return true
}

decode_ref_index :: proc(r: ^Reader, out: ^ref_index) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out^ = ref_index(value)
	}
	return true
}

decode_ref_with_params :: proc(r: ^Reader, out: ^ref_with_params) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.ref = v
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.params = make([]expr, int(count))
		for i5 in 0 ..< int(count) {
			{
				if !decode_expr(r, &out.params[i5]) {return false}
			}
		}
	}
	return true
}

decode_bullet :: proc(r: ^Reader, out: ^bullet) -> bool {
	{
		if !decode_direction(r, &out.direction) {return false}
	}
	{
		if !decode_speed(r, &out.speed) {return false}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.action_refs = make([]ref, int(count))
		for i6 in 0 ..< int(count) {
			{
				if !decode_ref(r, &out.action_refs[i6]) {return false}
			}
		}
	}
	return true
}

decode_action :: proc(r: ^Reader, out: ^action) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(action, int(count))
		for i7 in 0 ..< int(count) {
			{
				if !decode_command(r, &out^[i7]) {return false}
			}
		}
	}
	return true
}

decode_command :: proc(r: ^Reader, out: ^command) -> bool {
	tag, ok := read_u16_reader(r)
	if !ok {return false}
	out.kind = command_Kind(tag)
	#partial switch out.kind {
	case .fire_ref:
		{
			value: ref
			if !decode_ref(r, &value) {return false}
			out.fire_ref = fire_ref(value)
		}
	case .action_ref:
		{
			value: ref
			if !decode_ref(r, &value) {return false}
			out.action_ref = action_ref(value)
		}
	case .wait:
		{
			value: expr
			if !decode_expr(r, &value) {return false}
			out.wait = wait(value)
		}
	case .repeat:
		{
			if !decode_repeat(r, &out.repeat) {return false}
		}
	case .vanish:
		{
			value: bool
			{
				b, ok := read_u8_reader(r)
				if !ok {return false}
				value = b != 0
			}
			out.vanish = vanish(value)
		}
	case .change_direction:
		{
			if !decode_change_direction(r, &out.change_direction) {return false}
		}
	case .change_speed:
		{
			if !decode_change_speed(r, &out.change_speed) {return false}
		}
	case .accel:
		{
			if !decode_accel(r, &out.accel) {return false}
		}
	case .None:
		return false
	case:
		return false
	}
	return true
}

decode_fire_ref :: proc(r: ^Reader, out: ^fire_ref) -> bool {
	{
		value: ref
		if !decode_ref(r, &value) {return false}
		out^ = fire_ref(value)
	}
	return true
}

decode_action_ref :: proc(r: ^Reader, out: ^action_ref) -> bool {
	{
		value: ref
		if !decode_ref(r, &value) {return false}
		out^ = action_ref(value)
	}
	return true
}

decode_wait :: proc(r: ^Reader, out: ^wait) -> bool {
	{
		value: expr
		if !decode_expr(r, &value) {return false}
		out^ = wait(value)
	}
	return true
}

decode_vanish :: proc(r: ^Reader, out: ^vanish) -> bool {
	{
		value: bool
		{
			b, ok := read_u8_reader(r)
			if !ok {return false}
			value = b != 0
		}
		out^ = vanish(value)
	}
	return true
}

decode_repeat :: proc(r: ^Reader, out: ^repeat) -> bool {
	{
		if !decode_expr(r, &out.times) {return false}
	}
	{
		if !decode_ref(r, &out.action_ref) {return false}
	}
	return true
}

decode_change_direction :: proc(r: ^Reader, out: ^change_direction) -> bool {
	{
		if !decode_direction(r, &out.direction) {return false}
	}
	{
		if !decode_expr(r, &out.term) {return false}
	}
	return true
}

decode_change_speed :: proc(r: ^Reader, out: ^change_speed) -> bool {
	{
		if !decode_speed(r, &out.speed) {return false}
	}
	{
		if !decode_expr(r, &out.term) {return false}
	}
	return true
}

decode_accel :: proc(r: ^Reader, out: ^accel) -> bool {
	{
		if !decode_accel_value(r, &out.horizontal) {return false}
	}
	{
		if !decode_accel_value(r, &out.vertical) {return false}
	}
	{
		if !decode_expr(r, &out.term) {return false}
	}
	return true
}

decode_accel_value :: proc(r: ^Reader, out: ^accel_value) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.type = speed_type(v)
	}
	{
		if !decode_expr(r, &out.value) {return false}
	}
	return true
}

decode_fire :: proc(r: ^Reader, out: ^fire) -> bool {
	{
		if !decode_direction(r, &out.direction) {return false}
	}
	{
		if !decode_speed(r, &out.speed) {return false}
	}
	{
		if !decode_ref(r, &out.bullet_ref) {return false}
	}
	return true
}

decode_direction :: proc(r: ^Reader, out: ^direction) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.type = direction_type(v)
	}
	{
		if !decode_expr(r, &out.value) {return false}
	}
	return true
}

decode_direction_type :: proc(r: ^Reader, out: ^direction_type) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = direction_type(v)
	}
	return true
}

decode_speed :: proc(r: ^Reader, out: ^speed) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.type = speed_type(v)
	}
	{
		if !decode_expr(r, &out.value) {return false}
	}
	return true
}

decode_speed_type :: proc(r: ^Reader, out: ^speed_type) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = speed_type(v)
	}
	return true
}

read_slot_0_bullet_patterns :: proc(pkg: Package) -> (bullet_patterns, bool) {
	r, ok := slot_reader(pkg, 0)
	if !ok {return nil, false}
	value: bullet_patterns
	if !decode_bullet_patterns(&r, &value) {return nil, false}
	return value, true
}
