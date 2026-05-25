package mj

import "testing"

func TestParse3DPatternAndRule(t *testing.T) {
	model, err := ParseXML([]byte(`<one values="BW" in="B B" out="W W"/>`))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 1, Height: 1, Depth: 2, Seed: 1, Steps: 10})
	if err != nil {
		t.Fatal(err)
	}
	if result.Cells != "W W" || result.Depth != 2 {
		t.Fatalf("result = %#v", result)
	}
}

func TestConvolution3DNoCorners(t *testing.T) {
	model, err := ParseXML([]byte(`<convolution values="BW" neighborhood="NoCorners"><rule in="B" out="W" values="W" sum="1..26"/></convolution>`))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 1, Height: 1, Depth: 3, Seed: 1, Steps: 1, InitialCells: "B W B"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Cells != "W W W" {
		t.Fatalf("cells = %q", result.Cells)
	}
}
