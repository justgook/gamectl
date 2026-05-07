package placement

import "testing"

func TestParseRoomShapeMask(t *testing.T) {
	shape, err := ParseRoomShapeMask("##./#../...")
	if err != nil {
		t.Fatalf("ParseRoomShapeMask failed: %v", err)
	}

	want := RoomShape{{X: 0, Y: 0}, {X: 1, Y: 0}, {X: 0, Y: 1}}
	if len(shape) != len(want) {
		t.Fatalf("shape length = %d, want %d", len(shape), len(want))
	}
	for i := range want {
		if shape[i] != want[i] {
			t.Fatalf("shape[%d] = %+v, want %+v", i, shape[i], want[i])
		}
	}
}

func TestParseRoomShapeMaskRejectsInvalidMasks(t *testing.T) {
	tests := []struct {
		name string
		mask string
	}{
		{name: "empty", mask: ""},
		{name: "empty row", mask: "#/"},
		{name: "ragged rows", mask: "##/#"},
		{name: "invalid character", mask: "#x"},
		{name: "no occupied cells", mask: "../.."},
		{name: "disconnected", mask: "#.#"},
		{name: "newline separator", mask: "##\n#."},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := ParseRoomShapeMask(tt.mask); err == nil {
				t.Fatalf("ParseRoomShapeMask(%q) succeeded, want error", tt.mask)
			}
		})
	}
}
