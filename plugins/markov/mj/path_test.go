package mj

import "testing"

func TestPathNodeConnectsStartToFinish(t *testing.T) {
	model, err := ParseXML([]byte(`<sequence values="BRSU"><path from="R" to="S" on="B" color="U"/></sequence>`))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 5, Height: 1, Seed: 1, Steps: 1, InitialCells: "RBBBS"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Cells != "RUUUS" {
		t.Fatalf("cells = %q", result.Cells)
	}
}

func TestPathNodeNoConnection(t *testing.T) {
	model, err := ParseXML([]byte(`<sequence values="BRSXU"><path from="R" to="S" on="B" color="U"/></sequence>`))
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 5, Height: 1, Seed: 1, Steps: 1, InitialCells: "RBXXS"})
	if err != nil {
		t.Fatal(err)
	}
	if result.Cells != "RBXXS" {
		t.Fatalf("cells = %q", result.Cells)
	}
}
