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
	"strconv"
	"strings"
)

type xmlNode struct {
	Name     string
	Attrs    map[string]string
	Text     string
	Children []*xmlNode
}

type Document struct {
	Type    string   `json:"type"`
	Bullets []Bullet `json:"bullets"`
	Actions []Action `json:"actions"`
	Fires   []Fire   `json:"fires"`
}

type Bullet struct {
	Direction  *Direction `json:"direction,omitempty"`
	Speed      *Speed     `json:"speed,omitempty"`
	ActionRefs []Ref      `json:"actionRefs,omitempty"`
}

type Action []Command

type Fire struct {
	Direction *Direction `json:"direction,omitempty"`
	Speed     *Speed     `json:"speed,omitempty"`
	BulletRef Ref        `json:"bulletRef"`
}

type Direction struct {
	Type  string `json:"type"`
	Value Value  `json:"value"`
}

type Speed struct {
	Type  string `json:"type"`
	Value Value  `json:"value"`
}

type Acceleration struct {
	Type  string `json:"type"`
	Value Value  `json:"value"`
}

type Value struct {
	Number *float64
	Expr   string
}

func (v Value) MarshalJSON() ([]byte, error) {
	if v.Number != nil {
		return json.Marshal(*v.Number)
	}
	return json.Marshal(v.Expr)
}

type Ref struct {
	Index  int
	Params []Value
}

func (r Ref) MarshalJSON() ([]byte, error) {
	if len(r.Params) == 0 {
		return json.Marshal(r.Index)
	}
	return json.Marshal(struct {
		Ref    int     `json:"ref"`
		Params []Value `json:"params"`
	}{Ref: r.Index, Params: r.Params})
}

type Command struct {
	Name  string
	Value any
}

func (c Command) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]any{c.Name: c.Value})
}

type ChangeDirection struct {
	Direction Direction `json:"direction"`
	Term      Value     `json:"term"`
}

type ChangeSpeed struct {
	Speed Speed `json:"speed"`
	Term  Value `json:"term"`
}

type Accel struct {
	Horizontal *Acceleration `json:"horizontal,omitempty"`
	Vertical   *Acceleration `json:"vertical,omitempty"`
	Term       Value         `json:"term"`
}

type Repeat struct {
	Times     Value `json:"times"`
	ActionRef Ref   `json:"actionRef"`
}

type compiler struct {
	doc          Document
	actionLabels map[string]int
	bulletLabels map[string]int
	fireLabels   map[string]int
}

func main() {
	out := flag.String("o", "", "output file for one input, or output directory for multiple inputs")
	flag.Parse()

	inputs := flag.Args()
	if len(inputs) == 0 {
		fmt.Fprintln(os.Stderr, "usage: bulletml-json [-o output.bulletml.json|output-dir] input.xml [...]")
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
	doc, err := compile(root)
	if err != nil {
		return err
	}
	encoded, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return err
	}
	encoded = append(encoded, '\n')

	outPath := out
	if outputIsDir {
		base := strings.TrimSuffix(filepath.Base(input), filepath.Ext(input)) + ".bulletml.json"
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
				cur.Text += text
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

func compile(root *xmlNode) (*Document, error) {
	if root.Name != "bulletml" {
		return nil, fmt.Errorf("root must be <bulletml>, got <%s>", root.Name)
	}
	orientation := attrDefault(root, "type", "none")
	if !oneOf(orientation, "none", "vertical", "horizontal") {
		return nil, fmt.Errorf("invalid bulletml type %q", orientation)
	}

	c := &compiler{
		doc:          Document{Type: orientation, Bullets: []Bullet{}, Actions: []Action{}, Fires: []Fire{}},
		actionLabels: map[string]int{},
		bulletLabels: map[string]int{},
		fireLabels:   map[string]int{},
	}

	var topBullets, topActions, topFires []*xmlNode
	for i, child := range root.Children {
		switch child.Name {
		case "bullet":
			topBullets = append(topBullets, child)
		case "action":
			topActions = append(topActions, child)
		case "fire":
			topFires = append(topFires, child)
		default:
			return nil, fmt.Errorf("unexpected <%s> in <bulletml> at child %d", child.Name, i)
		}
	}
	if len(topActions) == 0 {
		return nil, fmt.Errorf("BulletML document must contain at least one top-level action")
	}

	for i, node := range topBullets {
		if err := registerLabel(c.bulletLabels, node, i, "bullet"); err != nil {
			return nil, err
		}
	}
	for i, node := range topFires {
		if err := registerLabel(c.fireLabels, node, i, "fire"); err != nil {
			return nil, err
		}
	}
	wrapperActionIndices := wrapperActionIndices(topActions)
	needsWrapperAction := len(wrapperActionIndices) != 1 || wrapperActionIndices[0] != 0
	actionOffset := 0
	if needsWrapperAction {
		actionOffset = 1
		c.doc.Actions = append(c.doc.Actions, nil)
	}
	for i, node := range topActions {
		if err := registerLabel(c.actionLabels, node, i+actionOffset, "action"); err != nil {
			return nil, err
		}
	}

	for range topBullets {
		c.doc.Bullets = append(c.doc.Bullets, Bullet{})
	}
	for range topFires {
		c.doc.Fires = append(c.doc.Fires, Fire{})
	}
	for range topActions {
		c.doc.Actions = append(c.doc.Actions, nil)
	}

	for i, node := range topBullets {
		bullet, err := c.convertBullet(node)
		if err != nil {
			return nil, err
		}
		c.doc.Bullets[i] = bullet
	}
	for i, node := range topFires {
		fire, err := c.convertFire(node)
		if err != nil {
			return nil, err
		}
		c.doc.Fires[i] = fire
	}
	for i, node := range topActions {
		action, err := c.convertAction(node)
		if err != nil {
			return nil, err
		}
		c.doc.Actions[i+actionOffset] = action
	}
	if needsWrapperAction {
		wrapper := Action{}
		for _, i := range wrapperActionIndices {
			wrapper = append(wrapper, Command{Name: "actionRef", Value: Ref{Index: i + actionOffset}})
		}
		c.doc.Actions[0] = wrapper
	}

	return &c.doc, nil
}

func wrapperActionIndices(topActions []*xmlNode) []int {
	if len(topActions) == 1 {
		return []int{0}
	}
	topLabelIndices := []int{}
	for i, action := range topActions {
		if isRootActionLabel(action.Attrs["label"]) {
			topLabelIndices = append(topLabelIndices, i)
		}
	}
	if len(topLabelIndices) > 0 {
		return topLabelIndices
	}
	referenced := map[string]bool{}
	for _, action := range topActions {
		collectActionRefLabels(action, referenced)
	}
	indices := []int{}
	for i, action := range topActions {
		label := action.Attrs["label"]
		if label == "" || !referenced[label] {
			indices = append(indices, i)
		}
	}
	if len(indices) == 0 {
		for i := range topActions {
			indices = append(indices, i)
		}
	}
	return indices
}

func isRootActionLabel(label string) bool {
	return strings.HasPrefix(label, "top")
}

func collectActionRefLabels(node *xmlNode, labels map[string]bool) {
	if node.Name == "actionRef" {
		label := node.Attrs["label"]
		if label != "" {
			labels[label] = true
		}
	}
	for _, child := range node.Children {
		collectActionRefLabels(child, labels)
	}
}

func registerLabel(labels map[string]int, node *xmlNode, index int, kind string) error {
	label := node.Attrs["label"]
	if label == "" {
		return nil
	}
	if _, exists := labels[label]; exists {
		return fmt.Errorf("duplicate %s label %q", kind, label)
	}
	labels[label] = index
	return nil
}

func (c *compiler) convertBullet(n *xmlNode) (Bullet, error) {
	var bullet Bullet
	idx := 0
	if idx < len(n.Children) && n.Children[idx].Name == "direction" {
		dir, err := directionValue(n.Children[idx], "aim")
		if err != nil {
			return Bullet{}, err
		}
		bullet.Direction = dir
		idx++
	}
	if idx < len(n.Children) && n.Children[idx].Name == "speed" {
		speed, err := speedValue(n.Children[idx], "absolute")
		if err != nil {
			return Bullet{}, err
		}
		bullet.Speed = speed
		idx++
	}
	for ; idx < len(n.Children); idx++ {
		child := n.Children[idx]
		switch child.Name {
		case "action":
			ref, err := c.hoistAction(child)
			if err != nil {
				return Bullet{}, err
			}
			bullet.ActionRefs = append(bullet.ActionRefs, ref)
		case "actionRef":
			ref, err := c.actionRef(child)
			if err != nil {
				return Bullet{}, err
			}
			bullet.ActionRefs = append(bullet.ActionRefs, ref)
		default:
			return Bullet{}, fmt.Errorf("unexpected <%s> in <bullet>", child.Name)
		}
	}
	return bullet, nil
}

func (c *compiler) convertAction(n *xmlNode) (Action, error) {
	action := Action{}
	for _, child := range n.Children {
		switch child.Name {
		case "wait":
			action = append(action, Command{Name: "wait", Value: textValue(child)})
		case "vanish":
			if len(child.Children) != 0 || strings.TrimSpace(child.Text) != "" {
				return nil, fmt.Errorf("<vanish> must be empty")
			}
			action = append(action, Command{Name: "vanish", Value: true})
		case "fire":
			ref, err := c.hoistFire(child)
			if err != nil {
				return nil, err
			}
			action = append(action, Command{Name: "fireRef", Value: ref})
		case "fireRef":
			ref, err := c.fireRef(child)
			if err != nil {
				return nil, err
			}
			action = append(action, Command{Name: "fireRef", Value: ref})
		case "action":
			ref, err := c.hoistAction(child)
			if err != nil {
				return nil, err
			}
			action = append(action, Command{Name: "actionRef", Value: ref})
		case "actionRef":
			ref, err := c.actionRef(child)
			if err != nil {
				return nil, err
			}
			action = append(action, Command{Name: "actionRef", Value: ref})
		case "repeat":
			repeat, err := c.convertRepeat(child)
			if err != nil {
				return nil, err
			}
			action = append(action, Command{Name: "repeat", Value: repeat})
		case "changeDirection":
			change, err := convertChangeDirection(child)
			if err != nil {
				return nil, err
			}
			action = append(action, Command{Name: "changeDirection", Value: change})
		case "changeSpeed":
			change, err := convertChangeSpeed(child)
			if err != nil {
				return nil, err
			}
			action = append(action, Command{Name: "changeSpeed", Value: change})
		case "accel":
			accel, err := convertAccel(child)
			if err != nil {
				return nil, err
			}
			action = append(action, Command{Name: "accel", Value: accel})
		default:
			return nil, fmt.Errorf("unexpected <%s> in <action>", child.Name)
		}
	}
	return action, nil
}

func (c *compiler) convertFire(n *xmlNode) (Fire, error) {
	var fire Fire
	idx := 0
	if idx < len(n.Children) && n.Children[idx].Name == "direction" {
		dir, err := directionValue(n.Children[idx], "aim")
		if err != nil {
			return Fire{}, err
		}
		fire.Direction = dir
		idx++
	}
	if idx < len(n.Children) && n.Children[idx].Name == "speed" {
		speed, err := speedValue(n.Children[idx], "absolute")
		if err != nil {
			return Fire{}, err
		}
		fire.Speed = speed
		idx++
	}
	if idx >= len(n.Children) {
		return Fire{}, fmt.Errorf("<fire> requires bullet or bulletRef")
	}
	switch n.Children[idx].Name {
	case "bullet":
		ref, err := c.hoistBullet(n.Children[idx])
		if err != nil {
			return Fire{}, err
		}
		fire.BulletRef = ref
	case "bulletRef":
		ref, err := c.bulletRef(n.Children[idx])
		if err != nil {
			return Fire{}, err
		}
		fire.BulletRef = ref
	default:
		return Fire{}, fmt.Errorf("expected bullet or bulletRef in <fire>, got <%s>", n.Children[idx].Name)
	}
	if idx+1 != len(n.Children) {
		return Fire{}, fmt.Errorf("unexpected extra children in <fire>")
	}
	return fire, nil
}

func (c *compiler) convertRepeat(n *xmlNode) (Repeat, error) {
	if len(n.Children) != 2 || n.Children[0].Name != "times" {
		return Repeat{}, fmt.Errorf("<repeat> must contain times and action/actionRef")
	}
	body := n.Children[1]
	var ref Ref
	switch body.Name {
	case "action":
		var err error
		ref, err = c.hoistAction(body)
		if err != nil {
			return Repeat{}, err
		}
	case "actionRef":
		var err error
		ref, err = c.actionRef(body)
		if err != nil {
			return Repeat{}, err
		}
	default:
		return Repeat{}, fmt.Errorf("<repeat> body must be action or actionRef")
	}
	return Repeat{Times: textValue(n.Children[0]), ActionRef: ref}, nil
}

func convertChangeDirection(n *xmlNode) (ChangeDirection, error) {
	if len(n.Children) != 2 || n.Children[0].Name != "direction" || n.Children[1].Name != "term" {
		return ChangeDirection{}, fmt.Errorf("<changeDirection> must contain direction, term")
	}
	dir, err := directionValue(n.Children[0], "aim")
	if err != nil {
		return ChangeDirection{}, err
	}
	return ChangeDirection{Direction: *dir, Term: textValue(n.Children[1])}, nil
}

func convertChangeSpeed(n *xmlNode) (ChangeSpeed, error) {
	if len(n.Children) != 2 || n.Children[0].Name != "speed" || n.Children[1].Name != "term" {
		return ChangeSpeed{}, fmt.Errorf("<changeSpeed> must contain speed, term")
	}
	speed, err := speedValue(n.Children[0], "absolute")
	if err != nil {
		return ChangeSpeed{}, err
	}
	return ChangeSpeed{Speed: *speed, Term: textValue(n.Children[1])}, nil
}

func convertAccel(n *xmlNode) (Accel, error) {
	if len(n.Children) == 0 || n.Children[len(n.Children)-1].Name != "term" {
		return Accel{}, fmt.Errorf("<accel> must end with term")
	}
	accel := Accel{Term: textValue(n.Children[len(n.Children)-1])}
	seenHorizontal := false
	seenVertical := false
	for _, child := range n.Children[:len(n.Children)-1] {
		switch child.Name {
		case "horizontal":
			if seenHorizontal {
				return Accel{}, fmt.Errorf("duplicate <horizontal> in <accel>")
			}
			v, err := accelerationValue(child, "absolute")
			if err != nil {
				return Accel{}, err
			}
			accel.Horizontal = v
			seenHorizontal = true
		case "vertical":
			if seenVertical {
				return Accel{}, fmt.Errorf("duplicate <vertical> in <accel>")
			}
			v, err := accelerationValue(child, "absolute")
			if err != nil {
				return Accel{}, err
			}
			accel.Vertical = v
			seenVertical = true
		default:
			return Accel{}, fmt.Errorf("unexpected <%s> in <accel>", child.Name)
		}
	}
	if accel.Horizontal == nil && accel.Vertical == nil {
		return Accel{}, fmt.Errorf("<accel> requires horizontal or vertical")
	}
	return accel, nil
}

func (c *compiler) hoistBullet(n *xmlNode) (Ref, error) {
	index := len(c.doc.Bullets)
	c.doc.Bullets = append(c.doc.Bullets, Bullet{})
	bullet, err := c.convertBullet(n)
	if err != nil {
		return Ref{}, err
	}
	c.doc.Bullets[index] = bullet
	return Ref{Index: index}, nil
}

func (c *compiler) hoistAction(n *xmlNode) (Ref, error) {
	index := len(c.doc.Actions)
	c.doc.Actions = append(c.doc.Actions, nil)
	action, err := c.convertAction(n)
	if err != nil {
		return Ref{}, err
	}
	c.doc.Actions[index] = action
	return Ref{Index: index}, nil
}

func (c *compiler) hoistFire(n *xmlNode) (Ref, error) {
	index := len(c.doc.Fires)
	c.doc.Fires = append(c.doc.Fires, Fire{})
	fire, err := c.convertFire(n)
	if err != nil {
		return Ref{}, err
	}
	c.doc.Fires[index] = fire
	return Ref{Index: index}, nil
}

func (c *compiler) actionRef(n *xmlNode) (Ref, error) {
	return c.ref(n, c.actionLabels, "action")
}

func (c *compiler) bulletRef(n *xmlNode) (Ref, error) {
	return c.ref(n, c.bulletLabels, "bullet")
}

func (c *compiler) fireRef(n *xmlNode) (Ref, error) {
	return c.ref(n, c.fireLabels, "fire")
}

func (c *compiler) ref(n *xmlNode, labels map[string]int, kind string) (Ref, error) {
	label := n.Attrs["label"]
	if label == "" {
		return Ref{}, fmt.Errorf("<%s> requires label", n.Name)
	}
	index, exists := labels[label]
	if !exists {
		return Ref{}, fmt.Errorf("unknown %s label %q", kind, label)
	}
	ref := Ref{Index: index}
	for _, child := range n.Children {
		if child.Name != "param" {
			return Ref{}, fmt.Errorf("unexpected <%s> in <%s>", child.Name, n.Name)
		}
		ref.Params = append(ref.Params, textValue(child))
	}
	return ref, nil
}

func directionValue(n *xmlNode, defaultType string) (*Direction, error) {
	typeName := attrDefault(n, "type", defaultType)
	if !oneOf(typeName, "aim", "absolute", "relative", "sequence") {
		return nil, fmt.Errorf("invalid <%s> type %q", n.Name, typeName)
	}
	if len(n.Children) != 0 {
		return nil, fmt.Errorf("<%s> must contain only text", n.Name)
	}
	return &Direction{Type: typeName, Value: textValue(n)}, nil
}

func speedValue(n *xmlNode, defaultType string) (*Speed, error) {
	typeName := attrDefault(n, "type", defaultType)
	if !oneOf(typeName, "absolute", "relative", "sequence") {
		return nil, fmt.Errorf("invalid <%s> type %q", n.Name, typeName)
	}
	if len(n.Children) != 0 {
		return nil, fmt.Errorf("<%s> must contain only text", n.Name)
	}
	return &Speed{Type: typeName, Value: textValue(n)}, nil
}

func accelerationValue(n *xmlNode, defaultType string) (*Acceleration, error) {
	typeName := attrDefault(n, "type", defaultType)
	if !oneOf(typeName, "absolute", "relative", "sequence") {
		return nil, fmt.Errorf("invalid <%s> type %q", n.Name, typeName)
	}
	if len(n.Children) != 0 {
		return nil, fmt.Errorf("<%s> must contain only text", n.Name)
	}
	return &Acceleration{Type: typeName, Value: textValue(n)}, nil
}

func textValue(n *xmlNode) Value {
	text := strings.TrimSpace(n.Text)
	if text == "" {
		return Value{Expr: ""}
	}
	if number, err := strconv.ParseFloat(text, 64); err == nil {
		return Value{Number: &number}
	}
	return Value{Expr: text}
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
	fmt.Fprintln(os.Stderr, "bulletml-json:", err)
	os.Exit(1)
}
