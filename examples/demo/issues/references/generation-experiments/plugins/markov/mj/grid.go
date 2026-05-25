package mj

import (
	"fmt"
	"strings"
)

type Grid struct {
	W, H, D int
	Values  string
	Index   map[byte]byte
	Waves   map[byte]string
	State   []byte
}

type Rule struct {
	In, Out Pattern
	P       float64
}

type Pattern struct {
	W, H, D int
	Data    []byte
}

type Match struct {
	Rule    *Rule
	X, Y, Z int
}

func NewGrid(w, h int, values string) (*Grid, error) { return NewGrid3D(w, h, 1, values) }
func NewGrid3D(w, h, d int, values string) (*Grid, error) {
	if w <= 0 || h <= 0 || d <= 0 {
		return nil, fmt.Errorf("grid dimensions must be positive")
	}
	if values == "" {
		return nil, fmt.Errorf("values must be non-empty")
	}
	idx := make(map[byte]byte, len(values))
	for i := 0; i < len(values); i++ {
		ch := values[i]
		if _, ok := idx[ch]; ok {
			return nil, fmt.Errorf("duplicate value %q", ch)
		}
		idx[ch] = byte(i)
	}
	waves := make(map[byte]string, len(idx)+1)
	for ch := range idx {
		waves[ch] = string(ch)
	}
	waves['*'] = values
	return &Grid{W: w, H: h, D: d, Values: values, Index: idx, Waves: waves, State: make([]byte, w*h*d)}, nil
}

func (g *Grid) SetOrigin() {
	if len(g.Values) < 2 {
		return
	}
	g.State[g.W/2+(g.H/2)*g.W+(g.D/2)*g.W*g.H] = 1
}

func (g *Grid) DecodeRows() string {
	slices := make([]string, g.D)
	for z := 0; z < g.D; z++ {
		rows := make([]string, g.H)
		for y := 0; y < g.H; y++ {
			b := make([]byte, g.W)
			for x := 0; x < g.W; x++ {
				b[x] = g.Values[g.State[x+y*g.W+z*g.W*g.H]]
			}
			rows[y] = string(b)
		}
		slices[g.D-1-z] = strings.Join(rows, "/")
	}
	return strings.Join(slices, " ")
}

func (g *Grid) EncodeRows(rows string) error {
	p, err := ParsePattern(rows)
	if err != nil {
		return err
	}
	if p.W != g.W || p.H != g.H || p.D != g.D {
		return fmt.Errorf("initial cells dimensions %dx%dx%d do not match grid %dx%dx%d", p.W, p.H, p.D, g.W, g.H, g.D)
	}
	for i, ch := range p.Data {
		v, ok := g.Index[ch]
		if !ok {
			return fmt.Errorf("initial cells contain value %q not in %q", ch, g.Values)
		}
		g.State[i] = v
	}
	return nil
}

func ParsePattern(s string) (Pattern, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return Pattern{}, fmt.Errorf("pattern is empty")
	}
	sliceStrings := strings.Split(s, " ")
	firstRows := strings.Split(sliceStrings[0], "/")
	w := len(firstRows[0])
	h := len(firstRows)
	if w == 0 || h == 0 {
		return Pattern{}, fmt.Errorf("pattern has empty first row")
	}
	data := make([]byte, w*h*len(sliceStrings))
	for sz, slice := range sliceStrings {
		rows := strings.Split(slice, "/")
		if len(rows) != h {
			return Pattern{}, fmt.Errorf("ragged pattern %q", s)
		}
		z := len(sliceStrings) - 1 - sz
		for y, row := range rows {
			if len(row) != w {
				return Pattern{}, fmt.Errorf("ragged pattern %q", s)
			}
			copy(data[y*w+z*w*h:y*w+z*w*h+w], []byte(row))
		}
	}
	return Pattern{W: w, H: h, D: len(sliceStrings), Data: data}, nil
}

func ParseRule(in, out string) (Rule, error) {
	pin, err := ParsePattern(in)
	if err != nil {
		return Rule{}, fmt.Errorf("invalid rule input: %w", err)
	}
	pout, err := ParsePattern(out)
	if err != nil {
		return Rule{}, fmt.Errorf("invalid rule output: %w", err)
	}
	return NewRule(pin, pout)
}

func NewRule(pin, pout Pattern) (Rule, error) {
	if pin.W != pout.W || pin.H != pout.H || pin.D != pout.D {
		return Rule{}, fmt.Errorf("rule input/output dimensions differ")
	}
	return NewRuleAny(pin, pout), nil
}

func NewRuleAny(pin, pout Pattern) Rule {
	return Rule{In: pin, Out: pout, P: 1}
}

func (p Pattern) ZRotated() Pattern {
	out := Pattern{W: p.H, H: p.W, D: p.D, Data: make([]byte, len(p.Data))}
	for z := 0; z < p.D; z++ {
		for y := 0; y < p.H; y++ {
			for x := 0; x < p.W; x++ {
				nx := p.H - 1 - y
				ny := x
				out.Data[nx+ny*out.W+z*out.W*out.H] = p.Data[x+y*p.W+z*p.W*p.H]
			}
		}
	}
	return out
}

func (p Pattern) Reflected() Pattern {
	out := Pattern{W: p.W, H: p.H, D: p.D, Data: make([]byte, len(p.Data))}
	for z := 0; z < p.D; z++ {
		for y := 0; y < p.H; y++ {
			for x := 0; x < p.W; x++ {
				nx := p.W - 1 - x
				out.Data[nx+y*out.W+z*out.W*out.H] = p.Data[x+y*p.W+z*p.W*p.H]
			}
		}
	}
	return out
}

func (r Rule) ZRotated() Rule {
	return Rule{In: r.In.ZRotated(), Out: r.Out.ZRotated(), P: r.P}
}

func (r Rule) Reflected() Rule {
	return Rule{In: r.In.Reflected(), Out: r.Out.Reflected(), P: r.P}
}

func (r Rule) Same(other Rule) bool {
	return r.P == other.P && r.In.W == other.In.W && r.In.H == other.In.H && r.In.D == other.In.D && r.Out.W == other.Out.W && r.Out.H == other.Out.H && r.Out.D == other.Out.D && string(r.In.Data) == string(other.In.Data) && string(r.Out.Data) == string(other.Out.Data)
}

func (r Rule) SquareSymmetries(symmetry []bool) []Rule {
	variants := make([]Rule, 8)
	variants[0] = r
	variants[1] = variants[0].Reflected()
	variants[2] = variants[0].ZRotated()
	variants[3] = variants[2].Reflected()
	variants[4] = variants[2].ZRotated()
	variants[5] = variants[4].Reflected()
	variants[6] = variants[4].ZRotated()
	variants[7] = variants[6].Reflected()
	out := []Rule{}
	for i, rule := range variants {
		if symmetry != nil && (i >= len(symmetry) || !symmetry[i]) {
			continue
		}
		seen := false
		for _, existing := range out {
			if existing.Same(rule) {
				seen = true
				break
			}
		}
		if !seen {
			out = append(out, rule)
		}
	}
	return out
}

func SplitGluedRule(rect Pattern) (Rule, error) {
	if rect.W%2 != 0 {
		return Rule{}, fmt.Errorf("odd width %d in glued rule", rect.W)
	}
	half := rect.W / 2
	pin := Pattern{W: half, H: rect.H, D: rect.D, Data: make([]byte, half*rect.H*rect.D)}
	pout := Pattern{W: half, H: rect.H, D: rect.D, Data: make([]byte, half*rect.H*rect.D)}
	for z := 0; z < rect.D; z++ {
		for y := 0; y < rect.H; y++ {
			copy(pin.Data[y*half+z*half*rect.H:y*half+z*half*rect.H+half], rect.Data[y*rect.W+z*rect.W*rect.H:y*rect.W+z*rect.W*rect.H+half])
			copy(pout.Data[y*half+z*half*rect.H:y*half+z*half*rect.H+half], rect.Data[y*rect.W+z*rect.W*rect.H+half:y*rect.W+z*rect.W*rect.H+rect.W])
		}
	}
	return NewRule(pin, pout)
}

func (g *Grid) Matches(r *Rule) []Match {
	var out []Match
	if r.P <= 0 {
		return out
	}
	for z := 0; z <= g.D-r.In.D; z++ {
		for y := 0; y <= g.H-r.In.H; y++ {
			for x := 0; x <= g.W-r.In.W; x++ {
				if g.MatchAt(r, x, y, z) {
					out = append(out, Match{Rule: r, X: x, Y: y, Z: z})
				}
			}
		}
	}
	return out
}

func (g *Grid) MatchAt(r *Rule, x, y int, zOpt ...int) bool {
	z := 0
	if len(zOpt) > 0 {
		z = zOpt[0]
	}
	for pz := 0; pz < r.In.D; pz++ {
		for py := 0; py < r.In.H; py++ {
			for px := 0; px < r.In.W; px++ {
				want := r.In.Data[px+py*r.In.W+pz*r.In.W*r.In.H]
				if want == '*' {
					continue
				}
				actual := g.Values[g.State[x+px+(y+py)*g.W+(z+pz)*g.W*g.H]]
				wave, ok := g.Waves[want]
				if !ok {
					return false
				}
				if !strings.ContainsRune(wave, rune(actual)) {
					return false
				}
			}
		}
	}
	return true
}

func (g *Grid) Apply(m Match) bool {
	return applyToState(m, g, g.State)
}

func applyToState(m Match, g *Grid, state []byte) bool {
	r := m.Rule
	changed := false
	for pz := 0; pz < r.Out.D; pz++ {
		for py := 0; py < r.Out.H; py++ {
			for px := 0; px < r.Out.W; px++ {
				ch := r.Out.Data[px+py*r.Out.W+pz*r.Out.W*r.Out.H]
				if ch == '*' {
					continue
				}
				if v, ok := g.Index[ch]; ok {
					i := m.X + px + (m.Y+py)*g.W + (m.Z+pz)*g.W*g.H
					if state[i] != v {
						state[i] = v
						changed = true
					}
				}
			}
		}
	}
	return changed
}
