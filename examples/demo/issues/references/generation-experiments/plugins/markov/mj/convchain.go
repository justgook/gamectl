package mj

import (
	"fmt"
	"math"
)

type ConvChainNode struct {
	N           int
	Temperature float64
	Weights     []float64
	C0, C1      byte
	Substrate   []bool
	On          byte
	Counter     int
	Steps       int
}

func parseConvChainNode(x xmlNode, model *Model, opts ParseOptions) (Node, error) {
	name := attr(x.Attrs, "sample")
	if name == "" {
		return nil, fmt.Errorf("convchain sample is required")
	}
	sample, err := loadSampleImage(opts, name)
	if err != nil {
		return nil, err
	}
	n := intAttr(x.Attrs, "n", 3)
	if n <= 0 || n > 4 {
		return nil, fmt.Errorf("convchain n must be 1..4")
	}
	black := attr(x.Attrs, "black")
	white := attr(x.Attrs, "white")
	on := attr(x.Attrs, "on")
	if len(black) != 1 || len(white) != 1 || len(on) != 1 {
		return nil, fmt.Errorf("convchain requires one-character black, white, and on")
	}
	c0, ok := indexOfValue(model.Values, black[0])
	if !ok {
		return nil, fmt.Errorf("convchain black %q is not in values", black[0])
	}
	c1, ok := indexOfValue(model.Values, white[0])
	if !ok {
		return nil, fmt.Errorf("convchain white %q is not in values", white[0])
	}
	onIndex, ok := indexOfValue(model.Values, on[0])
	if !ok {
		return nil, fmt.Errorf("convchain on %q is not in values", on[0])
	}
	cc := &ConvChainNode{N: n, Temperature: floatAttr(x.Attrs, "temperature", 1), C0: c0, C1: c1, On: onIndex, Steps: intAttr(x.Attrs, "steps", -1)}
	cc.buildWeights(sample)
	return cc, nil
}

func (c *ConvChainNode) Type() string { return "convchain" }
func (c *ConvChainNode) Reset()       {}
func (c *ConvChainNode) Features(out map[string]bool) {
	out["convchain"] = true
}

func (c *ConvChainNode) Step(g *Grid, rng *RNG) (bool, error) {
	if g.D != 1 {
		return false, fmt.Errorf("convchain currently works only for 2d")
	}
	if c.Steps > 0 && c.Counter >= c.Steps {
		return false, nil
	}
	if c.Counter == 0 {
		c.Substrate = make([]bool, len(g.State))
		any := false
		for i := range c.Substrate {
			if g.State[i] == c.On {
				if rng.Intn(2) == 0 {
					g.State[i] = c.C0
				} else {
					g.State[i] = c.C1
				}
				c.Substrate[i] = true
				any = true
			}
		}
		c.Counter++
		return any, nil
	}
	for k := 0; k < len(g.State); k++ {
		r := rng.Intn(len(g.State))
		if !c.Substrate[r] {
			continue
		}
		x, y := r%g.W, r/g.W
		q := 1.0
		for sy := y - c.N + 1; sy <= y+c.N-1; sy++ {
			for sx := x - c.N + 1; sx <= x+c.N-1; sx++ {
				ind, diff := c.patternIndexAndDifference(g, sx, sy, x, y)
				q *= c.Weights[ind-diff] / c.Weights[ind]
			}
		}
		if q >= 1 || acceptance(q, c.Temperature) > rng.Float64() {
			c.toggle(g, r)
		}
	}
	c.Counter++
	return true, nil
}

func (c *ConvChainNode) buildWeights(sample sampleImage) {
	c.Weights = make([]float64, 1<<(c.N*c.N))
	for y := 0; y < sample.H; y++ {
		for x := 0; x < sample.W; x++ {
			pattern := make([]bool, c.N*c.N)
			for dy := 0; dy < c.N; dy++ {
				for dx := 0; dx < c.N; dx++ {
					pattern[dx+dy*c.N] = sample.Data[wrap(x+dx, sample.W)+wrap(y+dy, sample.H)*sample.W] == 0xffffffff
				}
			}
			for _, p := range squareBoolSymmetries(pattern, c.N) {
				c.Weights[boolPatternIndex(p)]++
			}
		}
	}
	for i := range c.Weights {
		if c.Weights[i] <= 0 {
			c.Weights[i] = 0.1
		}
	}
}

func (c *ConvChainNode) patternIndexAndDifference(g *Grid, sx, sy, x, y int) (int, int) {
	ind, diff := 0, 0
	for dy := 0; dy < c.N; dy++ {
		for dx := 0; dx < c.N; dx++ {
			xx := wrap(sx+dx, g.W)
			yy := wrap(sy+dy, g.H)
			value := g.State[xx+yy*g.W] == c.C1
			power := 1 << (dy*c.N + dx)
			if value {
				ind += power
			}
			if xx == x && yy == y {
				if value {
					diff = power
				} else {
					diff = -power
				}
			}
		}
	}
	return ind, diff
}

func (c *ConvChainNode) toggle(g *Grid, i int) {
	if g.State[i] == c.C0 {
		g.State[i] = c.C1
	} else {
		g.State[i] = c.C0
	}
}

func acceptance(q, temperature float64) float64 {
	if temperature != 1 {
		return math.Pow(q, 1/temperature)
	}
	return q
}

func boolPatternIndex(pattern []bool) int {
	ind := 0
	for i, v := range pattern {
		if v {
			ind += 1 << i
		}
	}
	return ind
}

func squareBoolSymmetries(pattern []bool, n int) [][]bool {
	seen := map[int]bool{}
	variants := make([][]bool, 0, 8)
	cur := append([]bool(nil), pattern...)
	for i := 0; i < 4; i++ {
		addBoolPattern(&variants, seen, cur)
		addBoolPattern(&variants, seen, reflectBoolPattern(cur, n))
		cur = rotateBoolPattern(cur, n)
	}
	return variants
}

func addBoolPattern(variants *[][]bool, seen map[int]bool, pattern []bool) {
	idx := boolPatternIndex(pattern)
	if seen[idx] {
		return
	}
	seen[idx] = true
	*variants = append(*variants, append([]bool(nil), pattern...))
}

func rotateBoolPattern(pattern []bool, n int) []bool {
	out := make([]bool, len(pattern))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			out[x+y*n] = pattern[n-1-y+x*n]
		}
	}
	return out
}

func reflectBoolPattern(pattern []bool, n int) []bool {
	out := make([]bool, len(pattern))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			out[x+y*n] = pattern[n-1-x+y*n]
		}
	}
	return out
}
