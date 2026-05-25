package mj

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
)

type Model struct {
	Values string
	Origin bool
	Waves  map[byte]string
	Root   Node
}

type ParseOptions struct {
	ResourceRoot string
	ReadFile     func(string) ([]byte, error)
}

type Node interface {
	Type() string
	Step(g *Grid, rng *RNG) (bool, error)
	Reset()
	Features(out map[string]bool)
}

type Branch struct {
	Kind  string
	Nodes []Node
	N     int
}

type RuleNode struct {
	Kind    string
	Rules   []Rule
	Steps   int
	Counter int
}

type xmlNode struct {
	XMLName xml.Name
	Attrs   []xml.Attr `xml:",any,attr"`
	Nodes   []xmlNode  `xml:",any"`
}

func ParseXML(data []byte) (*Model, error) { return ParseXMLWithOptions(data, ParseOptions{}) }

func ParseXMLWithOptions(data []byte, opts ParseOptions) (*Model, error) {
	var x xmlNode
	if err := xml.Unmarshal(data, &x); err != nil {
		return nil, err
	}
	values := attr(x.Attrs, "values")
	if values == "" {
		return nil, fmt.Errorf("root values is required")
	}
	model := &Model{Values: strings.ReplaceAll(values, " ", ""), Origin: boolAttr(x.Attrs, "origin", false), Waves: map[byte]string{}}
	for i := 0; i < len(model.Values); i++ {
		model.Waves[model.Values[i]] = string(model.Values[i])
	}
	model.Waves['*'] = model.Values
	collectUnions(x, model.Waves)
	symmetry, err := parseSquareSymmetry(attr(x.Attrs, "symmetry"), []bool{true, true, true, true, true, true, true, true})
	if err != nil {
		return nil, err
	}
	n, err := parseNode(x, model, opts, attr(x.Attrs, "folder"), symmetry)
	if err != nil {
		return nil, err
	}
	model.Root = n
	return model, nil
}

func parseSquareSymmetry(s string, dflt []bool) ([]bool, error) {
	if s == "" {
		return dflt, nil
	}
	switch s {
	case "()":
		return []bool{true, false, false, false, false, false, false, false}, nil
	case "(x)":
		return []bool{true, true, false, false, false, false, false, false}, nil
	case "(y)":
		return []bool{true, false, false, false, false, true, false, false}, nil
	case "(x)(y)":
		return []bool{true, true, false, false, true, true, false, false}, nil
	case "(xy+)":
		return []bool{true, false, true, false, true, false, true, false}, nil
	case "(xy)":
		return []bool{true, true, true, true, true, true, true, true}, nil
	default:
		return nil, fmt.Errorf("unknown symmetry %q", s)
	}
}

func parseNode(x xmlNode, model *Model, opts ParseOptions, folder string, parentSymmetry []bool) (Node, error) {
	kind := x.XMLName.Local
	symmetry, err := parseSquareSymmetry(attr(x.Attrs, "symmetry"), parentSymmetry)
	if err != nil {
		return nil, err
	}
	switch kind {
	case "sequence", "markov":
		if f := attr(x.Attrs, "folder"); f != "" {
			folder = f
		}
		b := &Branch{Kind: kind}
		for _, child := range x.Nodes {
			if child.XMLName.Local == "rule" || child.XMLName.Local == "observe" || child.XMLName.Local == "union" {
				continue
			}
			n, err := parseNode(child, model, opts, folder, symmetry)
			if err != nil {
				return nil, err
			}
			b.Nodes = append(b.Nodes, n)
		}
		return b, nil
	case "one", "all", "prl":
		if f := attr(x.Attrs, "folder"); f != "" {
			folder = f
		}
		rn := &RuleNode{Kind: kind, Steps: intAttr(x.Attrs, "steps", 0)}
		if hasAnyAttr(x.Attrs, "in", "out", "fin", "fout", "file") {
			r, err := parseRuleAttrs(x.Attrs, opts, folder, true)
			if err != nil {
				return nil, err
			}
			rn.Rules = append(rn.Rules, r.SquareSymmetries(symmetry)...)
		}
		for _, child := range x.Nodes {
			if child.XMLName.Local != "rule" {
				continue
			}
			r, err := parseRuleAttrs(child.Attrs, opts, folder, true)
			if err != nil {
				return nil, err
			}
			ruleSymmetry, err := parseSquareSymmetry(attr(child.Attrs, "symmetry"), symmetry)
			if err != nil {
				return nil, err
			}
			rn.Rules = append(rn.Rules, r.SquareSymmetries(ruleSymmetry)...)
		}
		if len(rn.Rules) == 0 {
			return nil, fmt.Errorf("%s node has no inline rules; file-backed or advanced nodes are not implemented yet", kind)
		}
		return rn, nil
	case "path":
		return parsePathNode(x, model)
	case "convolution":
		return parseConvolutionNode(x, model)
	case "map":
		return parseMapNode(x, model, opts, folder)
	case "convchain":
		return parseConvChainNode(x, model, opts)
	case "wfc":
		if attr(x.Attrs, "sample") != "" {
			return parseOverlapWFCNode(x, model, opts, folder)
		}
		if attr(x.Attrs, "tileset") != "" {
			return parseTileWFCNode(x, model, opts, folder)
		}
		return nil, fmt.Errorf("wfc requires sample or tileset")
	default:
		return nil, fmt.Errorf("unknown node type: %s", kind)
	}
}

func parseRuleAttrs(attrs []xml.Attr, opts ParseOptions, folder string, requireSameSize bool) (Rule, error) {
	in := attr(attrs, "in")
	out := attr(attrs, "out")
	fin := attr(attrs, "fin")
	fout := attr(attrs, "fout")
	file := attr(attrs, "file")
	legend := attr(attrs, "legend")
	var r Rule
	var err error
	if file != "" {
		if in != "" || out != "" || fin != "" || fout != "" {
			return Rule{}, fmt.Errorf("rule already contains a file attribute")
		}
		var rect Pattern
		rect, err = loadResourcePattern(opts, folder, file, legend)
		if err == nil {
			r, err = SplitGluedRule(rect)
		}
	} else {
		var pin, pout Pattern
		if in != "" {
			pin, err = ParsePattern(in)
		} else if fin != "" {
			pin, err = loadResourcePattern(opts, folder, fin, legend)
		} else {
			err = fmt.Errorf("rule requires in or fin attribute")
		}
		if err == nil {
			if out != "" {
				pout, err = ParsePattern(out)
			} else if fout != "" {
				pout, err = loadResourcePattern(opts, folder, fout, legend)
			} else {
				err = fmt.Errorf("rule requires out or fout attribute")
			}
		}
		if err == nil {
			if requireSameSize {
				r, err = NewRule(pin, pout)
			} else {
				r = NewRuleAny(pin, pout)
			}
		}
	}
	if err != nil {
		return Rule{}, err
	}
	p := attr(attrs, "p")
	if p != "" {
		v, err := strconv.ParseFloat(p, 64)
		if err != nil {
			return Rule{}, fmt.Errorf("invalid rule p %q: %w", p, err)
		}
		r.P = v
	}
	return r, nil
}

func (b *Branch) Type() string { return b.Kind }
func (b *Branch) Reset() {
	for _, n := range b.Nodes {
		n.Reset()
	}
	b.N = 0
}
func (b *Branch) Features(out map[string]bool) {
	out[b.Kind] = true
	for _, n := range b.Nodes {
		n.Features(out)
	}
}

func (b *Branch) Step(g *Grid, rng *RNG) (bool, error) {
	if b.Kind == "markov" {
		b.N = 0
	}
	if b.Kind != "sequence" && b.Kind != "markov" {
		return false, fmt.Errorf("unsupported branch kind %s", b.Kind)
	}
	for ; b.N < len(b.Nodes); b.N++ {
		changed, err := b.Nodes[b.N].Step(g, rng)
		if err != nil {
			return false, err
		}
		if changed {
			return true, nil
		}
	}
	b.Reset()
	return false, nil
}

func (r *RuleNode) Type() string                 { return r.Kind }
func (r *RuleNode) Reset()                       { r.Counter = 0 }
func (r *RuleNode) Features(out map[string]bool) { out[r.Kind] = true; out["rules"] = true }
func (r *RuleNode) Step(g *Grid, rng *RNG) (bool, error) {
	if r.Steps > 0 && r.Counter >= r.Steps {
		return false, nil
	}
	var c bool
	switch r.Kind {
	case "one":
		c = r.stepOne(g, rng)
	case "all":
		c = r.stepAll(g, rng)
	case "prl":
		c = r.stepParallel(g, rng)
	default:
		return false, fmt.Errorf("unsupported rule node kind %s", r.Kind)
	}
	if c {
		r.Counter++
	}
	return c, nil
}

func (r *RuleNode) stepOne(g *Grid, rng *RNG) bool {
	var matches []Match
	for ri := range r.Rules {
		matches = append(matches, g.Matches(&r.Rules[ri])...)
	}
	if len(matches) == 0 {
		return false
	}
	m := matches[rng.Intn(len(matches))]
	g.Apply(m)
	return true
}

func (r *RuleNode) stepAll(g *Grid, rng *RNG) bool {
	changed := false
	for ri := range r.Rules {
		matches := g.Matches(&r.Rules[ri])
		for _, m := range matches {
			if !g.MatchAt(m.Rule, m.X, m.Y, m.Z) {
				continue
			}
			if m.Rule.P < 1 && rng.Float64() >= m.Rule.P {
				continue
			}
			if g.Apply(m) {
				changed = true
			}
		}
	}
	return changed
}

func (r *RuleNode) stepParallel(g *Grid, rng *RNG) bool {
	newState := append([]byte(nil), g.State...)
	changed := false
	for ri := range r.Rules {
		matches := g.Matches(&r.Rules[ri])
		for _, m := range matches {
			if m.Rule.P < 1 && rng.Float64() >= m.Rule.P {
				continue
			}
			if applyToState(m, g, newState) {
				changed = true
			}
		}
	}
	if changed {
		copy(g.State, newState)
	}
	return changed
}

func attr(attrs []xml.Attr, name string) string {
	for _, a := range attrs {
		if a.Name.Local == name {
			return a.Value
		}
	}
	return ""
}

func boolAttr(attrs []xml.Attr, name string, def bool) bool {
	s := attr(attrs, name)
	if s == "" {
		return def
	}
	return strings.EqualFold(s, "true")
}

func intAttr(attrs []xml.Attr, name string, def int) int {
	s := attr(attrs, name)
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}

func floatAttr(attrs []xml.Attr, name string, def float64) float64 {
	s := attr(attrs, name)
	if s == "" {
		return def
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return def
	}
	return v
}
