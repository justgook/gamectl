package ui

// Low-level immediate shape engine.
//
// Shape is only transform/style data. It does not know about sprites,
// nine-patches, text, input, ECS, or rendering.
//
// Node allows a tree of shapes and groups. Group embeds Shape with `using`, so
// the same transform helpers can work with a Shape or a Group. Flattening walks
// the Node tree and appends plain Shapes with inherited group transforms applied.

Node :: union {
	Shape,
	Group,
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

Group :: struct {
	using shape: Shape,
	children:    []Node,
}

@(private = "file")
@(require_results)
shape :: proc() -> Shape {
	return Shape{sx = 1, sy = 1, o = 1}
}

@(require_results)
node :: proc(s: Shape) -> Node {
	return s
}

@(require_results)
group :: proc(children: []Node) -> Node {
	return Group{shape = shape(), children = children}
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


flatten :: proc(root: Node, user_data: $T, out: proc(_: Shape, _: T)) {
	flatten_node(shape(), root, user_data, out)
}


@(private = "file")
@(require_results)
compose :: proc(parent, child: Shape) -> Shape {
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
flatten_node :: proc(parent: Shape, node: Node, user_data: $T, out: proc(_: Shape, _: T)) {
	switch value in node {
	case Shape:
		out(compose(parent, value), user_data)
	case Group:
		group_shape := compose(parent, Shape(value))
		for child in value.children {
			flatten_node(group_shape, child, user_data, out)
		}
	}
}
