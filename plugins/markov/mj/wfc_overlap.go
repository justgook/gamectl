package mj

import (
	"fmt"
	"strings"
)

type OverlapWFCNode struct {
	N        int
	Patterns [][]byte
	Weights  []float64
	Prop     [][][]int
	Allowed  map[byte][]bool
	Values   string
	Waves    map[byte]string
	Children []Node
	Tries    int
	Done     bool
}

type waveState struct {
	Data       [][]bool
	Compatible [][][]int
	Sums       []int
}

func parseOverlapWFCNode(x xmlNode, parent *Model, opts ParseOptions, folder string) (Node, error) {
	values := strings.ReplaceAll(attr(x.Attrs, "values"), " ", "")
	if values == "" {
		return nil, fmt.Errorf("wfc values is required")
	}
	name := attr(x.Attrs, "sample")
	sampleImage, err := loadSampleImage(opts, name)
	if err != nil {
		return nil, err
	}
	sample, colorCount := ords(sampleImage.Data)
	if colorCount > len(values) {
		return nil, fmt.Errorf("there were more than %d colors in the sample", len(values))
	}
	n := intAttr(x.Attrs, "n", 3)
	periodicInput := boolAttr(x.Attrs, "periodicInput", true)
	node := &OverlapWFCNode{N: n, Values: values, Waves: map[byte]string{}, Allowed: map[byte][]bool{}, Tries: intAttr(x.Attrs, "tries", 1000)}
	for i := 0; i < len(values); i++ {
		node.Waves[values[i]] = string(values[i])
	}
	node.Waves['*'] = values
	collectUnions(x, node.Waves)
	if err := node.buildPatterns(sample, sampleImage.W, sampleImage.H, colorCount, periodicInput); err != nil {
		return nil, err
	}
	mapModel := &Model{Values: values, Waves: node.Waves}
	for _, child := range x.Nodes {
		switch child.XMLName.Local {
		case "rule":
			in := attr(child.Attrs, "in")
			out := attr(child.Attrs, "out")
			if len(in) != 1 || out == "" {
				return nil, fmt.Errorf("wfc rule requires one-character in and non-empty out")
			}
			parentIndex, ok := indexOfValue(parent.Values, in[0])
			if !ok {
				return nil, fmt.Errorf("wfc rule input %q is not in parent values", in[0])
			}
			allowedOutputs := map[byte]bool{}
			for _, part := range strings.Split(out, "|") {
				if part == "" {
					continue
				}
				idx, ok := indexOfValue(values, part[0])
				if !ok {
					return nil, fmt.Errorf("wfc rule output %q is not in wfc values", part[0])
				}
				allowedOutputs[idx] = true
			}
			allowed := make([]bool, len(node.Patterns))
			for p, pattern := range node.Patterns {
				allowed[p] = allowedOutputs[pattern[0]]
			}
			node.Allowed[parentIndex] = allowed
		case "union", "observe":
			continue
		default:
			n, err := parseNode(child, mapModel, opts, folder, []bool{true, true, true, true, true, true, true, true})
			if err != nil {
				return nil, err
			}
			node.Children = append(node.Children, n)
		}
	}
	return node, nil
}

func (n *OverlapWFCNode) Type() string { return "wfc" }
func (n *OverlapWFCNode) Reset() {
	for _, child := range n.Children {
		child.Reset()
	}
}
func (n *OverlapWFCNode) Features(out map[string]bool) {
	out["wfc"] = true
	out["wfc.overlap"] = true
	for _, child := range n.Children {
		child.Features(out)
	}
}

func (n *OverlapWFCNode) Step(g *Grid, rng *RNG) (bool, error) {
	if n.Done {
		return false, nil
	}
	if g.D != 1 {
		return false, fmt.Errorf("overlap wfc currently works only for 2d")
	}
	result, err := n.solve(g, rng)
	if err != nil {
		return false, err
	}
	for _, child := range n.Children {
		for {
			changed, err := child.Step(result, rng)
			if err != nil {
				return false, err
			}
			if !changed {
				break
			}
		}
	}
	*g = *result
	n.Done = true
	return true, nil
}

func (n *OverlapWFCNode) buildPatterns(sample []byte, sw, sh, colors int, periodicInput bool) error {
	if n.N <= 0 || n.N > sw || n.N > sh {
		return fmt.Errorf("invalid overlap wfc n %d", n.N)
	}
	weights := map[int]int{}
	ordering := make([]int, 0)
	ymax, xmax := sh, sw
	if !periodicInput {
		ymax, xmax = sh-n.N+1, sw-n.N+1
	}
	for y := 0; y < ymax; y++ {
		for x := 0; x < xmax; x++ {
			pattern := make([]byte, n.N*n.N)
			for dy := 0; dy < n.N; dy++ {
				for dx := 0; dx < n.N; dx++ {
					pattern[dx+dy*n.N] = sample[wrap(x+dx, sw)+wrap(y+dy, sh)*sw]
				}
			}
			for _, p := range bytePatternSymmetries(pattern, n.N) {
				idx := bytePatternIndex(p, colors)
				if _, ok := weights[idx]; !ok {
					ordering = append(ordering, idx)
				}
				weights[idx]++
			}
		}
	}
	n.Patterns = make([][]byte, len(ordering))
	n.Weights = make([]float64, len(ordering))
	for i, idx := range ordering {
		n.Patterns[i] = patternFromIndex(idx, colors, n.N*n.N)
		n.Weights[i] = float64(weights[idx])
	}
	n.Prop = make([][][]int, 4)
	for d := 0; d < 4; d++ {
		n.Prop[d] = make([][]int, len(n.Patterns))
		for t := range n.Patterns {
			for t2 := range n.Patterns {
				if overlapAgrees(n.Patterns[t], n.Patterns[t2], n.N, []int{1, 0, -1, 0}[d], []int{0, 1, 0, -1}[d]) {
					n.Prop[d][t] = append(n.Prop[d][t], t2)
				}
			}
		}
	}
	return nil
}

func (n *OverlapWFCNode) solve(g *Grid, rng *RNG) (*Grid, error) {
	start := n.newWave(g.W * g.H)
	for i, value := range g.State {
		if allowed, ok := n.Allowed[value]; ok {
			for p := range allowed {
				if !allowed[p] {
					start.Data[i][p] = false
				}
			}
		}
	}
	if !n.propagateAndCheck(start, g.W, g.H) {
		return nil, fmt.Errorf("initial conditions are contradictive")
	}
	tries := n.Tries
	if tries <= 0 {
		tries = 1000
	}
	for t := 0; t < tries; t++ {
		w := cloneWave(start)
		if n.runWave(w, g.W, g.H, rng) {
			return n.gridFromWave(w, g.W, g.H)
		}
	}
	return nil, fmt.Errorf("wfc failed to find a solution in %d tries", tries)
}

func (n *OverlapWFCNode) runWave(w *waveState, width, height int, rng *RNG) bool {
	for {
		node := n.nextUnobserved(w, width, height, rng)
		if node < 0 {
			return true
		}
		choice := n.weightedChoice(w.Data[node], rng)
		for p := range w.Data[node] {
			w.Data[node][p] = p == choice
		}
		if !n.propagateAndCheck(w, width, height) {
			return false
		}
	}
}

func (n *OverlapWFCNode) newWave(size int) *waveState {
	w := &waveState{Data: make([][]bool, size), Sums: make([]int, size)}
	for i := range w.Data {
		w.Data[i] = make([]bool, len(n.Patterns))
		for p := range w.Data[i] {
			w.Data[i][p] = true
		}
		w.Sums[i] = len(n.Patterns)
	}
	return w
}

func cloneWave(src *waveState) *waveState {
	out := &waveState{Data: make([][]bool, len(src.Data)), Sums: append([]int(nil), src.Sums...)}
	for i := range src.Data {
		out.Data[i] = append([]bool(nil), src.Data[i]...)
	}
	return out
}

func (n *OverlapWFCNode) propagateAndCheck(w *waveState, width, height int) bool {
	dx := []int{1, 0, -1, 0}
	dy := []int{0, 1, 0, -1}
	changed := true
	for changed {
		changed = false
		for i, allowed := range w.Data {
			x, y := i%width, i/width
			for p, on := range allowed {
				if !on {
					continue
				}
				valid := true
				for d := 0; d < 4 && valid; d++ {
					nx, ny := wrap(x+dx[d], width), wrap(y+dy[d], height)
					neighbor := w.Data[nx+ny*width]
					hasCompatible := false
					for _, q := range n.Prop[d][p] {
						if neighbor[q] {
							hasCompatible = true
							break
						}
					}
					if !hasCompatible {
						valid = false
					}
				}
				if !valid {
					allowed[p] = false
					changed = true
				}
			}
		}
	}
	for i := range w.Data {
		count := 0
		for _, on := range w.Data[i] {
			if on {
				count++
			}
		}
		w.Sums[i] = count
		if count == 0 {
			return false
		}
	}
	return true
}

func (n *OverlapWFCNode) nextUnobserved(w *waveState, width, height int, rng *RNG) int {
	min := 1 << 30
	arg := -1
	for i, count := range w.Sums {
		if count > 1 && count <= min {
			if count < min || rng.Intn(2) == 0 {
				min = count
				arg = i
			}
		}
	}
	_ = width
	_ = height
	return arg
}

func (n *OverlapWFCNode) weightedChoice(allowed []bool, rng *RNG) int {
	total := 0.0
	for p, on := range allowed {
		if on {
			total += n.Weights[p]
		}
	}
	r := rng.Float64() * total
	for p, on := range allowed {
		if !on {
			continue
		}
		r -= n.Weights[p]
		if r <= 0 {
			return p
		}
	}
	for p, on := range allowed {
		if on {
			return p
		}
	}
	return 0
}

func (n *OverlapWFCNode) gridFromWave(w *waveState, width, height int) (*Grid, error) {
	g, err := NewGrid(width, height, n.Values)
	if err != nil {
		return nil, err
	}
	for ch, wave := range n.Waves {
		g.Waves[ch] = wave
	}
	votes := make([][]int, width*height)
	for i := range votes {
		votes[i] = make([]int, len(n.Values))
	}
	for i, allowed := range w.Data {
		x, y := i%width, i/width
		for p, on := range allowed {
			if !on {
				continue
			}
			pattern := n.Patterns[p]
			for dy := 0; dy < n.N; dy++ {
				for dx := 0; dx < n.N; dx++ {
					xx, yy := wrap(x+dx, width), wrap(y+dy, height)
					votes[xx+yy*width][pattern[dx+dy*n.N]]++
				}
			}
		}
	}
	for i, vote := range votes {
		best := 0
		for c := 1; c < len(vote); c++ {
			if vote[c] > vote[best] {
				best = c
			}
		}
		g.State[i] = byte(best)
	}
	return g, nil
}

func ords(data []uint32) ([]byte, int) {
	uniques := make([]uint32, 0)
	out := make([]byte, len(data))
	for i, value := range data {
		ord := -1
		for j, known := range uniques {
			if known == value {
				ord = j
				break
			}
		}
		if ord < 0 {
			ord = len(uniques)
			uniques = append(uniques, value)
		}
		out[i] = byte(ord)
	}
	return out, len(uniques)
}

func bytePatternSymmetries(pattern []byte, n int) [][]byte {
	seen := map[string]bool{}
	out := make([][]byte, 0, 8)
	cur := append([]byte(nil), pattern...)
	for i := 0; i < 4; i++ {
		addBytePattern(&out, seen, cur)
		addBytePattern(&out, seen, reflectBytePattern(cur, n))
		cur = rotateBytePattern(cur, n)
	}
	return out
}

func addBytePattern(out *[][]byte, seen map[string]bool, pattern []byte) {
	key := string(pattern)
	if seen[key] {
		return
	}
	seen[key] = true
	*out = append(*out, append([]byte(nil), pattern...))
}

func rotateBytePattern(pattern []byte, n int) []byte {
	out := make([]byte, len(pattern))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			out[x+y*n] = pattern[n-1-y+x*n]
		}
	}
	return out
}

func reflectBytePattern(pattern []byte, n int) []byte {
	out := make([]byte, len(pattern))
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			out[x+y*n] = pattern[n-1-x+y*n]
		}
	}
	return out
}

func bytePatternIndex(pattern []byte, colors int) int {
	idx := 0
	for _, v := range pattern {
		idx = idx*colors + int(v)
	}
	return idx
}

func patternFromIndex(idx, colors, length int) []byte {
	out := make([]byte, length)
	for i := length - 1; i >= 0; i-- {
		out[i] = byte(idx % colors)
		idx /= colors
	}
	return out
}

func overlapAgrees(a, b []byte, n, dx, dy int) bool {
	xmin, xmax := 0, n
	ymin, ymax := 0, n
	if dx < 0 {
		xmax = dx + n
	} else {
		xmin = dx
	}
	if dy < 0 {
		ymax = dy + n
	} else {
		ymin = dy
	}
	for y := ymin; y < ymax; y++ {
		for x := xmin; x < xmax; x++ {
			if a[x+y*n] != b[x-dx+(y-dy)*n] {
				return false
			}
		}
	}
	return true
}
