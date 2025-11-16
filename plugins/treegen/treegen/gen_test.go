package treegen_test

import (
	"math/rand"
	"testing"

	"github.com/justgook/gamectl/plugins/treegen/treegen"
)

func TestGenerateTree(t *testing.T) {

	tests := []struct {
		name string // description of this test case
		// Named input parameters for target function.
		rng       treegen.Random
		cfg       *treegen.GenerateTreeConfig
		wantNodes int
	}{
		{
			name: "single node",
			rng:  rand.New(rand.NewSource(42)),
			cfg: &treegen.GenerateTreeConfig{
				NodeCount:    1,
				MaxDepth:     10,
				MaxBranching: 10,
				MinBranching: 1,
				ShapeBias:    0.55,
				Density:      0.8,
				RootBranches: 0,
				LeafRatio:    0.2,
			},
			wantNodes: 1,
		},
		{
			name: "2 nodes",
			rng:  rand.New(rand.NewSource(42)),
			cfg: &treegen.GenerateTreeConfig{
				NodeCount:    2,
				MaxDepth:     10,
				MaxBranching: 10,
				MinBranching: 1,
				ShapeBias:    0.55,
				Density:      0.8,
				RootBranches: 0,
				LeafRatio:    0.2,
			},
			wantNodes: 2,
		},
		{
			name: "3 nodes",
			rng:  rand.New(rand.NewSource(42)),
			cfg: &treegen.GenerateTreeConfig{
				NodeCount:    3,
				MaxDepth:     10,
				MaxBranching: 10,
				MinBranching: 1,
				ShapeBias:    0.55,
				Density:      0.8,
				RootBranches: 0,
				LeafRatio:    0.2,
			},
			wantNodes: 3,
		},

		{
			name: "100 nodes",
			rng:  rand.New(rand.NewSource(42)),
			cfg: &treegen.GenerateTreeConfig{
				NodeCount:    100,
				MaxDepth:     10,
				MaxBranching: 10,
				MinBranching: 1,
				ShapeBias:    0.55,
				Density:      0.8,
				RootBranches: 0,
				LeafRatio:    0.2,
			},
			wantNodes: 100,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := treegen.GenerateTree(tt.rng, tt.cfg)
			// TODO: update the condition below to compare got with tt.want.
			if len(got) != tt.wantNodes {
				t.Errorf("GenerateTree() = %v, want %v", len(got), tt.wantNodes)
			}
		})
	}
}
