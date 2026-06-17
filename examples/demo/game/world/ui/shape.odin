package ui

// Low-level immediate shape engine.
//
// Shape is only transform/style data. It does not know about sprites,
// nine-patches, text, input, ECS, or rendering.
//
// Node allows a tree of leaf items and groups. Group embeds Shape with `using`, so
// the same transform helpers can work with a Shape or a Group. Flattening walks
// the Node tree and appends leaf items with inherited group transforms applied.
//
// Node/Group are parametric over the leaf type. The leaf type only needs to have
// the Shape fields used by compose, either directly or through an embedded Shape.

Node :: union($T: typeid) {
	T,
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
node :: proc(s: $T) -> Node(T) {
	return s
}

@(require_results)
group :: proc(children: []Node($T)) -> Node(T) {
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


flatten :: proc(root: Node($Item), user_data: $Data, out: proc(_: Item, _: Data)) {
	flatten_with(root, user_data, compose, out)
}

flatten_with :: proc(
	root: Node($Item),
	user_data: $Data,
	compose_item: proc(_: Shape, _: Item) -> Item,
	out: proc(_: Item, _: Data),
) {
	flatten_node(shape(), root, user_data, compose_item, out)
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

@(private = "file")
@(require_results)
compose :: proc(parent: Shape, child: $T) -> T {
	result := child
	composed := compose_shape(parent, Shape(child))
	result.x = composed.x
	result.y = composed.y
	result.z = composed.z
	result.a = composed.a
	result.sx = composed.sx
	result.sy = composed.sy
	result.o = composed.o
	return result
}


@(private = "file")
flatten_node :: proc(
	parent: Shape,
	node: Node($Item),
	user_data: $Data,
	compose_item: proc(_: Shape, _: Item) -> Item,
	out: proc(_: Item, _: Data),
) {
	switch value in node {
	case Item:
		out(compose_item(parent, value), user_data)
	case Group(Item):
		group_shape := compose_shape(parent, Shape(value))
		for child in value.children {
			flatten_node(group_shape, child, user_data, compose_item, out)
		}
	}
}
