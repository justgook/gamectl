package main

// OccupiedTracker tracks written tiles for NoOverlappingOutput
type OccupiedTracker struct {
	// [targetLayerSelector][x][y] = occupied
	occupied map[string]map[int]map[int]bool
}

// NewOccupiedTracker creates a new tracker
func NewOccupiedTracker() *OccupiedTracker {
	return &OccupiedTracker{
		occupied: make(map[string]map[int]map[int]bool),
	}
}

// MarkOccupied marks a tile position as written
func (t *OccupiedTracker) MarkOccupied(selector string, x, y int) {
	if t.occupied[selector] == nil {
		t.occupied[selector] = make(map[int]map[int]bool)
	}
	if t.occupied[selector][x] == nil {
		t.occupied[selector][x] = make(map[int]bool)
	}
	t.occupied[selector][x][y] = true
}

// IsOccupied checks if a tile position has been written
func (t *OccupiedTracker) IsOccupied(selector string, x, y int) bool {
	if t.occupied[selector] == nil {
		return false
	}
	if t.occupied[selector][x] == nil {
		return false
	}
	return t.occupied[selector][x][y]
}
