package mj

import "testing"

func TestParseBasicXML(t *testing.T) {
	m, err := ParseXML([]byte(`<one values="BW" in="B" out="W"/>`))
	if err != nil {
		t.Fatal(err)
	}
	if m.Values != "BW" {
		t.Fatalf("values = %q", m.Values)
	}
	res, err := Run(m, RunOptions{Width: 3, Height: 2, Seed: 1, Steps: 10})
	if err != nil {
		t.Fatal(err)
	}
	if res.Cells != "WWW/WWW" {
		t.Fatalf("cells = %q", res.Cells)
	}
}

func TestSequenceXML(t *testing.T) {
	m, err := ParseXML([]byte(`<sequence values="BWR"><one in="B" out="W"/><all in="W" out="R"/></sequence>`))
	if err != nil {
		t.Fatal(err)
	}
	res, err := Run(m, RunOptions{Width: 2, Height: 1, Seed: 1, Steps: 10})
	if err != nil {
		t.Fatal(err)
	}
	if res.Cells != "RR" {
		t.Fatalf("cells = %q", res.Cells)
	}
}

func TestInspect(t *testing.T) {
	m, err := ParseXML([]byte(`<sequence values="BW"><one in="B" out="W"/></sequence>`))
	if err != nil {
		t.Fatal(err)
	}
	got := Inspect(m)
	if !got.Features["sequence"] || !got.Features["one"] || !got.Features["rules"] {
		t.Fatalf("features = %#v", got.Features)
	}
}
