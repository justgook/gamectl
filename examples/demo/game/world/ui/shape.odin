package ui

// Low-level immediate shape engine.
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

@(private = "file")
@(require_results)
shape :: proc() -> Shape {
	return Shape{sx = 1, sy = 1, o = 1}
}


@(require_results)
leaf :: proc(item: $T) -> Leaf(T) {
	return Leaf(T){shape = shape(), item = item}
}

@(require_results)
group :: proc(children: []Node($T)) -> Group(T) {
	return Group(T){shape = shape(), children = children}
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
	flatten_node,
	flatten_leaf,
	flatten_group,
}


@(require_results)
compose_shape :: proc(parent, child: Shape) -> Shape {
	return Shape {
		x = parent.x + child.x * parent.sx,
		y = parent.y + child.y * parent.sy,
		z = parent.z + child.z,
		a = parent.a + child.a,
		sx = parent.sx * child.sx,
		sy = parent.sy * child.sy,
		o = parent.o * child.o,
	}
}

@(require_results)
compose :: proc(parent: Shape, child: $T) -> Shape {
	return compose_shape(parent, Shape(child))
}

@(private = "file")
flatten_node :: proc(root: Node($Item), user_data: $Data, out: proc(_: Shape, _: Item, _: Data)) {
	flatten_node_with(shape(), root, user_data, out)
}

@(private = "file")
flatten_leaf :: proc(root: Leaf($Item), user_data: $Data, out: proc(_: Shape, _: Item, _: Data)) {
	out(Shape(root), root.item, user_data)
}

@(private = "file")
flatten_group :: proc(root: Group($Item), user_data: $Data, out: proc(_: Shape, _: Item, _: Data)) {
	flatten_group_with(shape(), root, user_data, out)
}

@(private = "file")
flatten_node_with :: proc(parent: Shape, node: Node($Item), user_data: $Data, out: proc(_: Shape, _: Item, _: Data)) {
	switch value in node {
	case Leaf(Item):
		out(compose_shape(parent, Shape(value)), value.item, user_data)
	case Group(Item):
		flatten_group_with(parent, value, user_data, out)
	}
}

@(private = "file")
flatten_group_with :: proc(
	parent: Shape,
	group: Group($Item),
	user_data: $Data,
	out: proc(_: Shape, _: Item, _: Data),
) {
	group_shape := compose_shape(parent, Shape(group))
	for child in group.children {
		flatten_node_with(group_shape, child, user_data, out)
	}
}
