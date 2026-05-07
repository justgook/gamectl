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
	Root   Node
}

type Node interface {
	Type() string
	Step(g *Grid, rng *RNG) (bool, error)
	Features(out map[string]bool)
}

type Branch struct {
	Kind  string
	Nodes []Node
}

type RuleNode struct {
	Kind  string
	Rules []Rule
	Steps int
}

type xmlNode struct {
	XMLName xml.Name
	Attrs   []xml.Attr `xml:",any,attr"`
	Nodes   []xmlNode  `xml:",any"`
}

func ParseXML(data []byte) (*Model, error) {
	var x xmlNode
	if err := xml.Unmarshal(data, &x); err != nil {
		return nil, err
	}
	values := attr(x.Attrs, "values")
	if values == "" {
		return nil, fmt.Errorf("root values is required")
	}
	n, err := parseNode(x)
	if err != nil {
		return nil, err
	}
	return &Model{Values: strings.ReplaceAll(values, " ", ""), Origin: boolAttr(x.Attrs, "origin", false), Root: n}, nil
}

func parseNode(x xmlNode) (Node, error) {
	kind := x.XMLName.Local
	switch kind {
	case "sequence", "markov":
		b := &Branch{Kind: kind}
		for _, child := range x.Nodes {
			if child.XMLName.Local == "rule" || child.XMLName.Local == "observe" || child.XMLName.Local == "union" {
				continue
			}
			n, err := parseNode(child)
			if err != nil {
				return nil, err
			}
			b.Nodes = append(b.Nodes, n)
		}
		return b, nil
	case "one", "all", "prl":
		rn := &RuleNode{Kind: kind, Steps: intAttr(x.Attrs, "steps", 0)}
		if attr(x.Attrs, "in") != "" || attr(x.Attrs, "out") != "" {
			r, err := parseRuleAttrs(x.Attrs)
			if err != nil {
				return nil, err
			}
			rn.Rules = append(rn.Rules, r)
		}
		for _, child := range x.Nodes {
			if child.XMLName.Local != "rule" {
				continue
			}
			r, err := parseRuleAttrs(child.Attrs)
			if err != nil {
				return nil, err
			}
			rn.Rules = append(rn.Rules, r)
		}
		if len(rn.Rules) == 0 {
			return nil, fmt.Errorf("%s node has no inline rules; file-backed or advanced nodes are not implemented yet", kind)
		}
		return rn, nil
	case "path", "map", "convolution", "convchain", "wfc":
		return nil, fmt.Errorf("unsupported node type: %s", kind)
	default:
		return nil, fmt.Errorf("unknown node type: %s", kind)
	}
}

func parseRuleAttrs(attrs []xml.Attr) (Rule, error) {
	in := attr(attrs, "in")
	out := attr(attrs, "out")
	if in == "" || out == "" {
		return Rule{}, fmt.Errorf("rule requires in and out attributes")
	}
	r, err := ParseRule(in, out)
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
func (b *Branch) Features(out map[string]bool) {
	out[b.Kind] = true
	for _, n := range b.Nodes {
		n.Features(out)
	}
}

func (b *Branch) Step(g *Grid, rng *RNG) (bool, error) {
	switch b.Kind {
	case "sequence":
		changed := false
		for _, n := range b.Nodes {
			c, err := n.Step(g, rng)
			if err != nil {
				return false, err
			}
			changed = changed || c
		}
		return changed, nil
	case "markov":
		for _, n := range b.Nodes {
			c, err := n.Step(g, rng)
			if err != nil {
				return false, err
			}
			if c {
				return true, nil
			}
		}
		return false, nil
	default:
		return false, fmt.Errorf("unsupported branch kind %s", b.Kind)
	}
}

func (r *RuleNode) Type() string                 { return r.Kind }
func (r *RuleNode) Features(out map[string]bool) { out[r.Kind] = true; out["rules"] = true }
func (r *RuleNode) Step(g *Grid, rng *RNG) (bool, error) {
	limit := 1
	if r.Steps > 0 {
		limit = r.Steps
	}
	changed := false
	for i := 0; i < limit; i++ {
		c := false
		switch r.Kind {
		case "one":
			c = r.stepOne(g, rng)
		case "all", "prl":
			c = r.stepAll(g, rng)
		default:
			return false, fmt.Errorf("unsupported rule node kind %s", r.Kind)
		}
		changed = changed || c
		if !c || r.Steps == 0 {
			break
		}
	}
	return changed, nil
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
			if !g.MatchAt(m.Rule, m.X, m.Y) {
				continue
			}
			g.Apply(m)
			changed = true
		}
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
