package main

import (
	"reflect"
	"testing"

	"github.com/kkgams/sdk/go/tilemap"
)

func TestScaleTilemapScalesStandardLayer(t *testing.T) {
	src := &tilemap.TileMap{
		Layers: []tilemap.TileLayer{{
			Width: 2,
			Data:  []uint32{1, 2, 3, 4},
			Props: map[string]string{"name": "base"},
		}},
		Props: map[string]string{"tileset": "demo"},
	}

	scaled := scaleTilemap(src, 2, getDefaultDoorSizes())

	if scaled.Layers[0].Width != 4 {
		t.Fatalf("width = %d, want 4", scaled.Layers[0].Width)
	}
	wantData := []uint32{
		1, 1, 2, 2,
		1, 1, 2, 2,
		3, 3, 4, 4,
		3, 3, 4, 4,
	}
	if !reflect.DeepEqual(scaled.Layers[0].Data, wantData) {
		t.Fatalf("data = %#v, want %#v", scaled.Layers[0].Data, wantData)
	}
	if scaled.Props["tileset"] != "demo" || scaled.Layers[0].Props["name"] != "base" {
		t.Fatalf("properties were not preserved: %#v %#v", scaled.Props, scaled.Layers[0].Props)
	}
}

func TestScaleTilemapScalesDoorLayer(t *testing.T) {
	src := &tilemap.TileMap{
		Layers: []tilemap.TileLayer{{
			Width: 1,
			Data:  []uint32{uint32(DoorNorth | DoorEast | DoorSouth | DoorWest)},
			Props: map[string]string{"type": "doors"},
		}},
	}

	scaled := scaleTilemap(src, 3, DoorSizesConfig{
		North: DoorSize{Width: 1, Height: 1},
		East:  DoorSize{Width: 1, Height: 1},
		South: DoorSize{Width: 1, Height: 1},
		West:  DoorSize{Width: 1, Height: 1},
	})

	wantData := []uint32{
		0, uint32(DoorNorth), 0,
		uint32(DoorWest), 0, uint32(DoorEast),
		0, uint32(DoorSouth), 0,
	}
	if !reflect.DeepEqual(scaled.Layers[0].Data, wantData) {
		t.Fatalf("door data = %#v, want %#v", scaled.Layers[0].Data, wantData)
	}
}
