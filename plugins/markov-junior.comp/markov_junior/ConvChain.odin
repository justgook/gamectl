package markov_junior

import png "core:image/png"
import "core:fmt"
import "core:math"
import xml "core:encoding/xml"

ConvChain_State :: struct {
	n: int,
	steps: int,
	counter: int,
	temperature: f64,
	weights: []f64,
	c0, c1: u8,
	substrate_color: u8,
	substrate: []bool,
	sample: []bool,
	smx, smy: int,
}

convchain_destroy :: proc(c: ^ConvChain_State) {
	if c.weights != nil do delete(c.weights)
	if c.substrate != nil do delete(c.substrate)
	if c.sample != nil do delete(c.sample)
}

convchain_load :: proc(doc: ^xml.Document, id: xml.Element_ID, g: ^Grid, symmetry: string) -> ConvChain_State {
	c := ConvChain_State{}
	c.n = xml_attr_int(doc, id, "n", 3)
	c.steps = xml_attr_int(doc, id, "steps", -1)
	c.temperature = xml_attr_f64(doc, id, "temperature", 1.0)
	c.c0 = grid_value(g, xml_attr(doc, id, "black")[0])
	c.c1 = grid_value(g, xml_attr(doc, id, "white")[0])
	c.substrate_color = grid_value(g, xml_attr(doc, id, "on")[0])
	c.substrate = make([]bool, len(g.state))

	name := xml_attr(doc, id, "sample")
	path := fmt.tprintf("resources/samples/%s.png", name)
	img, err := png.load(path)
	if err != nil || img == nil do return c
	defer png.destroy(img)
	c.smx = img.width; c.smy = img.height
	c.sample = make([]bool, c.smx * c.smy)
	pix := img.pixels.buf[:]
	channels := img.channels
	for y in 0..<c.smy do for x in 0..<c.smx {
		i := (x + y * c.smx) * channels
		white := false
		if channels >= 3 {
			white = pix[i] == 255 && pix[i + 1] == 255 && pix[i + 2] == 255
		} else if channels == 1 {
			white = pix[i] == 255
		}
		c.sample[x + y * c.smx] = white
	}

	c.weights = make([]f64, 1 << uint(c.n * c.n))
	for y in 0..<c.smy do for x in 0..<c.smx {
		base := convchain_sample_pattern(&c, x, y)
		patterns: [8][]bool
		patterns[0] = base
		patterns[1] = convchain_reflected(patterns[0], c.n)
		patterns[2] = convchain_rotated(patterns[0], c.n)
		patterns[3] = convchain_reflected(patterns[2], c.n)
		patterns[4] = convchain_rotated(patterns[2], c.n)
		patterns[5] = convchain_reflected(patterns[4], c.n)
		patterns[6] = convchain_rotated(patterns[4], c.n)
		patterns[7] = convchain_reflected(patterns[6], c.n)
		for i in 0..<8 {
			if !square_symmetry_enabled(symmetry, i) {
				delete(patterns[i]); patterns[i] = nil; continue
			}
			// C# ConvChain passes a comparison that always returns false to SquareSymmetries,
			// so even identical symmetries contribute separate weights.
			c.weights[convchain_pattern_index(patterns[i])] += 1
		}
		for i in 0..<8 do if patterns[i] != nil do delete(patterns[i])
	}
	for k in 0..<len(c.weights) do if c.weights[k] <= 0 do c.weights[k] = 0.1
	return c
}

convchain_sample_pattern :: proc(c: ^ConvChain_State, x, y: int) -> []bool {
	p := make([]bool, c.n * c.n)
	for dy in 0..<c.n do for dx in 0..<c.n {
		p[dx + dy * c.n] = c.sample[(x + dx) % c.smx + ((y + dy) % c.smy) * c.smx]
	}
	return p
}

convchain_rotated :: proc(p: []bool, n: int) -> []bool {
	q := make([]bool, n * n)
	for y in 0..<n do for x in 0..<n do q[x + y * n] = p[n - 1 - y + x * n]
	return q
}

convchain_reflected :: proc(p: []bool, n: int) -> []bool {
	q := make([]bool, n * n)
	for y in 0..<n do for x in 0..<n do q[x + y * n] = p[n - 1 - x + y * n]
	return q
}

convchain_pattern_same :: proc(a, b: []bool) -> bool {
	if len(a) != len(b) do return false
	for i in 0..<len(a) do if a[i] != b[i] do return false
	return true
}

convchain_pattern_index :: proc(p: []bool) -> int {
	ind := 0
	for i in 0..<len(p) do if p[i] do ind += 1 << uint(i)
	return ind
}

convchain_go :: proc(c: ^ConvChain_State, g: ^Grid, random: ^MJRandom) -> bool {
	if c.steps > 0 && c.counter >= c.steps do return false
	mx := g.mx; my := g.my
	if c.counter == 0 {
		any := false
		for i in 0..<len(c.substrate) do if g.state[i] == c.substrate_color {
			if mj_random_next_max(random, 2) == 0 {
				g.state[i] = c.c0
			} else {
				g.state[i] = c.c1
			}
			c.substrate[i] = true
			any = true
		}
		c.counter += 1
		return any
	}
	for k in 0..<len(g.state) {
		r := int(mj_random_next_max(random, i32(len(g.state))))
		if !c.substrate[r] do continue
		x := r % mx; y := r / mx
		q := 1.0
		for sy := y - c.n + 1; sy <= y + c.n - 1; sy += 1 do for sx := x - c.n + 1; sx <= x + c.n - 1; sx += 1 {
			ind := 0; difference := 0
			for dy in 0..<c.n do for dx in 0..<c.n {
				X := sx + dx
				if X < 0 { X += mx } else if X >= mx { X -= mx }
				Y := sy + dy
				if Y < 0 { Y += my } else if Y >= my { Y -= my }
				value := g.state[X + Y * mx] == c.c1
				power := 1 << uint(dy * c.n + dx)
				if value do ind += power
				if X == x && Y == y {
					if value { difference = power } else { difference = -power }
				}
			}
			q *= c.weights[ind - difference] / c.weights[ind]
		}
		if q >= 1 {
			convchain_toggle(c, g, r); continue
		}
		if c.temperature != 1 do q = math.pow(q, 1.0 / c.temperature)
		if q > mj_random_next_f64(random) do convchain_toggle(c, g, r)
	}
	c.counter += 1
	return true
}

convchain_toggle :: proc(c: ^ConvChain_State, g: ^Grid, i: int) {
	if g.state[i] == c.c0 {
		g.state[i] = c.c1
	} else {
		g.state[i] = c.c0
	}
}
