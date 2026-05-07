package mj

import (
	"fmt"
	"strconv"
	"strings"
)

type ConvolutionNode struct {
	Rules        []ConvolutionRule
	Neighborhood string
	Periodic     bool
	Steps        int
	Counter      int
}

type ConvolutionRule struct {
	Input  byte
	Output byte
	Values []byte
	Sums   []bool
	P      float64
}

var kernels2D = map[string][]int{
	"VonNeumann": {0, 1, 0, 1, 0, 1, 0, 1, 0},
	"Moore":      {1, 1, 1, 1, 0, 1, 1, 1, 1},
}

func parseConvolutionNode(x xmlNode, model *Model) (Node, error) {
	n := &ConvolutionNode{
		Neighborhood: attr(x.Attrs, "neighborhood"),
		Periodic:     boolAttr(x.Attrs, "periodic", false),
		Steps:        intAttr(x.Attrs, "steps", -1),
	}
	if n.Neighborhood == "" {
		return nil, fmt.Errorf("convolution requires neighborhood")
	}
	if _, ok := kernels2D[n.Neighborhood]; !ok {
		return nil, fmt.Errorf("unsupported convolution neighborhood: %s", n.Neighborhood)
	}
	ruleNodes := make([]xmlNode, 0)
	for _, child := range x.Nodes {
		if child.XMLName.Local == "rule" {
			ruleNodes = append(ruleNodes, child)
		}
	}
	if len(ruleNodes) == 0 {
		ruleNodes = append(ruleNodes, x)
	}
	for _, rx := range ruleNodes {
		rule, err := parseConvolutionRule(rx, model)
		if err != nil {
			return nil, err
		}
		n.Rules = append(n.Rules, rule)
	}
	return n, nil
}

func parseConvolutionRule(x xmlNode, model *Model) (ConvolutionRule, error) {
	in := attr(x.Attrs, "in")
	out := attr(x.Attrs, "out")
	if len(in) != 1 || len(out) != 1 {
		return ConvolutionRule{}, fmt.Errorf("convolution rule requires one-character in and out")
	}
	input, ok := indexOfValue(model.Values, in[0])
	if !ok {
		return ConvolutionRule{}, fmt.Errorf("convolution input %q is not in values", in[0])
	}
	output, ok := indexOfValue(model.Values, out[0])
	if !ok {
		return ConvolutionRule{}, fmt.Errorf("convolution output %q is not in values", out[0])
	}
	r := ConvolutionRule{Input: input, Output: output, P: floatAttr(x.Attrs, "p", 1)}
	valueString := attr(x.Attrs, "values")
	sumString := attr(x.Attrs, "sum")
	if valueString != "" && sumString == "" {
		return ConvolutionRule{}, fmt.Errorf("convolution rule missing sum attribute")
	}
	if valueString == "" && sumString != "" {
		return ConvolutionRule{}, fmt.Errorf("convolution rule missing values attribute")
	}
	if valueString != "" {
		for i := 0; i < len(valueString); i++ {
			idx, ok := indexOfValue(model.Values, valueString[i])
			if !ok {
				return ConvolutionRule{}, fmt.Errorf("convolution values contains %q not in values", valueString[i])
			}
			r.Values = append(r.Values, idx)
		}
		r.Sums = make([]bool, 28)
		for _, part := range strings.Split(sumString, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			min, max, err := parseInterval(part)
			if err != nil {
				return ConvolutionRule{}, err
			}
			for i := min; i <= max && i < len(r.Sums); i++ {
				if i >= 0 {
					r.Sums[i] = true
				}
			}
		}
	}
	return r, nil
}

func (n *ConvolutionNode) Type() string { return "convolution" }
func (n *ConvolutionNode) Features(out map[string]bool) {
	out["convolution"] = true
}

func (n *ConvolutionNode) Step(g *Grid, rng *RNG) (bool, error) {
	if n.Steps > 0 && n.Counter >= n.Steps {
		return false, nil
	}
	kernel := kernels2D[n.Neighborhood]
	sumfield := make([][]int, len(g.State))
	for i := range sumfield {
		sumfield[i] = make([]int, len(g.Values))
	}
	for y := 0; y < g.H; y++ {
		for x := 0; x < g.W; x++ {
			sums := sumfield[x+y*g.W]
			for dy := -1; dy <= 1; dy++ {
				for dx := -1; dx <= 1; dx++ {
					sx, sy := x+dx, y+dy
					if n.Periodic {
						if sx < 0 {
							sx += g.W
						} else if sx >= g.W {
							sx -= g.W
						}
						if sy < 0 {
							sy += g.H
						} else if sy >= g.H {
							sy -= g.H
						}
					} else if sx < 0 || sy < 0 || sx >= g.W || sy >= g.H {
						continue
					}
					weight := kernel[dx+1+(dy+1)*3]
					if weight != 0 {
						sums[g.State[sx+sy*g.W]] += weight
					}
				}
			}
		}
	}
	changed := false
	for i, input := range g.State {
		sums := sumfield[i]
		for _, rule := range n.Rules {
			if input != rule.Input || rule.Output == g.State[i] {
				continue
			}
			if rule.P < 1 && rng.Float64() >= rule.P {
				continue
			}
			if rule.Sums != nil {
				sum := 0
				for _, v := range rule.Values {
					sum += sums[v]
				}
				if sum < 0 || sum >= len(rule.Sums) || !rule.Sums[sum] {
					continue
				}
			}
			g.State[i] = rule.Output
			changed = true
			break
		}
	}
	n.Counter++
	return changed, nil
}

func indexOfValue(values string, ch byte) (byte, bool) {
	for i := 0; i < len(values); i++ {
		if values[i] == ch {
			return byte(i), true
		}
	}
	return 0, false
}

func parseInterval(s string) (int, int, error) {
	if strings.Contains(s, "..") {
		parts := strings.Split(s, "..")
		if len(parts) != 2 {
			return 0, 0, fmt.Errorf("invalid interval %q", s)
		}
		min, err := strconv.Atoi(parts[0])
		if err != nil {
			return 0, 0, err
		}
		max, err := strconv.Atoi(parts[1])
		if err != nil {
			return 0, 0, err
		}
		return min, max, nil
	}
	v, err := strconv.Atoi(s)
	return v, v, err
}
