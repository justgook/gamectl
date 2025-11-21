package treegen_test

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/plugins/treegen/treegen"
)

func TestGenerateTree(t *testing.T) {
	tests := []struct {
		name string // description of this test case
		// Named input parameters for target function.
		rng treegen.Random
		cfg *treegen.GenerateTreeConfig
	}{

		{
			name: "debug",
			rng:  rand.New(rand.NewSource(42)),
			cfg: &treegen.GenerateTreeConfig{
				NodeCount:    25,
				MaxBranching: 1,
				RootBranches: 0,
				MaxDepth:     0,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, gotErr := treegen.GenerateTree(tt.rng, tt.cfg)
			if gotErr != nil {
				t.Errorf("GenerateTree() failed: %v", gotErr)
				return
			}
			if tt.cfg.NodeCount != len(got) {
				t.Errorf("GenerateTree() failed: want:%d, got:%d", tt.cfg.NodeCount, len(got))
			}
			fmt.Println("got tree", treegen.PrettyJson(got))
		})
	}
}
