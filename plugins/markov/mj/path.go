package mj

import "fmt"

type PathNode struct {
	Start    string
	Finish   string
	On       string
	Color    byte
	Inertia  bool
	Longest  bool
	Edges    bool
	Vertices bool
}

type point struct{ x, y int }

func parsePathNode(x xmlNode, model *Model) (Node, error) {
	from := attr(x.Attrs, "from")
	to := attr(x.Attrs, "to")
	on := attr(x.Attrs, "on")
	if from == "" || to == "" || on == "" {
		return nil, fmt.Errorf("path requires from, to, and on attributes")
	}
	colorValue := attr(x.Attrs, "color")
	color := from[0]
	if colorValue != "" {
		color = colorValue[0]
	}
	if !containsByte(model.Values, color) {
		return nil, fmt.Errorf("path color %q is not in values", color)
	}
	return &PathNode{
		Start:    expandWaveString(model.Waves, from),
		Finish:   expandWaveString(model.Waves, to),
		On:       expandWaveString(model.Waves, on),
		Color:    color,
		Inertia:  boolAttr(x.Attrs, "inertia", false),
		Longest:  boolAttr(x.Attrs, "longest", false),
		Edges:    boolAttr(x.Attrs, "edges", false),
		Vertices: boolAttr(x.Attrs, "vertices", false),
	}, nil
}

func (p *PathNode) Type() string { return "path" }
func (p *PathNode) Features(out map[string]bool) {
	out["path"] = true
}

func (p *PathNode) Step(g *Grid, rng *RNG) (bool, error) {
	if g.D != 1 {
		return false, fmt.Errorf("3D path is not implemented yet")
	}
	frontier := make([]point, 0)
	starts := make([]point, 0)
	generations := make([]int, len(g.State))
	for i := range generations {
		generations[i] = -1
	}
	for y := 0; y < g.H; y++ {
		for x := 0; x < g.W; x++ {
			idx := x + y*g.W
			ch := g.Values[g.State[idx]]
			if containsByteString(p.Start, ch) {
				starts = append(starts, point{x: x, y: y})
			}
			if containsByteString(p.Finish, ch) {
				generations[idx] = 0
				frontier = append(frontier, point{x: x, y: y})
			}
		}
	}
	if len(starts) == 0 || len(frontier) == 0 {
		return false, nil
	}
	for head := 0; head < len(frontier); head++ {
		cur := frontier[head]
		t := generations[cur.x+cur.y*g.W] + 1
		for _, d := range pathDirections(cur.x, cur.y, g.W, g.H, p.Edges) {
			nx, ny := cur.x+d.x, cur.y+d.y
			idx := nx + ny*g.W
			if generations[idx] != -1 {
				continue
			}
			ch := g.Values[g.State[idx]]
			if containsByteString(p.On, ch) || containsByteString(p.Start, ch) {
				generations[idx] = t
				if containsByteString(p.On, ch) {
					frontier = append(frontier, point{x: nx, y: ny})
				}
			}
		}
	}
	chosen := point{x: -1, y: -1}
	best := -1.0
	if !p.Longest {
		best = float64(g.W*g.H + 1)
	}
	for _, s := range starts {
		gen := generations[s.x+s.y*g.W]
		if gen <= 0 {
			continue
		}
		score := float64(gen) + 0.1*rng.Float64()
		if (p.Longest && score > best) || (!p.Longest && score < best) {
			best = score
			chosen = s
		}
	}
	if chosen.x < 0 {
		return false, nil
	}
	dir := p.direction(g, chosen, point{}, generations, rng)
	pen := point{x: chosen.x + dir.x, y: chosen.y + dir.y}
	colorIndex := g.Index[p.Color]
	changed := false
	for generations[pen.x+pen.y*g.W] != 0 {
		g.State[pen.x+pen.y*g.W] = colorIndex
		changed = true
		dir = p.direction(g, pen, dir, generations, rng)
		pen = point{x: pen.x + dir.x, y: pen.y + dir.y}
	}
	return changed, nil
}

func (p *PathNode) direction(g *Grid, at, prior point, generations []int, rng *RNG) point {
	gen := generations[at.x+at.y*g.W]
	if p.Inertia && (prior.x != 0 || prior.y != 0) {
		nx, ny := at.x+prior.x, at.y+prior.y
		if nx >= 0 && ny >= 0 && nx < g.W && ny < g.H && generations[nx+ny*g.W] == gen-1 {
			return prior
		}
	}
	candidates := make([]point, 0)
	for _, d := range pathDirections(at.x, at.y, g.W, g.H, p.Edges) {
		if generations[at.x+d.x+(at.y+d.y)*g.W] == gen-1 {
			candidates = append(candidates, d)
		}
	}
	if len(candidates) == 0 {
		return point{}
	}
	return candidates[rng.Intn(len(candidates))]
}

func pathDirections(x, y, w, h int, edges bool) []point {
	out := make([]point, 0, 8)
	if x > 0 {
		out = append(out, point{x: -1})
	}
	if x < w-1 {
		out = append(out, point{x: 1})
	}
	if y > 0 {
		out = append(out, point{y: -1})
	}
	if y < h-1 {
		out = append(out, point{y: 1})
	}
	if edges {
		if x > 0 && y > 0 {
			out = append(out, point{x: -1, y: -1})
		}
		if x > 0 && y < h-1 {
			out = append(out, point{x: -1, y: 1})
		}
		if x < w-1 && y > 0 {
			out = append(out, point{x: 1, y: -1})
		}
		if x < w-1 && y < h-1 {
			out = append(out, point{x: 1, y: 1})
		}
	}
	return out
}

func expandWaveString(waves map[byte]string, symbols string) string {
	out := ""
	for i := 0; i < len(symbols); i++ {
		if wave, ok := waves[symbols[i]]; ok {
			out += wave
		} else {
			out += string(symbols[i])
		}
	}
	return out
}

func containsByte(values string, ch byte) bool { return containsByteString(values, ch) }
func containsByteString(values string, ch byte) bool {
	for i := 0; i < len(values); i++ {
		if values[i] == ch {
			return true
		}
	}
	return false
}
