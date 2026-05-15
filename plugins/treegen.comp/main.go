//go:generate go tool wit-bindgen-go generate --world generator --out internal ./gams:tree-generator@1.0.0.wasm

package main

import (
	treegenerator "github.com/kkgams/treegen/internal/gams/tree-generator/tree-generator"
	"github.com/kkgams/treegen/treegen"
	"go.bytecodealliance.org/cm"
)

type MyRandom struct{}

func (rng *MyRandom) Float64() float64 {
	return 6.66
}
func (rng *MyRandom) Intn(n int) int {
	return int(n)
}
func init() {
	treegenerator.Exports.Gen = func(config treegenerator.GenerateTreeConfig) (result cm.Result[treegenerator.Tree, treegenerator.Tree, string]) {
		_, _ = treegen.GenerateTree(&MyRandom{}, &treegen.GenerateTreeConfig{
			NodeCount:    int(config.NodeCount),
			MaxDepth:     int(config.MaxDepth),
			MaxBranching: int(config.MaxBranching),
			RootBranches: int(config.RootBranches),
		})
		return result

	}
}

// main is required for the `wasi` target, even if it isn't used.
func main() {}
