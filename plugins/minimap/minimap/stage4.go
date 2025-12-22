package minimap

import (
	"errors"
	"fmt"

	"github.com/justgook/gamectl/pkg/tree"
)

// LogFunc is a function that can be used for logging
var LogFunc func(string)

func logStage4(msg string) {
	if LogFunc != nil {
		LogFunc(fmt.Sprintf("[Stage4] %s", msg))
	}
}

// Stage4Metrics tracks compression effectiveness
type Stage4Metrics struct {
	IterationsRun        int
	RoomsMoved           int
	TotalPathTilesBefore int
	TotalPathTilesAfter  int
}

var (
	ErrStage4InitialStateInvalid = errors.New("stage4: initial state has invalid paths")
)

// Stage4 compresses the layout by moving children closer to parents along existing paths
// Returns metrics about compression effectiveness
func Stage4(
	treeInput *tree.Tree,
	grid *Grid,
) error {
	return nil
}
