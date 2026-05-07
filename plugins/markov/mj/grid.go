package mj

import (
	"fmt"
	"strings"
)

type Grid struct {
	W, H   int
	Values string
	Index  map[byte]byte
	Waves  map[byte]string
	State  []byte
}

type Rule struct {
	In, Out Pattern
	P       float64
}

type Pattern struct {
	W, H int
	Data []byte
}

type Match struct {
	Rule *Rule
	X, Y int
}

func NewGrid(w, h int, values string) (*Grid, error) {
	if w <= 0 || h <= 0 {
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
	return &Grid{W: w, H: h, Values: values, Index: idx, Waves: waves, State: make([]byte, w*h)}, nil
}

func (g *Grid) SetOrigin() {
	if len(g.Values) < 2 {
		return
	}
	g.State[g.W/2+(g.H/2)*g.W] = 1
}

func (g *Grid) DecodeRows() string {
	rows := make([]string, g.H)
	for y := 0; y < g.H; y++ {
		b := make([]byte, g.W)
		for x := 0; x < g.W; x++ {
			b[x] = g.Values[g.State[x+y*g.W]]
		}
		rows[y] = string(b)
	}
	return strings.Join(rows, "/")
}

func (g *Grid) EncodeRows(rows string) error {
	p, err := ParsePattern(rows)
	if err != nil {
		return err
	}
	if p.W != g.W || p.H != g.H {
		return fmt.Errorf("initial cells dimensions %dx%d do not match grid %dx%d", p.W, p.H, g.W, g.H)
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
	rows := strings.Split(s, "/")
	w := len(rows[0])
	if w == 0 {
		return Pattern{}, fmt.Errorf("pattern has empty first row")
	}
	data := make([]byte, 0, w*len(rows))
	for _, row := range rows {
		if len(row) != w {
			return Pattern{}, fmt.Errorf("ragged pattern %q", s)
		}
		data = append(data, []byte(row)...)
	}
	return Pattern{W: w, H: len(rows), Data: data}, nil
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
	if pin.W != pout.W || pin.H != pout.H {
		return Rule{}, fmt.Errorf("rule input/output dimensions differ")
	}
	return Rule{In: pin, Out: pout, P: 1}, nil
}

func SplitGluedRule(rect Pattern) (Rule, error) {
	if rect.W%2 != 0 {
		return Rule{}, fmt.Errorf("odd width %d in glued rule", rect.W)
	}
	half := rect.W / 2
	pin := Pattern{W: half, H: rect.H, Data: make([]byte, half*rect.H)}
	pout := Pattern{W: half, H: rect.H, Data: make([]byte, half*rect.H)}
	for y := 0; y < rect.H; y++ {
		copy(pin.Data[y*half:(y+1)*half], rect.Data[y*rect.W:y*rect.W+half])
		copy(pout.Data[y*half:(y+1)*half], rect.Data[y*rect.W+half:y*rect.W+rect.W])
	}
	return NewRule(pin, pout)
}

func (g *Grid) Matches(r *Rule) []Match {
	var out []Match
	if r.P <= 0 {
		return out
	}
	for y := 0; y <= g.H-r.In.H; y++ {
		for x := 0; x <= g.W-r.In.W; x++ {
			if g.MatchAt(r, x, y) {
				out = append(out, Match{Rule: r, X: x, Y: y})
			}
		}
	}
	return out
}

func (g *Grid) MatchAt(r *Rule, x, y int) bool {
	for py := 0; py < r.In.H; py++ {
		for px := 0; px < r.In.W; px++ {
			want := r.In.Data[px+py*r.In.W]
			if want == '*' {
				continue
			}
			actual := g.Values[g.State[x+px+(y+py)*g.W]]
			wave, ok := g.Waves[want]
			if !ok {
				return false
			}
			if !strings.ContainsRune(wave, rune(actual)) {
				return false
			}
		}
	}
	return true
}

func (g *Grid) Apply(m Match) {
	r := m.Rule
	for py := 0; py < r.Out.H; py++ {
		for px := 0; px < r.Out.W; px++ {
			ch := r.Out.Data[px+py*r.Out.W]
			if ch == '*' {
				continue
			}
			if v, ok := g.Index[ch]; ok {
				g.State[m.X+px+(m.Y+py)*g.W] = v
			}
		}
	}
}
