package treegen

import (
	"encoding/json"
	"fmt"
	"slices"

	"github.com/justgook/gamectl/pkg/tree"
)

type Random interface {
	Intn(n int) int
	Float64() float64
}

type GenerateTreeConfig struct {
	NodeCount    int `json:"nodeCount"`    // target node count (0 = unlimited)
	RootBranches int `json:"rootBranches"` // specific number of root children (0 = auto)
	MaxDepth     int `json:"maxDepth"`     // maximum tree depth (0 = unlimited)
	MaxBranching int `json:"maxBranching"` // maximum children per node (0 = unlimited)
}

func GenerateTree(rng Random, cfg *GenerateTreeConfig) (tree.Tree, error) {
	fmt.Println("====================================================================================================")
	defer fmt.Println("====================================================================================================")
	if cfg.NodeCount == 0 && cfg.MaxDepth == 0 {
		return nil, fmt.Errorf("MaxDepth or NodeCount should be not zero ")
	}

	t := tree.Tree{}
	t.Add(-1, nil)

	if len(t) >= cfg.NodeCount {
		return t, nil
	}
	fmt.Println("GenerateTree(1)")

	for range cfg.RootBranches {
		if len(t) >= cfg.NodeCount {
			return t, nil
		}

		t.Add(0, nil)
	}

	type Victim struct {
		Index  int
		Childs int
		Depth  int
	}

	canHaveChilds := make([]*Victim, 0)
	fmt.Println("GenerateTree(2)")

	for childId := range t {
		if parentId := slices.IndexFunc(canHaveChilds, func(a *Victim) bool { return a.Index == t[childId].ParentId }); parentId > -1 {
			canHaveChilds[parentId].Childs += 1
			if cfg.MaxBranching > 0 && canHaveChilds[parentId].Childs >= cfg.MaxBranching {
				canHaveChilds = slices.Delete(canHaveChilds, parentId, parentId+1)
			}
		}

		depth := calculateNodeDepth(&t, childId)
		if cfg.MaxDepth > 0 && depth >= cfg.MaxDepth {
			continue
		}

		canHaveChilds = append(canHaveChilds, &Victim{
			Index:  childId,
			Childs: 0,
			Depth:  depth,
		})
	}
	fmt.Println("GenerateTree(3)", PrettyJson(canHaveChilds))

	if len(canHaveChilds) < 1 {
		return t, nil
	}

	for range cfg.NodeCount - len(t) {
		parentId := 0
		if len(canHaveChilds) > 1 {
			parentId = rng.Intn(len(canHaveChilds))

		}

		childId := len(t) // lengh of tree will be next index after add
		t.Add(parentId, nil)
		canHaveChilds[parentId].Childs += 1
		if cfg.MaxBranching > 0 && canHaveChilds[parentId].Childs >= cfg.MaxBranching {
			canHaveChilds = slices.Delete(canHaveChilds, parentId, parentId+1)
			if len(canHaveChilds) < 1 {
				return t, nil
			}
		}

		depth := calculateNodeDepth(&t, childId)
		if cfg.MaxDepth > 0 && depth >= cfg.MaxDepth {
			continue
		}

		canHaveChilds = append(canHaveChilds, &Victim{
			Index:  childId,
			Childs: 0,
			Depth:  depth,
		})

	}

	return t, nil
}

// Calculate depth of a node by traversing up to root
func calculateNodeDepth(nodes *tree.Tree, nodeIdx int) int {
	depth := 1
	current := (*nodes)[nodeIdx]
	for current.ParentId >= 0 {
		current = (*nodes)[current.ParentId]
		depth++
	}
	return depth
}

func PrettyJson(input any) string {
	return string(Must(json.MarshalIndent(input, "", "  ")))
}

func Must[T any](x T, err error) T {
	if err != nil {
		panic(err)
	}

	return x
}
