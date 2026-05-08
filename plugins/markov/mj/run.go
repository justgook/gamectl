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

func (r *RNG) Float64() float64 {
	return float64(r.Next()>>11) / (1 << 53)
}

type RunOptions struct {
	Width        int
	Height       int
	Depth        int
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
	Done     bool   `json:"done"`
}

type Runner struct {
	Model    *Model
	Grid     *Grid
	RNG      *RNG
	StepsRun int
	Changed  int
	Done     bool
}

func NewRunner(model *Model, opts RunOptions) (*Runner, error) {
	if opts.Depth <= 0 {
		opts.Depth = 1
	}
	g, err := NewGrid3D(opts.Width, opts.Height, opts.Depth, model.Values)
	if err != nil {
		return nil, err
	}
	for ch, wave := range model.Waves {
		g.Waves[ch] = wave
	}
	if opts.InitialCells != "" {
		if err := g.EncodeRows(opts.InitialCells); err != nil {
			return nil, err
		}
	} else if model.Origin {
		g.SetOrigin()
	}
	return &Runner{Model: model, Grid: g, RNG: NewRNG(opts.Seed)}, nil
}

func (r *Runner) Step(steps int) (*RunResult, error) {
	if steps <= 0 {
		steps = 1
	}
	if r.Done {
		return r.Snapshot(), nil
	}
	for i := 0; i < steps; i++ {
		changed, err := r.Model.Root.Step(r.Grid, r.RNG)
		if err != nil {
			return nil, err
		}
		if !changed {
			r.Done = true
			break
		}
		r.StepsRun++
		r.Changed++
	}
	return r.Snapshot(), nil
}

func (r *Runner) Snapshot() *RunResult {
	return &RunResult{OK: true, Width: r.Grid.W, Height: r.Grid.H, Depth: r.Grid.D, Values: r.Grid.Values, Cells: r.Grid.DecodeRows(), StepsRun: r.StepsRun, Changed: r.Changed, Done: r.Done}
}

func Run(model *Model, opts RunOptions) (*RunResult, error) {
	if opts.Steps <= 0 {
		opts.Steps = 50000
	}
	runner, err := NewRunner(model, opts)
	if err != nil {
		return nil, err
	}
	return runner.Step(opts.Steps)
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
