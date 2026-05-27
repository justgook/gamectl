package markov_junior

import xml "core:encoding/xml"
import "core:strings"
import "core:strconv"

Scale_Pair :: struct {n, d: int}

Map_State :: struct {
	grid: Grid,
	rules: [dynamic]Rule,
	nx, ny, nz, dx, dy, dz: int,
	mapped: bool,
}

map_destroy :: proc(m: ^Map_State) {
	for i in 0..<len(m.rules) do rule_destroy(&m.rules[i])
	if m.rules != nil do delete(m.rules)
	grid_destroy(&m.grid)
}

map_read_scale :: proc(s: string) -> Scale_Pair {
	if strings.contains(s, "/") {
		parts := strings.split(s, "/")
		defer delete(parts)
		n, _ := strconv.parse_int(parts[0])
		d, _ := strconv.parse_int(parts[1])
		return Scale_Pair{int(n), int(d)}
	}
	n, _ := strconv.parse_int(s)
	return Scale_Pair{int(n), 1}
}

map_load :: proc(doc: ^xml.Document, id: xml.Element_ID, gin: ^Grid, parent_symmetry: string) -> Map_State {
	m := Map_State{}
	scales := strings.split(xml_attr(doc, id, "scale"), " ")
	defer delete(scales)
	sx := map_read_scale(scales[0]); sy := map_read_scale(scales[1]); sz := map_read_scale(scales[2])
	m.nx = sx.n; m.dx = sx.d; m.ny = sy.n; m.dy = sy.d; m.nz = sz.n; m.dz = sz.d
	m.grid = grid_init(gin.mx * m.nx / m.dx, gin.my * m.ny / m.dy, gin.mz * m.nz / m.dz, xml_attr(doc, id, "values"), false)
	m.grid.folder = xml_attr(doc, id, "folder", gin.folder)
	load_unions(doc, id, &m.grid)

	symmetry := xml_attr(doc, id, "symmetry", parent_symmetry)
	for value in doc.elements[id].value {
		#partial switch child_id in value {
		case xml.Element_ID:
			if doc.elements[child_id].ident == "rule" {
				append_rule_symmetries(&m.grid, &m.rules, rule_init_mixed_grids(gin, &m.grid, xml_attr(doc, child_id, "in", ""), xml_attr(doc, child_id, "out", ""), xml_attr(doc, child_id, "fin", ""), xml_attr(doc, child_id, "fout", ""), xml_attr(doc, child_id, "file", ""), xml_attr(doc, child_id, "legend", ""), xml_attr_f64(doc, child_id, "p", 1.0)), xml_attr(doc, child_id, "symmetry", symmetry))
			}
		}
	}
	return m
}

map_matches :: proc(rule: ^Rule, x, y, z: int, state: []u8, mx, my, mz: int) -> bool {
	for dz in 0..<rule.imz do for dy in 0..<rule.imy do for dx in 0..<rule.imx {
		sx := x + dx; sy := y + dy; sz := z + dz
		for sx >= mx do sx -= mx
		for sy >= my do sy -= my
		for sz >= mz do sz -= mz
		wave := rule.input[dx + dy * rule.imx + dz * rule.imx * rule.imy]
		if (wave & (i32(1) << uint(state[sx + sy * mx + sz * mx * my]))) == 0 do return false
	}
	return true
}

map_apply :: proc(rule: ^Rule, x, y, z: int, state: []u8, mx, my, mz: int) {
	for dz in 0..<rule.omz do for dy in 0..<rule.omy do for dx in 0..<rule.omx {
		sx := x + dx; sy := y + dy; sz := z + dz
		for sx >= mx do sx -= mx
		for sy >= my do sy -= my
		for sz >= mz do sz -= mz
		out := rule.output[dx + dy * rule.omx + dz * rule.omx * rule.omy]
		if out != 0xff do state[sx + sy * mx + sz * mx * my] = out
	}
}

map_go_initial :: proc(m: ^Map_State, g: ^Grid) {
	for i in 0..<len(m.grid.state) do m.grid.state[i] = 0
	for r in 0..<len(m.rules) {
		rule := &m.rules[r]
		for z in 0..<g.mz do for y in 0..<g.my do for x in 0..<g.mx {
			if map_matches(rule, x, y, z, g.state, g.mx, g.my, g.mz) {
				map_apply(rule, x * m.nx / m.dx, y * m.ny / m.dy, z * m.nz / m.dz, m.grid.state, m.grid.mx, m.grid.my, m.grid.mz)
			}
		}
	}

	old := g^
	g^ = m.grid
	m.grid = old
	m.mapped = true
}
