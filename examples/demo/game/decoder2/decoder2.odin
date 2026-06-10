package decoder2

@(private = "file")
RSPK_VERSION :: u16(1)

@(private = "file")
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

@(private = "file")
slot_reader :: proc(pkg: Package, slot: int) -> (Reader, bool) {
	if slot < 0 || slot >= 1 {return Reader{}, false}
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

Bullet_Patterns :: []Bullet_Pattern

Bullet_Pattern :: struct {
	type:    Pattern_Type,
	bullets: []Bullet,
	actions: []Action,
	fires:   []Fire,
}

Pattern_Type :: enum u32 {
	None       = 0,
	Vertical   = 1,
	Horizontal = 2,
}

Expr_Kind :: enum u16 {
	None        = 0,
	Expr_Number = 1,
	Expr_String = 2,
}
Expr :: struct {
	kind:        Expr_Kind,
	expr_number: Expr_Number,
	expr_string: Expr_String,
}

Expr_Number :: f64

Expr_String :: string

Ref_Kind :: enum u16 {
	None            = 0,
	Ref_Index       = 1,
	Ref_With_Params = 2,
}
Ref :: struct {
	kind:            Ref_Kind,
	ref_index:       Ref_Index,
	ref_with_params: Ref_With_Params,
}

Ref_Index :: u32

Ref_With_Params :: struct {
	ref:    u32,
	params: []Expr,
}

Bullet :: struct {
	direction:   Direction,
	speed:       Speed,
	action_refs: []Ref,
}

Action :: []Command

Command_Kind :: enum u16 {
	None             = 0,
	Fire_Ref         = 1,
	Action_Ref       = 2,
	Wait             = 3,
	Repeat           = 4,
	Vanish           = 5,
	Change_Direction = 6,
	Change_Speed     = 7,
	Accel            = 8,
}
Command :: struct {
	kind:             Command_Kind,
	fire_ref:         Fire_Ref,
	action_ref:       Action_Ref,
	wait:             Wait,
	repeat:           Repeat,
	vanish:           Vanish,
	change_direction: Change_Direction,
	change_speed:     Change_Speed,
	accel:            Accel,
}

Fire_Ref :: Ref

Action_Ref :: Ref

Wait :: Expr

Vanish :: bool

Repeat :: struct {
	times:      Expr,
	action_ref: Ref,
}

Change_Direction :: struct {
	direction: Direction,
	term:      Expr,
}

Change_Speed :: struct {
	speed: Speed,
	term:  Expr,
}

Accel :: struct {
	horizontal: Accel_Value,
	vertical:   Accel_Value,
	term:       Expr,
}

Accel_Value :: struct {
	type:  Speed_Type,
	value: Expr,
}

Fire :: struct {
	direction:  Direction,
	speed:      Speed,
	bullet_ref: Ref,
}

Direction :: struct {
	type:  Direction_Type,
	value: Expr,
}

Direction_Type :: enum u32 {
	Aim      = 0,
	Absolute = 1,
	Relative = 2,
	Sequence = 3,
}

Speed :: struct {
	type:  Speed_Type,
	value: Expr,
}

Speed_Type :: enum u32 {
	Absolute = 0,
	Relative = 1,
	Sequence = 2,
}

@(private = "file")
DecodedSlots :: struct {
	has_slot_0: bool,
	slot_0:     Bullet_Patterns,
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
decode_bullet_patterns :: proc(r: ^Reader, out: ^Bullet_Patterns) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(Bullet_Patterns, int(count))
		for i0 in 0 ..< int(count) {
			{
				if !decode_bullet_pattern(r, &out^[i0]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_bullet_pattern :: proc(r: ^Reader, out: ^Bullet_Pattern) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.type = Pattern_Type(v)
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.bullets = make([]Bullet, int(count))
		for i1 in 0 ..< int(count) {
			{
				if !decode_bullet(r, &out.bullets[i1]) {return false}
			}
		}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.actions = make([]Action, int(count))
		for i2 in 0 ..< int(count) {
			{
				count, ok := read_u32_reader(r)
				if !ok {return false}
				out.actions[i2] = make(Action, int(count))
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
		out.fires = make([]Fire, int(count))
		for i4 in 0 ..< int(count) {
			{
				if !decode_fire(r, &out.fires[i4]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_pattern_type :: proc(r: ^Reader, out: ^Pattern_Type) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = Pattern_Type(v)
	}
	return true
}

@(private = "file")
decode_expr :: proc(r: ^Reader, out: ^Expr) -> bool {
	tag, ok := read_u16_reader(r)
	if !ok {return false}
	out.kind = Expr_Kind(tag)
	#partial switch out.kind {
	case .Expr_Number:
		{
			value: f64
			{
				v, ok := read_u64_reader(r)
				if !ok {return false}
				value = transmute(f64)v
			}
			out.expr_number = Expr_Number(value)
		}
	case .Expr_String:
		{
			value: string
			{
				s, ok := read_string_reader(r)
				if !ok {return false}
				value = s
			}
			out.expr_string = Expr_String(value)
		}
	case .None:
		return false
	case:
		return false
	}
	return true
}

@(private = "file")
decode_expr_number :: proc(r: ^Reader, out: ^Expr_Number) -> bool {
	{
		value: f64
		{
			v, ok := read_u64_reader(r)
			if !ok {return false}
			value = transmute(f64)v
		}
		out^ = Expr_Number(value)
	}
	return true
}

@(private = "file")
decode_expr_string :: proc(r: ^Reader, out: ^Expr_String) -> bool {
	{
		value: string
		{
			s, ok := read_string_reader(r)
			if !ok {return false}
			value = s
		}
		out^ = Expr_String(value)
	}
	return true
}

@(private = "file")
decode_ref :: proc(r: ^Reader, out: ^Ref) -> bool {
	tag, ok := read_u16_reader(r)
	if !ok {return false}
	out.kind = Ref_Kind(tag)
	#partial switch out.kind {
	case .Ref_Index:
		{
			value: u32
			{
				v, ok := read_u32_reader(r)
				if !ok {return false}
				value = v
			}
			out.ref_index = Ref_Index(value)
		}
	case .Ref_With_Params:
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

@(private = "file")
decode_ref_index :: proc(r: ^Reader, out: ^Ref_Index) -> bool {
	{
		value: u32
		{
			v, ok := read_u32_reader(r)
			if !ok {return false}
			value = v
		}
		out^ = Ref_Index(value)
	}
	return true
}

@(private = "file")
decode_ref_with_params :: proc(r: ^Reader, out: ^Ref_With_Params) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.ref = v
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.params = make([]Expr, int(count))
		for i5 in 0 ..< int(count) {
			{
				if !decode_expr(r, &out.params[i5]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_bullet :: proc(r: ^Reader, out: ^Bullet) -> bool {
	{
		if !decode_direction(r, &out.direction) {return false}
	}
	{
		if !decode_speed(r, &out.speed) {return false}
	}
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out.action_refs = make([]Ref, int(count))
		for i6 in 0 ..< int(count) {
			{
				if !decode_ref(r, &out.action_refs[i6]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_action :: proc(r: ^Reader, out: ^Action) -> bool {
	{
		count, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = make(Action, int(count))
		for i7 in 0 ..< int(count) {
			{
				if !decode_command(r, &out^[i7]) {return false}
			}
		}
	}
	return true
}

@(private = "file")
decode_command :: proc(r: ^Reader, out: ^Command) -> bool {
	tag, ok := read_u16_reader(r)
	if !ok {return false}
	out.kind = Command_Kind(tag)
	#partial switch out.kind {
	case .Fire_Ref:
		{
			value: Ref
			if !decode_ref(r, &value) {return false}
			out.fire_ref = Fire_Ref(value)
		}
	case .Action_Ref:
		{
			value: Ref
			if !decode_ref(r, &value) {return false}
			out.action_ref = Action_Ref(value)
		}
	case .Wait:
		{
			value: Expr
			if !decode_expr(r, &value) {return false}
			out.wait = Wait(value)
		}
	case .Repeat:
		{
			if !decode_repeat(r, &out.repeat) {return false}
		}
	case .Vanish:
		{
			value: bool
			{
				b, ok := read_u8_reader(r)
				if !ok {return false}
				value = b != 0
			}
			out.vanish = Vanish(value)
		}
	case .Change_Direction:
		{
			if !decode_change_direction(r, &out.change_direction) {return false}
		}
	case .Change_Speed:
		{
			if !decode_change_speed(r, &out.change_speed) {return false}
		}
	case .Accel:
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

@(private = "file")
decode_fire_ref :: proc(r: ^Reader, out: ^Fire_Ref) -> bool {
	{
		value: Ref
		if !decode_ref(r, &value) {return false}
		out^ = Fire_Ref(value)
	}
	return true
}

@(private = "file")
decode_action_ref :: proc(r: ^Reader, out: ^Action_Ref) -> bool {
	{
		value: Ref
		if !decode_ref(r, &value) {return false}
		out^ = Action_Ref(value)
	}
	return true
}

@(private = "file")
decode_wait :: proc(r: ^Reader, out: ^Wait) -> bool {
	{
		value: Expr
		if !decode_expr(r, &value) {return false}
		out^ = Wait(value)
	}
	return true
}

@(private = "file")
decode_vanish :: proc(r: ^Reader, out: ^Vanish) -> bool {
	{
		value: bool
		{
			b, ok := read_u8_reader(r)
			if !ok {return false}
			value = b != 0
		}
		out^ = Vanish(value)
	}
	return true
}

@(private = "file")
decode_repeat :: proc(r: ^Reader, out: ^Repeat) -> bool {
	{
		if !decode_expr(r, &out.times) {return false}
	}
	{
		if !decode_ref(r, &out.action_ref) {return false}
	}
	return true
}

@(private = "file")
decode_change_direction :: proc(r: ^Reader, out: ^Change_Direction) -> bool {
	{
		if !decode_direction(r, &out.direction) {return false}
	}
	{
		if !decode_expr(r, &out.term) {return false}
	}
	return true
}

@(private = "file")
decode_change_speed :: proc(r: ^Reader, out: ^Change_Speed) -> bool {
	{
		if !decode_speed(r, &out.speed) {return false}
	}
	{
		if !decode_expr(r, &out.term) {return false}
	}
	return true
}

@(private = "file")
decode_accel :: proc(r: ^Reader, out: ^Accel) -> bool {
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

@(private = "file")
decode_accel_value :: proc(r: ^Reader, out: ^Accel_Value) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.type = Speed_Type(v)
	}
	{
		if !decode_expr(r, &out.value) {return false}
	}
	return true
}

@(private = "file")
decode_fire :: proc(r: ^Reader, out: ^Fire) -> bool {
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

@(private = "file")
decode_direction :: proc(r: ^Reader, out: ^Direction) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.type = Direction_Type(v)
	}
	{
		if !decode_expr(r, &out.value) {return false}
	}
	return true
}

@(private = "file")
decode_direction_type :: proc(r: ^Reader, out: ^Direction_Type) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = Direction_Type(v)
	}
	return true
}

@(private = "file")
decode_speed :: proc(r: ^Reader, out: ^Speed) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out.type = Speed_Type(v)
	}
	{
		if !decode_expr(r, &out.value) {return false}
	}
	return true
}

@(private = "file")
decode_speed_type :: proc(r: ^Reader, out: ^Speed_Type) -> bool {
	{
		v, ok := read_u32_reader(r)
		if !ok {return false}
		out^ = Speed_Type(v)
	}
	return true
}

read_slot_0_bullet_patterns :: proc(pkg: Package) -> (Bullet_Patterns, bool) {
	r, ok := slot_reader(pkg, 0)
	if !ok {return nil, false}
	value: Bullet_Patterns
	if !decode_bullet_patterns(&r, &value) {return nil, false}
	return value, true
}
