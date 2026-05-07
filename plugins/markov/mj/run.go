package mj

import "fmt"

type RNG struct{ state uint64 }

func NewRNG(seed uint64) *RNG {
	if seed == 0 {
		seed = 1
	}
	return &RNG{state: seed}
}

func (r *RNG) Next() uint64 {
	r.state = r.state*6364136223846793005 + 1442695040888963407
	return r.state
}

func (r *RNG) Intn(n int) int {
	if n <= 0 {
		return 0
	}
	return int(r.Next() % uint64(n))
}

type RunOptions struct {
	Width        int
	Height       int
	Seed         uint64
	Steps        int
	InitialCells string
}

type RunResult struct {
	OK       bool   `json:"ok"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Depth    int    `json:"depth"`
	Values   string `json:"values"`
	Cells    string `json:"cells"`
	StepsRun int    `json:"stepsRun"`
	Changed  int    `json:"changed"`
}

func Run(model *Model, opts RunOptions) (*RunResult, error) {
	if opts.Steps <= 0 {
		opts.Steps = 50000
	}
	g, err := NewGrid(opts.Width, opts.Height, model.Values)
	if err != nil {
		return nil, err
	}
	if opts.InitialCells != "" {
		if err := g.EncodeRows(opts.InitialCells); err != nil {
			return nil, err
		}
	} else if model.Origin {
		g.SetOrigin()
	}
	rng := NewRNG(opts.Seed)
	changedCount := 0
	stepsRun := 0
	for ; stepsRun < opts.Steps; stepsRun++ {
		changed, err := model.Root.Step(g, rng)
		if err != nil {
			return nil, err
		}
		if !changed {
			break
		}
		changedCount++
	}
	return &RunResult{OK: true, Width: g.W, Height: g.H, Depth: 1, Values: g.Values, Cells: g.DecodeRows(), StepsRun: stepsRun, Changed: changedCount}, nil
}

type InspectResult struct {
	OK       bool            `json:"ok"`
	Values   string          `json:"values"`
	Origin   bool            `json:"origin"`
	Features map[string]bool `json:"features"`
}

func Inspect(model *Model) InspectResult {
	features := map[string]bool{}
	model.Root.Features(features)
	return InspectResult{OK: true, Values: model.Values, Origin: model.Origin, Features: features}
}

func Validate(model *Model) error {
	if model == nil || model.Root == nil {
		return fmt.Errorf("model/root is nil")
	}
	if model.Values == "" {
		return fmt.Errorf("model values is empty")
	}
	return nil
}
