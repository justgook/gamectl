package mj

import "testing"

func TestMapNodeScalesAndMaps(t *testing.T) {
	model, err := ParseXML([]byte(`<sequence values="BW"><all in="B" out="W"/><map scale="2 2 1" values="._"><rule in="W" out="__/__"/></map></sequence>`))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 2, Height: 1, Depth: 1, Seed: 1, Steps: 10})
	if err != nil {
		t.Fatal(err)
	}
	if result.Width != 4 || result.Height != 2 || result.Cells != "____/____" {
		t.Fatalf("result = %#v", result)
	}
}

func TestMapNodeChildRunsOnNewGrid(t *testing.T) {
	model, err := ParseXML([]byte(`<map values="BW" scale="1 1 1"><rule in="B" out="W"/><all in="W" out="B"/></map>`))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 2, Height: 1, Depth: 1, Seed: 1, Steps: 1})
	if err != nil {
		t.Fatal(err)
	}
	if result.Cells != "BB" {
		t.Fatalf("cells = %q", result.Cells)
	}
}
