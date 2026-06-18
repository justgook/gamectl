package ui

// Low-level immediate UI tree.
//
// Shape is only transform/style data. It does not know about sprites,
// nine-patches, text, input, ECS, or rendering.
//
// Node allows a tree of leaf items and groups. Leaf and Group embed Shape with
// `using`, so the same transform helpers can work on either one. Flattening walks
// the Node tree and calls the output callback for each leaf with its final Shape.
//
// Node/Leaf/Group are parametric over the leaf item type. Shape stays separate
// from item payloads, so game-specific item unions do not need transform fields.

Node :: union($T: typeid) {
	Leaf(T),
	Group(T),
}

Shape :: struct {
	x:  f32,
	y:  f32,
	z:  f32,
	a:  f32,
	sx: f32,
	sy: f32,
	o:  f32,
}

Leaf :: struct($T: typeid) {
	using shape: Shape,
	item:        T,
}

Group :: struct($T: typeid) {
	using shape: Shape,
	children:    []Node(T),
}

@(require_results)
leaf :: proc(item: $T) -> Leaf(T) {
	return Leaf(T){shape = Shape{sx = 1, sy = 1, o = 1}, item = item}
}

@(require_results)
group :: proc(children: []Node($T)) -> Group(T) {
	return Group(T){shape = Shape{sx = 1, sy = 1, o = 1}, children = children}
}

@(require_results)
move :: proc(s: $T, x, y: f32) -> T {
	result := s
	result.x += x
	result.y += y
	return result
}

@(require_results)
move_z :: proc(s: $T, z: f32) -> T {
	result := s
	result.z += z
	return result
}

@(require_results)
scale :: proc(s: $T, x, y: f32) -> T {
	result := s
	result.sx *= x
	result.sy *= y
	return result
}

@(require_results)
rotate :: proc(s: $T, angle: f32) -> T {
	result := s
	result.a += angle
	return result
}

@(require_results)
opacity :: proc(s: $T, value: f32) -> T {
	result := s
	result.o *= value
	return result
}

flatten :: proc {
	internal_flatten_node,
	internal_flatten_leaf,
	internal_flatten_group,
}
