//go:generate go tool wit-bindgen-go generate --world generator --out internal ./gams:tree-generator@1.0.0.wasm

package main

import (
	"math/bits"
	"sort"

	gamstree "github.com/kkgams/sdk/go/tree"
	treegenerator "github.com/kkgams/treegen/internal/gams/tree-generator/tree-generator"
	wasirandom "github.com/kkgams/treegen/internal/wasi/random/random"
	"github.com/kkgams/treegen/treegen"
	"go.bytecodealliance.org/cm"
)

type WASIRandom struct{}

func (rng *WASIRandom) Float64() float64 {
	// Match math/rand.Float64's range: [0.0, 1.0).
	return float64(wasirandom.GetRandomU64()>>11) * (1.0 / (1 << 53))
}

func (rng *WASIRandom) Intn(n int) int {
	if n <= 0 {
		panic("WASIRandom.Intn: non-positive bound")
	}
	bound := uint64(n)
	for {
		// Fast unbiased reduction from a random u64 to [0, bound).
		// See Lemire, "Fast Random Integer Generation in an Interval".
		candidate, remainder := bits.Mul64(wasirandom.GetRandomU64(), bound)
		if remainder >= bound {
			return int(candidate)
		}

		threshold := -bound % bound
		if remainder >= threshold {
			return int(candidate)
		}
	}
}

func init() {
	treegenerator.Exports.Gen = func(config treegenerator.GenerateTreeConfig) cm.Result[treegenerator.Tree, treegenerator.Tree, string] {
		generated, err := treegen.GenerateTree(&WASIRandom{}, &treegen.GenerateTreeConfig{
			NodeCount:    int(config.NodeCount),
			MaxDepth:     int(config.MaxDepth),
			MaxBranching: int(config.MaxBranching),
			RootBranches: int(config.RootBranches),
		})
		if err != nil {
			return cm.Err[cm.Result[treegenerator.Tree, treegenerator.Tree, string]](err.Error())
		}

		return cm.OK[cm.Result[treegenerator.Tree, treegenerator.Tree, string]](toWITTree(generated))
	}
}

func toWITTree(t gamstree.Tree) treegenerator.Tree {
	nodes := make([]treegenerator.Node, len(t))
	for i, node := range t {
		nodes[i] = treegenerator.Node{
			Data:     toWITData(node.Data),
			ParentID: int32(node.ParentId),
		}
	}
	return treegenerator.Tree(cm.ToList(nodes))
}

func toWITData(data map[string]string) cm.List[treegenerator.DataEntry] {
	entries := make([]treegenerator.DataEntry, 0, len(data))
	keys := make([]string, 0, len(data))
	for key := range data {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		entries = append(entries, treegenerator.DataEntry{key, data[key]})
	}
	return cm.ToList(entries)
}

// main is required for the `wasi` target, even if it isn't used.
func main() {}
