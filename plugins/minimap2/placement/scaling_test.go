package placement

import (
	"fmt"
	"testing"

	"github.com/justgook/gams/sdk/go/tree"
)

func TestScalingDetailed(t *testing.T) {
	count := 70

	for seed := int64(0); seed < 5; seed++ {
		t.Run(fmt.Sprintf("seed_%d", seed), func(t *testing.T) {
			rng := NewRealRandom(seed)
			tr := generateRandomTree(count, rng)

			gen := NewGenerator(tr, func(node *tree.Node) (RoomShape, error) {
				return testRoomShapes[rng.Intn(len(testRoomShapes))], nil
			}, rng)

			placement, err := gen.Generate()
			if err != nil {
				t.Logf("Failed at seed %d: %v", seed, err)
				t.Logf("Placed %d rooms before failure", len(gen.Placement.Rooms))
				t.Logf("Unfinished rooms: %d", len(gen.Placement.Unfinished))

				// Count forced tiles
				forcedCount := len(gen.Constraints.ForcedTiles)
				t.Logf("Forced tiles: %d", forcedCount)

				// Show conflicting rooms
				for tile, rooms := range gen.Constraints.ForcedTiles {
					if len(rooms) > 1 {
						roomList := make([]RoomID, 0)
						for r := range rooms {
							roomList = append(roomList, r)
						}
						t.Logf("Conflict at %v: rooms %v", tile, roomList)
					}
				}
			} else {
				t.Logf("Success! Placed %d rooms", len(placement.Rooms))
			}
		})
	}
}

func TestScaling(t *testing.T) {
	roomCounts := []int{30, 40, 50, 60, 70, 80, 90, 100}

	for _, count := range roomCounts {
		t.Run(fmt.Sprintf("rooms_%d", count), func(t *testing.T) {
			successes := 0
			attempts := 10

			for seed := int64(0); seed < int64(attempts); seed++ {
				rng := NewRealRandom(seed)
				tr := generateRandomTree(count, rng)

				gen := NewGenerator(tr, func(node *tree.Node) (RoomShape, error) {
					return testRoomShapes[rng.Intn(len(testRoomShapes))], nil
				}, rng)

				_, err := gen.Generate()
				if err == nil {
					successes++
				}
			}

			successRate := float64(successes) / float64(attempts) * 100
			t.Logf("%d rooms: %d/%d (%.0f%%)", count, successes, attempts, successRate)

			if successRate < 80 {
				t.Errorf("Success rate too low: %.0f%%", successRate)
			}
		})
	}
}
