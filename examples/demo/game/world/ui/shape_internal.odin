package ui

@(private = "file")
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

internal_flatten_node :: proc(root: Node($Item), user_data: $Data, out: proc(_: Shape, _: Item, _: Data)) {
	flatten_node_with(Shape{sx = 1, sy = 1, o = 1}, root, user_data, out)
}

internal_flatten_leaf :: proc(root: Leaf($Item), user_data: $Data, out: proc(_: Shape, _: Item, _: Data)) {
	out(Shape(root), root.item, user_data)
}

internal_flatten_group :: proc(root: Group($Item), user_data: $Data, out: proc(_: Shape, _: Item, _: Data)) {
	flatten_group_with(Shape{sx = 1, sy = 1, o = 1}, root, user_data, out)
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
