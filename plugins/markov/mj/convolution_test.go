package mj

import "testing"

func TestConvolutionMooreBirth(t *testing.T) {
	model, err := ParseXML([]byte(`<convolution values="BW" neighborhood="Moore"><rule in="B" out="W" values="W" sum="1..8"/></convolution>`))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 3, Height: 1, Seed: 1, Steps: 1, InitialCells: "BWB"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Cells != "WWW" {
		t.Fatalf("cells = %q", result.Cells)
	}
}

func TestConvolutionStepsLimit(t *testing.T) {
	model, err := ParseXML([]byte(`<convolution values="BW" neighborhood="VonNeumann" steps="1"><rule in="B" out="W"/></convolution>`))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 2, Height: 1, Seed: 1, Steps: 10})
	if err != nil {
		t.Fatal(err)
	}
	if result.Cells != "WW" || result.Changed != 1 {
		t.Fatalf("result = %#v", result)
	}
}
