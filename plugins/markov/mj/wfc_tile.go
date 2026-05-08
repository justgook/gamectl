package mj

import (
	"encoding/xml"
	"fmt"
	"path"
	"strings"
)

type tilesetXML struct {
	FullSymmetry bool          `xml:"fullSymmetry,attr"`
	Tiles        []tileXML     `xml:"tiles>tile"`
	Neighbors    []neighborXML `xml:"neighbors>neighbor"`
}
type tileXML struct {
	Name   string  `xml:"name,attr"`
	Weight float64 `xml:"weight,attr"`
}
type neighborXML struct {
	Left   string `xml:"left,attr"`
	Right  string `xml:"right,attr"`
	Top    string `xml:"top,attr"`
	Bottom string `xml:"bottom,attr"`
}

type TileWFCNode struct {
	Values       string
	Waves        map[byte]string
	Tiles        [][]byte
	Weights      []float64
	Prop         [][][]int
	Allowed      map[byte][]bool
	Children     []Node
	S, SZ        int
	Overlap      int
	OverlapZ     int
	Tries        int
	Periodic     bool
	Done         bool
	OutputWidth  int
	OutputHeight int
	OutputDepth  int
}

func parseTileWFCNode(x xmlNode, parent *Model, opts ParseOptions, folder string) (Node, error) {
	name := attr(x.Attrs, "tileset")
	values := strings.ReplaceAll(attr(x.Attrs, "values"), " ", "")
	if values == "" {
		return nil, fmt.Errorf("tile wfc values is required")
	}
	data, err := opts.ReadFile(path.Join(opts.ResourceRoot, "resources", "tilesets", name+".xml"))
	if err != nil {
		return nil, err
	}
	var tx tilesetXML
	if err := xml.Unmarshal(data, &tx); err != nil {
		return nil, err
	}
	tilesDir := attr(x.Attrs, "tiles")
	if tilesDir == "" {
		tilesDir = name
	}
	node := &TileWFCNode{Values: values, Waves: map[byte]string{}, Allowed: map[byte][]bool{}, Tries: intAttr(x.Attrs, "tries", 1000), Periodic: boolAttr(x.Attrs, "periodic", false), Overlap: intAttr(x.Attrs, "overlap", 0), OverlapZ: intAttr(x.Attrs, "overlapz", 0)}
	for i := 0; i < len(values); i++ {
		node.Waves[values[i]] = string(values[i])
	}
	node.Waves['*'] = values
	collectUnions(x, node.Waves)
	if err := node.loadTiles(opts, tilesDir, tx.Tiles); err != nil {
		return nil, err
	}
	positions := node.tilePositions(tx.Tiles)
	node.buildPropagator(tx.Neighbors, positions)
	mapModel := &Model{Values: values, Waves: node.Waves}
	for _, child := range x.Nodes {
		switch child.XMLName.Local {
		case "rule":
			in, out := attr(child.Attrs, "in"), attr(child.Attrs, "out")
			if len(in) != 1 || out == "" {
				return nil, fmt.Errorf("tile wfc rule requires in/out")
			}
			pi, ok := indexOfValue(parent.Values, in[0])
			if !ok {
				return nil, fmt.Errorf("tile wfc input %q not in parent values", in[0])
			}
			allowed := make([]bool, len(node.Tiles))
			for _, part := range strings.Split(out, "|") {
				for _, idx := range positions[lastToken(part)] {
					allowed[idx] = true
				}
			}
			node.Allowed[pi] = allowed
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

func (n *TileWFCNode) Type() string { return "wfc" }
func (n *TileWFCNode) Reset() {
	for _, child := range n.Children {
		child.Reset()
	}
}
func (n *TileWFCNode) Features(out map[string]bool) {
	out["wfc"] = true
	out["wfc.tile"] = true
	for _, child := range n.Children {
		child.Features(out)
	}
}

func (n *TileWFCNode) Step(g *Grid, rng *RNG) (bool, error) {
	if n.Done {
		return false, nil
	}
	wave := n.newTileWave(g)
	if !n.propagateTile(wave, g.W, g.H, g.D) {
		return false, fmt.Errorf("tile wfc initial conditions are contradictive")
	}
	tries := n.Tries
	if tries <= 0 {
		tries = 1000
	}
	var solved *waveState
	for i := 0; i < tries; i++ {
		w := cloneWave(wave)
		if n.runTileWave(w, g.W, g.H, g.D, rng) {
			solved = w
			break
		}
	}
	if solved == nil {
		return false, fmt.Errorf("tile wfc failed to find a solution in %d tries", tries)
	}
	out, err := n.gridFromTileWave(solved, g.W, g.H, g.D)
	if err != nil {
		return false, err
	}
	for _, child := range n.Children {
		for {
			changed, err := child.Step(out, rng)
			if err != nil {
				return false, err
			}
			if !changed {
				break
			}
		}
	}
	*g = *out
	n.Done = true
	return true, nil
}

func (n *TileWFCNode) loadTiles(opts ParseOptions, tilesDir string, tiles []tileXML) error {
	uniques := make([]uint32, 0)
	baseVariants := map[string][]int{}
	for _, t := range tiles {
		vox, err := loadVox(opts, "resources", "tilesets", tilesDir, t.Name+".vox")
		if err != nil {
			return err
		}
		if n.S == 0 {
			n.S, n.SZ = vox.W, vox.D
		} else if vox.W != n.S || vox.H != n.S || vox.D != n.SZ {
			return fmt.Errorf("tile %s dimensions mismatch", t.Name)
		}
		flat := make([]byte, len(vox.Data))
		for i, c := range vox.Data {
			ord := indexUint32(uniques, c)
			if ord < 0 {
				ord = len(uniques)
				uniques = append(uniques, c)
			}
			flat[i] = byte(ord)
		}
		variants := byteTileSymmetries2D(flat, n.S, n.SZ)
		for _, v := range variants {
			n.Tiles = append(n.Tiles, v)
			weight := t.Weight
			if weight == 0 {
				weight = 1
			}
			n.Weights = append(n.Weights, weight)
			baseVariants[t.Name] = append(baseVariants[t.Name], len(n.Tiles)-1)
		}
	}
	if len(uniques) > len(n.Values) {
		return fmt.Errorf("there were more than %d colors in vox files", len(n.Values))
	}
	_ = baseVariants
	return nil
}

func (n *TileWFCNode) tilePositions(tiles []tileXML) map[string][]int {
	positions := map[string][]int{}
	cursor := 0
	for _, t := range tiles {
		count := len(byteTileSymmetries2D(n.Tiles[cursor], n.S, n.SZ))
		if count <= 0 {
			count = 1
		}
		for i := 0; cursor+i < len(n.Tiles) && i < count; i++ {
			positions[t.Name] = append(positions[t.Name], cursor+i)
		}
		cursor += count
	}
	return positions
}

func (n *TileWFCNode) buildPropagator(neighbors []neighborXML, positions map[string][]int) {
	p := len(n.Tiles)
	allowed := make([][][]bool, 6)
	for d := range allowed {
		allowed[d] = make([][]bool, p)
		for i := range allowed[d] {
			allowed[d][i] = make([]bool, p)
		}
	}
	for _, nb := range neighbors {
		if nb.Left != "" && nb.Right != "" {
			for _, l := range positions[lastToken(nb.Left)] {
				for _, r := range positions[lastToken(nb.Right)] {
					allowed[0][l][r] = true
					allowed[2][r][l] = true
				}
			}
		}
		if nb.Top != "" && nb.Bottom != "" {
			for _, b := range positions[lastToken(nb.Bottom)] {
				for _, t := range positions[lastToken(nb.Top)] {
					allowed[4][b][t] = true
					allowed[5][t][b] = true
				}
			}
		}
	}
	// If vertical/other directions are unspecified, allow all.
	for a := 0; a < p; a++ {
		for b := 0; b < p; b++ {
			allowed[1][a][b] = true
			allowed[3][a][b] = true
			if n.SZ == 1 {
				allowed[4][a][b] = true
				allowed[5][a][b] = true
			}
		}
	}
	n.Prop = make([][][]int, 6)
	for d := range n.Prop {
		n.Prop[d] = make([][]int, p)
		for a := 0; a < p; a++ {
			for b := 0; b < p; b++ {
				if allowed[d][a][b] {
					n.Prop[d][a] = append(n.Prop[d][a], b)
				}
			}
		}
	}
}

func (n *TileWFCNode) newTileWave(g *Grid) *waveState {
	w := &waveState{Data: make([][]bool, len(g.State)), Sums: make([]int, len(g.State))}
	for i, v := range g.State {
		w.Data[i] = make([]bool, len(n.Tiles))
		allowed := n.Allowed[v]
		for p := range w.Data[i] {
			w.Data[i][p] = allowed == nil || allowed[p]
			if w.Data[i][p] {
				w.Sums[i]++
			}
		}
	}
	return w
}

func (n *TileWFCNode) runTileWave(w *waveState, width, height, depth int, rng *RNG) bool {
	for {
		i := nextGenericUnobserved(w, rng)
		if i < 0 {
			return true
		}
		choice := n.weightedTileChoice(w.Data[i], rng)
		for p := range w.Data[i] {
			w.Data[i][p] = p == choice
		}
		if !n.propagateTile(w, width, height, depth) {
			return false
		}
	}
}

func (n *TileWFCNode) propagateTile(w *waveState, width, height, depth int) bool {
	dx := []int{1, 0, -1, 0, 0, 0}
	dy := []int{0, 1, 0, -1, 0, 0}
	dz := []int{0, 0, 0, 0, 1, -1}
	changed := true
	for changed {
		changed = false
		for i, data := range w.Data {
			x, y, z := i%width, (i%(width*height))/width, i/(width*height)
			for p, on := range data {
				if !on {
					continue
				}
				valid := true
				for d := 0; d < 6 && valid; d++ {
					nx, ny, nz := x+dx[d], y+dy[d], z+dz[d]
					if n.Periodic {
						nx, ny, nz = wrap(nx, width), wrap(ny, height), wrap(nz, depth)
					} else if nx < 0 || ny < 0 || nz < 0 || nx >= width || ny >= height || nz >= depth {
						continue
					}
					neighbor := w.Data[nx+ny*width+nz*width*height]
					has := false
					for _, q := range n.Prop[d][p] {
						if neighbor[q] {
							has = true
							break
						}
					}
					if !has {
						valid = false
					}
				}
				if !valid {
					data[p] = false
					changed = true
				}
			}
		}
	}
	for i := range w.Data {
		w.Sums[i] = 0
		for _, on := range w.Data[i] {
			if on {
				w.Sums[i]++
			}
		}
		if w.Sums[i] == 0 {
			return false
		}
	}
	return true
}

func (n *TileWFCNode) gridFromTileWave(w *waveState, width, height, depth int) (*Grid, error) {
	outW := (n.S-n.Overlap)*width + n.Overlap
	outH := (n.S-n.Overlap)*height + n.Overlap
	outD := (n.SZ-n.OverlapZ)*depth + n.OverlapZ
	g, err := NewGrid3D(outW, outH, outD, n.Values)
	if err != nil {
		return nil, err
	}
	for ch, wave := range n.Waves {
		g.Waves[ch] = wave
	}
	for z := 0; z < depth; z++ {
		for y := 0; y < height; y++ {
			for x := 0; x < width; x++ {
				i := x + y*width + z*width*height
				choice := firstAllowed(w.Data[i])
				tile := n.Tiles[choice]
				for dz := 0; dz < n.SZ; dz++ {
					for dy := 0; dy < n.S; dy++ {
						for dx := 0; dx < n.S; dx++ {
							sx := x*(n.S-n.Overlap) + dx
							sy := y*(n.S-n.Overlap) + dy
							sz := z*(n.SZ-n.OverlapZ) + dz
							g.State[sx+sy*g.W+sz*g.W*g.H] = tile[dx+dy*n.S+dz*n.S*n.S]
						}
					}
				}
			}
		}
	}
	return g, nil
}

func nextGenericUnobserved(w *waveState, rng *RNG) int {
	best := 1 << 30
	arg := -1
	for i, c := range w.Sums {
		if c > 1 && c <= best {
			if c < best || rng.Intn(2) == 0 {
				best, arg = c, i
			}
		}
	}
	return arg
}

func (n *TileWFCNode) weightedTileChoice(allowed []bool, rng *RNG) int {
	total := 0.0
	for p, on := range allowed {
		if on {
			total += n.Weights[p]
		}
	}
	r := rng.Float64() * total
	for p, on := range allowed {
		if on {
			r -= n.Weights[p]
			if r <= 0 {
				return p
			}
		}
	}
	return firstAllowed(allowed)
}

func firstAllowed(allowed []bool) int {
	for i, on := range allowed {
		if on {
			return i
		}
	}
	return 0
}

func byteTileSymmetries2D(tile []byte, s, sz int) [][]byte {
	seen := map[string]bool{}
	out := make([][]byte, 0, 8)
	cur := append([]byte(nil), tile...)
	for i := 0; i < 4; i++ {
		addTileVariant(&out, seen, cur)
		addTileVariant(&out, seen, reflectTileX(cur, s, sz))
		cur = rotateTileZ(cur, s, sz)
	}
	return out
}

func addTileVariant(out *[][]byte, seen map[string]bool, tile []byte) {
	key := string(tile)
	if seen[key] {
		return
	}
	seen[key] = true
	*out = append(*out, append([]byte(nil), tile...))
}

func rotateTileZ(tile []byte, s, sz int) []byte {
	out := make([]byte, len(tile))
	for z := 0; z < sz; z++ {
		for y := 0; y < s; y++ {
			for x := 0; x < s; x++ {
				out[x+y*s+z*s*s] = tile[y+(s-1-x)*s+z*s*s]
			}
		}
	}
	return out
}

func reflectTileX(tile []byte, s, sz int) []byte {
	out := make([]byte, len(tile))
	for z := 0; z < sz; z++ {
		for y := 0; y < s; y++ {
			for x := 0; x < s; x++ {
				out[x+y*s+z*s*s] = tile[s-1-x+y*s+z*s*s]
			}
		}
	}
	return out
}

func indexUint32(values []uint32, value uint32) int {
	for i, v := range values {
		if v == value {
			return i
		}
	}
	return -1
}

func lastToken(s string) string {
	parts := strings.Fields(s)
	if len(parts) == 0 {
		return ""
	}
	return parts[len(parts)-1]
}
