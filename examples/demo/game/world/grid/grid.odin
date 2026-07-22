package grid

import "../shape"

Grid :: struct {
	cell_size:     i32,
	width, height: int,
	min_x, min_y:  i32,
	cells:         [][][dynamic]^shape.Segment,
}

add_segment :: proc(grid: ^Grid, segment: ^shape.Segment) {
	cells := get_intersecting_cells(grid, segment)
	defer delete(cells)
	for cell in cells {
		append(&grid.cells[cell.y][cell.x], segment)
	}
}

@(require_results)
query_segment :: proc(grid: ^Grid, segment: ^shape.Segment) -> [dynamic]^shape.Segment {
	cells := get_intersecting_cells(grid, segment)
	defer delete(cells)
	seen := make(map[^shape.Segment]bool)
	defer delete(seen)
	result := make([dynamic]^shape.Segment)

	for cell in cells {
		if cell.x < 0 || cell.x >= grid.width || cell.y < 0 || cell.y >= grid.height {
			continue
		}
		for obj in grid.cells[cell.y][cell.x] {
			if obj in seen {
				continue
			}
			seen[obj] = true
			append(&result, obj)
		}
	}
	return result
}

// Returns array-index coordinates for the cells intersected by a world-space segment.
get_intersecting_cells :: proc(grid: ^Grid, segment: ^shape.Segment) -> [dynamic][2]int {
	result := make([dynamic][2]int)
	x1 := int((i64(segment[0]) - i64(grid.min_x)) / i64(grid.cell_size))
	y1 := int((i64(segment[1]) - i64(grid.min_y)) / i64(grid.cell_size))
	x2 := int((i64(segment[2]) - i64(grid.min_x)) / i64(grid.cell_size))
	y2 := int((i64(segment[3]) - i64(grid.min_y)) / i64(grid.cell_size))
	dx := abs(x2 - x1)
	dy := abs(y2 - y1)
	step_x := 1 if x1 < x2 else -1
	step_y := 1 if y1 < y2 else -1
	x, y := x1, y1
	append(&result, [2]int{x, y})

	if dx == 0 {
		for y != y2 {
			y += step_y
			if y >= 0 && y < grid.height {
				append(&result, [2]int{x, y})
			}
		}
		return result
	}
	if dy == 0 {
		for x != x2 {
			x += step_x
			if x >= 0 && x < grid.width {
				append(&result, [2]int{x, y})
			}
		}
		return result
	}

	error := f32(0)
	delta_error := f32(dy) / f32(dx)
	if dx >= dy {
		for x != x2 {
			error += delta_error
			if error >= 0.5 {
				y += step_y
				error -= 1
			}
			x += step_x
			if x >= 0 && x < grid.width && y >= 0 && y < grid.height {
				append(&result, [2]int{x, y})
			}
		}
	} else {
		delta_error = f32(dx) / f32(dy)
		for y != y2 {
			error += delta_error
			if error >= 0.5 {
				x += step_x
				error -= 1
			}
			y += step_y
			if x >= 0 && x < grid.width && y >= 0 && y < grid.height {
				append(&result, [2]int{x, y})
			}
		}
	}
	return result
}

@(require_results)
query_aabb :: proc(grid: ^Grid, aabb: ^shape.Aabb) -> [dynamic]^shape.Segment {
	min_x, min_y, max_x, max_y := aabb[0], aabb[1], aabb[2], aabb[3]
	if min_x > max_x {min_x, max_x = max_x, min_x}
	if min_y > max_y {min_y, max_y = max_y, min_y}

	grid_min_x := int((i64(min_x) - i64(grid.min_x)) / i64(grid.cell_size))
	grid_min_y := int((i64(min_y) - i64(grid.min_y)) / i64(grid.cell_size))
	grid_max_x := int((i64(max_x) - i64(grid.min_x)) / i64(grid.cell_size))
	grid_max_y := int((i64(max_y) - i64(grid.min_y)) / i64(grid.cell_size))
	if grid_max_x < 0 || grid_min_x >= grid.width || grid_max_y < 0 || grid_min_y >= grid.height {
		return make([dynamic]^shape.Segment)
	}

	grid_min_x = clamp(grid_min_x, 0, grid.width - 1)
	grid_min_y = clamp(grid_min_y, 0, grid.height - 1)
	grid_max_x = clamp(grid_max_x, 0, grid.width - 1)
	grid_max_y = clamp(grid_max_y, 0, grid.height - 1)
	seen := make(map[^shape.Segment]bool)
	defer delete(seen)
	result := make([dynamic]^shape.Segment)
	for y := grid_min_y; y <= grid_max_y; y += 1 {
		for x := grid_min_x; x <= grid_max_x; x += 1 {
			for segment in grid.cells[y][x] {
				if segment in seen {continue}
				seen[segment] = true
				append(&result, segment)
			}
		}
	}
	return result
}

@(require_results)
create_grid :: proc(
	#any_int min_x, min_y, max_x, max_y, cell_size: i32,
) -> Grid {
	assert(cell_size > 0)
	width := int((i64(max_x) - i64(min_x)) / i64(cell_size)) + 1
	height := int((i64(max_y) - i64(min_y)) / i64(cell_size)) + 1
	assert(width > 0 && height > 0)
	grid := Grid {
		cell_size = cell_size,
		width = width,
		height = height,
		min_x = min_x,
		min_y = min_y,
		cells = make([][][dynamic]^shape.Segment, height),
	}
	for y := 0; y < height; y += 1 {
		grid.cells[y] = make([][dynamic]^shape.Segment, width)
		for x := 0; x < width; x += 1 {
			grid.cells[y][x] = make([dynamic]^shape.Segment, 0)
		}
	}
	return grid
}

destroy_grid :: proc(grid: ^Grid) {
	for y := 0; y < grid.height; y += 1 {
		for x := 0; x < grid.width; x += 1 {
			delete(grid.cells[y][x])
		}
		delete(grid.cells[y])
	}
	delete(grid.cells)
}
