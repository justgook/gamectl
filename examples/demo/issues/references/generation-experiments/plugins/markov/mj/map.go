package mj

import (
	"fmt"
	"strconv"
	"strings"
)

type MapNode struct {
	Values   string
	Waves    map[byte]string
	Rules    []Rule
	Children []Node
	Done     bool
	NX, NY   int
	NZ       int
	DX, DY   int
	DZ       int
}

func parseMapNode(x xmlNode, parent *Model, opts ParseOptions, folder string) (Node, error) {
	if f := attr(x.Attrs, "folder"); f != "" {
		folder = f
	}
	scale := attr(x.Attrs, "scale")
	if scale == "" {
		return nil, fmt.Errorf("map scale is required")
	}
	parts := strings.Fields(scale)
	if len(parts) != 3 {
		return nil, fmt.Errorf("map scale %q must have 3 components", scale)
	}
	nx, dx, err := parseScalePart(parts[0])
	if err != nil {
		return nil, err
	}
	ny, dy, err := parseScalePart(parts[1])
	if err != nil {
		return nil, err
	}
	nz, dz, err := parseScalePart(parts[2])
	if err != nil {
		return nil, err
	}
	values := strings.ReplaceAll(attr(x.Attrs, "values"), " ", "")
	if values == "" {
		return nil, fmt.Errorf("map values is required")
	}
	m := &MapNode{Values: values, Waves: map[byte]string{}, NX: nx, NY: ny, NZ: nz, DX: dx, DY: dy, DZ: dz}
	for i := 0; i < len(values); i++ {
		m.Waves[values[i]] = string(values[i])
	}
	m.Waves['*'] = values
	collectUnions(x, m.Waves)
	mapModel := &Model{Values: values, Waves: m.Waves}
	for _, child := range x.Nodes {
		switch child.XMLName.Local {
		case "rule":
			r, err := parseRuleAttrs(child.Attrs, opts, folder, false)
			if err != nil {
				return nil, err
			}
			m.Rules = append(m.Rules, r)
		case "union", "observe":
			continue
		default:
			n, err := parseNode(child, mapModel, opts, folder, []bool{true, true, true, true, true, true, true, true})
			if err != nil {
				return nil, err
			}
			m.Children = append(m.Children, n)
		}
	}
	_ = parent
	return m, nil
}

func (m *MapNode) Type() string { return "map" }
func (m *MapNode) Reset() {
	for _, child := range m.Children {
		child.Reset()
	}
}
func (m *MapNode) Features(out map[string]bool) {
	out["map"] = true
	for _, child := range m.Children {
		child.Features(out)
	}
}

func (m *MapNode) Step(g *Grid, rng *RNG) (bool, error) {
	if m.Done {
		return false, nil
	}
	w := g.W * m.NX / m.DX
	h := g.H * m.NY / m.DY
	d := g.D * m.NZ / m.DZ
	newgrid, err := NewGrid3D(w, h, d, m.Values)
	if err != nil {
		return false, err
	}
	for ch, wave := range m.Waves {
		newgrid.Waves[ch] = wave
	}
	for ri := range m.Rules {
		rule := &m.Rules[ri]
		for z := 0; z < g.D; z++ {
			for y := 0; y < g.H; y++ {
				for x := 0; x < g.W; x++ {
					if mapMatch(rule, g, x, y, z) {
						mapApply(rule, newgrid, x*m.NX/m.DX, y*m.NY/m.DY, z*m.NZ/m.DZ)
					}
				}
			}
		}
	}
	for _, child := range m.Children {
		for {
			changed, err := child.Step(newgrid, rng)
			if err != nil {
				return false, err
			}
			if !changed {
				break
			}
		}
	}
	*g = *newgrid
	m.Done = true
	return true, nil
}

func mapMatch(rule *Rule, g *Grid, x, y, z int) bool {
	for pz := 0; pz < rule.In.D; pz++ {
		for py := 0; py < rule.In.H; py++ {
			for px := 0; px < rule.In.W; px++ {
				sx := wrap(x+px, g.W)
				sy := wrap(y+py, g.H)
				sz := wrap(z+pz, g.D)
				want := rule.In.Data[px+py*rule.In.W+pz*rule.In.W*rule.In.H]
				if want == '*' {
					continue
				}
				actual := g.Values[g.State[sx+sy*g.W+sz*g.W*g.H]]
				wave, ok := g.Waves[want]
				if !ok || !strings.ContainsRune(wave, rune(actual)) {
					return false
				}
			}
		}
	}
	return true
}

func mapApply(rule *Rule, g *Grid, x, y, z int) {
	for pz := 0; pz < rule.Out.D; pz++ {
		for py := 0; py < rule.Out.H; py++ {
			for px := 0; px < rule.Out.W; px++ {
				sx := wrap(x+px, g.W)
				sy := wrap(y+py, g.H)
				sz := wrap(z+pz, g.D)
				ch := rule.Out.Data[px+py*rule.Out.W+pz*rule.Out.W*rule.Out.H]
				if ch == '*' {
					continue
				}
				if v, ok := g.Index[ch]; ok {
					g.State[sx+sy*g.W+sz*g.W*g.H] = v
				}
			}
		}
	}
}

func parseScalePart(s string) (int, int, error) {
	if !strings.Contains(s, "/") {
		v, err := strconv.Atoi(s)
		return v, 1, err
	}
	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("invalid scale component %q", s)
	}
	n, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, err
	}
	d, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, err
	}
	return n, d, nil
}
