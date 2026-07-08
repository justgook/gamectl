package grid

Grid :: struct {
	cell_size:     int,
	width, height: int,
	min_x, min_y:  int,
	cells:         [][][dynamic]^[4]int, // each cell has a dynamic array of segment pointers
}

// Adds segment to all cells it intersects
add_segment :: proc(grid: ^Grid, segment: ^[4]int) {
	cells := get_intersecting_cells(grid, segment)
	defer delete(cells)

	for cell in cells {
		append(&grid.cells[cell.y][cell.x], segment)
	}
}

// Takes a segment and returns all objects from cells that segment intersects
@(require_results)
query_segment :: proc(grid: ^Grid, segment: ^[4]int) -> [dynamic]^[4]int {
	// Get intersecting cells
	cells := get_intersecting_cells(grid, segment)
	defer delete(cells)

	// Use map to track unique objects
	seen := make(map[^[4]int]bool)
	defer delete(seen)

	// Result array
	result := make([dynamic]^[4]int)

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

// Determines which cells a line segment intersects
get_intersecting_cells :: proc(grid: ^Grid, segment: ^[4]int) -> [dynamic][2]int {
	// Initialize result array
	result := make([dynamic][2]int)

	// Convert from world to grid coordinates
	x1 := (segment[0] - grid.min_x) / grid.cell_size
	y1 := (segment[1] - grid.min_y) / grid.cell_size
	x2 := (segment[2] - grid.min_x) / grid.cell_size
	y2 := (segment[3] - grid.min_y) / grid.cell_size

	// Calculate delta and step values
	dx := abs(x2 - x1)
	dy := abs(y2 - y1)

	step_x := 1 if x1 < x2 else -1
	step_y := 1 if y1 < y2 else -1

	// Current cell coordinates
	x := x1
	y := y1

	// Add starting cell
	append(&result, [2]int{x, y})

	// If perfectly horizontal or vertical, handle separately
	if dx == 0 {
		// Vertical line
		for y != y2 {
			y += step_y
			if y >= 0 && y < grid.height {
				append(&result, [2]int{x, y})
			}
		}
		return result
	}

	if dy == 0 {
		// Horizontal line
		for x != x2 {
			x += step_x
			if x >= 0 && x < grid.width {
				append(&result, [2]int{x, y})
			}
		}
		return result
	}

	// General case using DDA
	error := f32(0.0)
	delta_error := f32(dy) / f32(dx)

	if dx >= dy {
		// X-major line
		for x != x2 {
			error += delta_error
			if error >= 0.5 {
				y += step_y
				error -= 1.0
			}
			x += step_x

			if x >= 0 && x < grid.width && y >= 0 && y < grid.height {
				append(&result, [2]int{x, y})
			}
		}
	} else {
		// Y-major line
		delta_error = f32(dx) / f32(dy)
		for y != y2 {
			error += delta_error
			if error >= 0.5 {
				x += step_x
				error -= 1.0
			}
			y += step_y

			if x >= 0 && x < grid.width && y >= 0 && y < grid.height {
				append(&result, [2]int{x, y})
			}
		}
	}

	return result
}
// Takes an AABB defined by [min_x, min_y, max_x, max_y] and returns all segments that could intersect it
@(require_results)
query_aabb :: proc(grid: ^Grid, aabb: ^[4]int) -> [dynamic]^[4]int {
	min_x, min_y, max_x, max_y := aabb[0], aabb[1], aabb[2], aabb[3]

	// Ensure min is less than max
	if min_x > max_x {
		min_x, max_x = max_x, min_x
	}
	if min_y > max_y {
		min_y, max_y = max_y, min_y
	}

	// Convert world coordinates to grid coordinates
	grid_min_x := (min_x - grid.min_x) / grid.cell_size
	grid_min_y := (min_y - grid.min_y) / grid.cell_size
	grid_max_x := (max_x - grid.min_x) / grid.cell_size
	grid_max_y := (max_y - grid.min_y) / grid.cell_size

	// Check if AABB is completely outside the grid
	if grid_max_x < 0 || grid_min_x >= grid.width || grid_max_y < 0 || grid_min_y >= grid.height {
		return make([dynamic]^[4]int) // Return empty array if outside grid
	}

	// Clamp to grid bounds
	grid_min_x = clamp(grid_min_x, 0, grid.width - 1)
	grid_min_y = clamp(grid_min_y, 0, grid.height - 1)
	grid_max_x = clamp(grid_max_x, 0, grid.width - 1)
	grid_max_y = clamp(grid_max_y, 0, grid.height - 1)

	// Track unique segments
	seen := make(map[^[4]int]bool)
	defer delete(seen)

	// Result array
	result := make([dynamic]^[4]int)

	// Iterate through all cells in the AABB
	for y := grid_min_y; y <= grid_max_y; y += 1 {
		for x := grid_min_x; x <= grid_max_x; x += 1 {
			// Add all segments from this cell
			for segment in grid.cells[y][x] {
				if segment in seen {
					continue
				}
				seen[segment] = true
				append(&result, segment)
			}
		}
	}

	return result
}
// Creates new grid with given bounds and cell size
@(require_results)
create_grid :: proc(#any_int min_x, #any_int min_y, #any_int max_x, #any_int max_y, #any_int cell_size: int) -> Grid {
	width := ((max_x - min_x) / cell_size) + 1
	height := ((max_y - min_y) / cell_size) + 1

	grid := Grid {
		cell_size = cell_size,
		width     = width,
		height    = height,
		min_x     = min_x,
		min_y     = min_y,
		cells     = make([][][dynamic]^[4]int, height),
	}

	// Initialize each row and its cells with empty dynamic arrays
	for y := 0; y < height; y += 1 {
		grid.cells[y] = make([][dynamic]^[4]int, width)
		for x := 0; x < width; x += 1 {
			grid.cells[y][x] = make([dynamic]^[4]int, 0)
		}
	}

	return grid
}

destroy_grid :: proc(grid: ^Grid) {
	for y := 0; y < grid.height; y += 1 {
		for x := 0; x < grid.width; x += 1 {
			delete(grid.cells[y][x]) // Delete each cell's segment array
		}
		delete(grid.cells[y]) // Delete each row
	}
	delete(grid.cells) // Delete the main array
}
