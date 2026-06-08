package main

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type xmlNode struct {
	Name     string
	Attrs    map[string]string
	Text     string
	Children []*xmlNode
}

type GBML struct {
	Format        string        `json:"format"`
	Version       int           `json:"version"`
	Source        Source        `json:"source"`
	Compatibility Compatibility `json:"compatibility"`
	Entrypoints   []Entrypoint  `json:"entrypoints"`
	Definitions   Definitions   `json:"definitions"`
	Expressions   []Expression  `json:"expressions"`
}

type Source struct {
	Language    string `json:"language"`
	Orientation string `json:"orientation"`
	Path        string `json:"path,omitempty"`
}

type Compatibility struct {
	Semantics string `json:"semantics"`
}

type Entrypoint struct {
	Name   string `json:"name"`
	Action string `json:"action"`
}

type Definitions struct {
	Actions []ActionDef `json:"actions"`
	Bullets []BulletDef `json:"bullets"`
	Fires   []FireDef   `json:"fires"`
}

type ActionDef struct {
	ID    string `json:"id"`
	Label string `json:"label,omitempty"`
	Ops   []Op   `json:"ops"`
}

type BulletDef struct {
	ID        string      `json:"id"`
	Label     string      `json:"label,omitempty"`
	Direction *ValueRef   `json:"direction,omitempty"`
	Speed     *ValueRef   `json:"speed,omitempty"`
	Actions   []ActionUse `json:"actions,omitempty"`
}

type FireDef struct {
	ID        string     `json:"id"`
	Label     string     `json:"label,omitempty"`
	Direction *ValueRef  `json:"direction,omitempty"`
	Speed     *ValueRef  `json:"speed,omitempty"`
	Bullet    *BulletUse `json:"bullet"`
}

type ActionUse struct {
	Kind   string      `json:"kind"`
	Action *ActionDef  `json:"action,omitempty"`
	Ref    *RefWithArg `json:"ref,omitempty"`
}

type BulletUse struct {
	Kind   string      `json:"kind"`
	Bullet *BulletDef  `json:"bullet,omitempty"`
	Ref    *RefWithArg `json:"ref,omitempty"`
}

type RefWithArg struct {
	Label  string `json:"label"`
	Params []int  `json:"params,omitempty"`
}

type ValueRef struct {
	Mode string `json:"mode"`
	Expr int    `json:"expr"`
}

type Op struct {
	Op         string      `json:"op"`
	Expr       *int        `json:"expr,omitempty"`
	Times      *int        `json:"times,omitempty"`
	Term       *int        `json:"term,omitempty"`
	Direction  *ValueRef   `json:"direction,omitempty"`
	Speed      *ValueRef   `json:"speed,omitempty"`
	Horizontal *ValueRef   `json:"horizontal,omitempty"`
	Vertical   *ValueRef   `json:"vertical,omitempty"`
	Fire       *FireDef    `json:"fire,omitempty"`
	FireRef    *RefWithArg `json:"fireRef,omitempty"`
	Action     *ActionDef  `json:"action,omitempty"`
	ActionRef  *RefWithArg `json:"actionRef,omitempty"`
}

type Expression struct {
	ID     int    `json:"id"`
	Source string `json:"source"`
}

type converter struct {
	exprs []Expression
}

func main() {
	out := flag.String("o", "", "output file for one input, or output directory for multiple inputs")
	flag.Parse()

	inputs := flag.Args()
	if len(inputs) == 0 {
		fmt.Fprintln(os.Stderr, "usage: gbml-import [-o output.gbml.json|output-dir] input.xml [...]")
		os.Exit(2)
	}
	if *out == "" {
		fmt.Fprintln(os.Stderr, "-o is required")
		os.Exit(2)
	}
	if len(inputs) > 1 {
		if err := os.MkdirAll(*out, 0o755); err != nil {
			fatal(err)
		}
	}

	for _, input := range inputs {
		if err := convertFile(input, *out, len(inputs) > 1); err != nil {
			fatal(fmt.Errorf("%s: %w", input, err))
		}
	}
}

func convertFile(input, out string, outputIsDir bool) error {
	data, err := os.ReadFile(input)
	if err != nil {
		return err
	}
	root, err := parseXML(data)
	if err != nil {
		return err
	}
	gbml, err := convert(root, input)
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(gbml, "", "  ")
	if err != nil {
		return err
	}
	encoded = append(encoded, '\n')

	outPath := out
	if outputIsDir {
		base := strings.TrimSuffix(filepath.Base(input), filepath.Ext(input)) + ".gbml.json"
		outPath = filepath.Join(out, base)
	}
	if err := os.MkdirAll(filepath.Dir(outPath), 0o755); err != nil {
		return err
	}
	return os.WriteFile(outPath, encoded, 0o644)
}

func parseXML(data []byte) (*xmlNode, error) {
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var stack []*xmlNode
	var root *xmlNode
	for {
		tok, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			n := &xmlNode{Name: t.Name.Local, Attrs: map[string]string{}}
			for _, attr := range t.Attr {
				n.Attrs[attr.Name.Local] = attr.Value
			}
			if len(stack) > 0 {
				parent := stack[len(stack)-1]
				parent.Children = append(parent.Children, n)
			} else if root != nil {
				return nil, fmt.Errorf("multiple root elements")
			} else {
				root = n
			}
			stack = append(stack, n)
		case xml.EndElement:
			if len(stack) == 0 || stack[len(stack)-1].Name != t.Name.Local {
				return nil, fmt.Errorf("unexpected closing element %q", t.Name.Local)
			}
			stack = stack[:len(stack)-1]
		case xml.CharData:
			text := strings.TrimSpace(string(t))
			if text != "" && len(stack) > 0 {
				cur := stack[len(stack)-1]
				if cur.Text == "" {
					cur.Text = text
				} else {
					cur.Text += text
				}
			}
		}
	}
	if len(stack) != 0 {
		return nil, fmt.Errorf("unclosed element %q", stack[len(stack)-1].Name)
	}
	if root == nil {
		return nil, fmt.Errorf("missing root element")
	}
	return root, nil
}

func convert(root *xmlNode, sourcePath string) (*GBML, error) {
	if root.Name != "bulletml" {
		return nil, fmt.Errorf("root must be <bulletml>, got <%s>", root.Name)
	}
	orientation := attrDefault(root, "type", "none")
	if !oneOf(orientation, "none", "vertical", "horizontal") {
		return nil, fmt.Errorf("invalid bulletml type %q", orientation)
	}

	c := &converter{}
	gbml := &GBML{
		Format:  "gams.gbml",
		Version: 1,
		Source: Source{
			Language:    "bulletml-0.21",
			Orientation: orientation,
			Path:        filepath.ToSlash(sourcePath),
		},
		Compatibility: Compatibility{Semantics: "gams-corrected-v1"},
		Entrypoints:   []Entrypoint{},
		Definitions: Definitions{
			Actions: []ActionDef{},
			Bullets: []BulletDef{},
			Fires:   []FireDef{},
		},
	}

	for i, child := range root.Children {
		switch child.Name {
		case "action":
			def, err := c.actionDef(child, fmt.Sprintf("action_%d", len(gbml.Definitions.Actions)))
			if err != nil {
				return nil, err
			}
			gbml.Definitions.Actions = append(gbml.Definitions.Actions, *def)
		case "bullet":
			def, err := c.bulletDef(child, fmt.Sprintf("bullet_%d", len(gbml.Definitions.Bullets)))
			if err != nil {
				return nil, err
			}
			gbml.Definitions.Bullets = append(gbml.Definitions.Bullets, *def)
		case "fire":
			def, err := c.fireDef(child, fmt.Sprintf("fire_%d", len(gbml.Definitions.Fires)))
			if err != nil {
				return nil, err
			}
			gbml.Definitions.Fires = append(gbml.Definitions.Fires, *def)
		default:
			return nil, fmt.Errorf("unexpected <%s> in <bulletml> at child %d", child.Name, i)
		}
	}
	for _, action := range gbml.Definitions.Actions {
		if action.Label == "top" {
			gbml.Entrypoints = append(gbml.Entrypoints, Entrypoint{Name: "top", Action: action.ID})
		}
	}
	if len(gbml.Entrypoints) == 0 {
		for _, action := range gbml.Definitions.Actions {
			if strings.HasPrefix(action.Label, "top") {
				gbml.Entrypoints = append(gbml.Entrypoints, Entrypoint{Name: action.Label, Action: action.ID})
			}
		}
	}
	if len(gbml.Entrypoints) == 0 && len(gbml.Definitions.Actions) > 0 {
		first := gbml.Definitions.Actions[0]
		name := first.Label
		if name == "" {
			name = first.ID
		}
		gbml.Entrypoints = append(gbml.Entrypoints, Entrypoint{Name: name, Action: first.ID})
	}
	gbml.Expressions = c.exprs
	return gbml, nil
}

func (c *converter) actionDef(n *xmlNode, fallbackID string) (*ActionDef, error) {
	ops, err := c.ops(n.Children)
	if err != nil {
		return nil, err
	}
	label := n.Attrs["label"]
	id := fallbackID
	if label != "" {
		id = "action:" + label
	}
	return &ActionDef{ID: id, Label: label, Ops: ops}, nil
}

func (c *converter) bulletDef(n *xmlNode, fallbackID string) (*BulletDef, error) {
	label := n.Attrs["label"]
	id := fallbackID
	if label != "" {
		id = "bullet:" + label
	}
	def := &BulletDef{ID: id, Label: label}
	idx := 0
	if idx < len(n.Children) && n.Children[idx].Name == "direction" {
		v, err := c.value(n.Children[idx], "aim", "aim", "absolute", "relative", "sequence")
		if err != nil {
			return nil, err
		}
		def.Direction = v
		idx++
	}
	if idx < len(n.Children) && n.Children[idx].Name == "speed" {
		v, err := c.value(n.Children[idx], "absolute", "absolute", "relative", "sequence")
		if err != nil {
			return nil, err
		}
		def.Speed = v
		idx++
	}
	for ; idx < len(n.Children); idx++ {
		child := n.Children[idx]
		switch child.Name {
		case "action":
			a, err := c.actionDef(child, "inline_action")
			if err != nil {
				return nil, err
			}
			def.Actions = append(def.Actions, ActionUse{Kind: "action", Action: a})
		case "actionRef":
			ref, err := c.ref(child)
			if err != nil {
				return nil, err
			}
			def.Actions = append(def.Actions, ActionUse{Kind: "actionRef", Ref: ref})
		default:
			return nil, fmt.Errorf("unexpected <%s> in <bullet>", child.Name)
		}
	}
	return def, nil
}

func (c *converter) fireDef(n *xmlNode, fallbackID string) (*FireDef, error) {
	label := n.Attrs["label"]
	id := fallbackID
	if label != "" {
		id = "fire:" + label
	}
	def := &FireDef{ID: id, Label: label}
	idx := 0
	if idx < len(n.Children) && n.Children[idx].Name == "direction" {
		v, err := c.value(n.Children[idx], "aim", "aim", "absolute", "relative", "sequence")
		if err != nil {
			return nil, err
		}
		def.Direction = v
		idx++
	}
	if idx < len(n.Children) && n.Children[idx].Name == "speed" {
		v, err := c.value(n.Children[idx], "absolute", "absolute", "relative", "sequence")
		if err != nil {
			return nil, err
		}
		def.Speed = v
		idx++
	}
	if idx >= len(n.Children) {
		return nil, fmt.Errorf("<fire> requires bullet or bulletRef")
	}
	bullet, err := c.bulletUse(n.Children[idx])
	if err != nil {
		return nil, err
	}
	def.Bullet = bullet
	if idx+1 != len(n.Children) {
		return nil, fmt.Errorf("unexpected extra children in <fire>")
	}
	return def, nil
}

func (c *converter) ops(children []*xmlNode) ([]Op, error) {
	ops := []Op{}
	for _, child := range children {
		switch child.Name {
		case "wait":
			expr := c.expr(child.Text)
			ops = append(ops, Op{Op: "wait", Expr: &expr})
		case "vanish":
			ops = append(ops, Op{Op: "vanish"})
		case "fire":
			fire, err := c.fireDef(child, "inline_fire")
			if err != nil {
				return nil, err
			}
			ops = append(ops, Op{Op: "fire", Fire: fire})
		case "fireRef":
			ref, err := c.ref(child)
			if err != nil {
				return nil, err
			}
			ops = append(ops, Op{Op: "fireRef", FireRef: ref})
		case "action":
			a, err := c.actionDef(child, "inline_action")
			if err != nil {
				return nil, err
			}
			ops = append(ops, Op{Op: "action", Action: a})
		case "actionRef":
			ref, err := c.ref(child)
			if err != nil {
				return nil, err
			}
			ops = append(ops, Op{Op: "actionRef", ActionRef: ref})
		case "repeat":
			op, err := c.repeatOp(child)
			if err != nil {
				return nil, err
			}
			ops = append(ops, op)
		case "changeDirection":
			op, err := c.changeDirectionOp(child)
			if err != nil {
				return nil, err
			}
			ops = append(ops, op)
		case "changeSpeed":
			op, err := c.changeSpeedOp(child)
			if err != nil {
				return nil, err
			}
			ops = append(ops, op)
		case "accel":
			op, err := c.accelOp(child)
			if err != nil {
				return nil, err
			}
			ops = append(ops, op)
		default:
			return nil, fmt.Errorf("unexpected <%s> in <action>", child.Name)
		}
	}
	return ops, nil
}

func (c *converter) repeatOp(n *xmlNode) (Op, error) {
	if len(n.Children) != 2 || n.Children[0].Name != "times" {
		return Op{}, fmt.Errorf("<repeat> must contain times and action/actionRef")
	}
	times := c.expr(n.Children[0].Text)
	body := n.Children[1]
	if body.Name == "action" {
		a, err := c.actionDef(body, "inline_action")
		if err != nil {
			return Op{}, err
		}
		return Op{Op: "repeat", Times: &times, Action: a}, nil
	}
	if body.Name == "actionRef" {
		ref, err := c.ref(body)
		if err != nil {
			return Op{}, err
		}
		return Op{Op: "repeat", Times: &times, ActionRef: ref}, nil
	}
	return Op{}, fmt.Errorf("<repeat> body must be action or actionRef")
}

func (c *converter) changeDirectionOp(n *xmlNode) (Op, error) {
	if len(n.Children) != 2 || n.Children[0].Name != "direction" || n.Children[1].Name != "term" {
		return Op{}, fmt.Errorf("<changeDirection> must contain direction, term")
	}
	dir, err := c.value(n.Children[0], "aim", "aim", "absolute", "relative", "sequence")
	if err != nil {
		return Op{}, err
	}
	term := c.expr(n.Children[1].Text)
	return Op{Op: "changeDirection", Direction: dir, Term: &term}, nil
}

func (c *converter) changeSpeedOp(n *xmlNode) (Op, error) {
	if len(n.Children) != 2 || n.Children[0].Name != "speed" || n.Children[1].Name != "term" {
		return Op{}, fmt.Errorf("<changeSpeed> must contain speed, term")
	}
	speed, err := c.value(n.Children[0], "absolute", "absolute", "relative", "sequence")
	if err != nil {
		return Op{}, err
	}
	term := c.expr(n.Children[1].Text)
	return Op{Op: "changeSpeed", Speed: speed, Term: &term}, nil
}

func (c *converter) accelOp(n *xmlNode) (Op, error) {
	if len(n.Children) == 0 || n.Children[len(n.Children)-1].Name != "term" {
		return Op{}, fmt.Errorf("<accel> must end with term")
	}
	op := Op{Op: "accel"}
	for _, child := range n.Children[:len(n.Children)-1] {
		switch child.Name {
		case "horizontal":
			v, err := c.value(child, "absolute", "absolute", "relative", "sequence")
			if err != nil {
				return Op{}, err
			}
			op.Horizontal = v
		case "vertical":
			v, err := c.value(child, "absolute", "absolute", "relative", "sequence")
			if err != nil {
				return Op{}, err
			}
			op.Vertical = v
		default:
			return Op{}, fmt.Errorf("unexpected <%s> in <accel>", child.Name)
		}
	}
	term := c.expr(n.Children[len(n.Children)-1].Text)
	op.Term = &term
	return op, nil
}

func (c *converter) bulletUse(n *xmlNode) (*BulletUse, error) {
	switch n.Name {
	case "bullet":
		b, err := c.bulletDef(n, "inline_bullet")
		if err != nil {
			return nil, err
		}
		return &BulletUse{Kind: "bullet", Bullet: b}, nil
	case "bulletRef":
		ref, err := c.ref(n)
		if err != nil {
			return nil, err
		}
		return &BulletUse{Kind: "bulletRef", Ref: ref}, nil
	default:
		return nil, fmt.Errorf("expected bullet or bulletRef, got <%s>", n.Name)
	}
}

func (c *converter) ref(n *xmlNode) (*RefWithArg, error) {
	label := n.Attrs["label"]
	if label == "" {
		return nil, fmt.Errorf("<%s> requires label", n.Name)
	}
	ref := &RefWithArg{Label: label}
	for _, child := range n.Children {
		if child.Name != "param" {
			return nil, fmt.Errorf("unexpected <%s> in <%s>", child.Name, n.Name)
		}
		ref.Params = append(ref.Params, c.expr(child.Text))
	}
	return ref, nil
}

func (c *converter) value(n *xmlNode, defaultMode string, allowed ...string) (*ValueRef, error) {
	mode := attrDefault(n, "type", defaultMode)
	if !oneOf(mode, allowed...) {
		return nil, fmt.Errorf("invalid <%s> type %q", n.Name, mode)
	}
	return &ValueRef{Mode: mode, Expr: c.expr(n.Text)}, nil
}

func (c *converter) expr(source string) int {
	id := len(c.exprs)
	c.exprs = append(c.exprs, Expression{ID: id, Source: strings.TrimSpace(source)})
	return id
}

func attrDefault(n *xmlNode, name, fallback string) string {
	if value, ok := n.Attrs[name]; ok && value != "" {
		return value
	}
	return fallback
}

func oneOf(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "gbml-import:", err)
	os.Exit(1)
}
