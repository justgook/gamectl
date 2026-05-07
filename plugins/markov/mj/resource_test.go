package mj

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestFileBackedGluedRulePNG(t *testing.T) {
	root := t.TempDir()
	rules := filepath.Join(root, "resources", "rules", "Test")
	if err := os.MkdirAll(rules, 0o755); err != nil {
		t.Fatal(err)
	}
	img := image.NewRGBA(image.Rect(0, 0, 2, 1))
	img.Set(0, 0, color.RGBA{A: 255})
	img.Set(1, 0, color.RGBA{R: 255, G: 255, B: 255, A: 255})
	f, err := os.Create(filepath.Join(rules, "Flip.png"))
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(f, img); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}

	model, err := ParseXMLWithOptions([]byte(`<one values="BW" folder="Test"><rule file="Flip" legend="BW"/></one>`), ParseOptions{ResourceRoot: root, ReadFile: os.ReadFile})
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 2, Height: 1, Seed: 1, Steps: 10})
	if err != nil {
		t.Fatal(err)
	}
	if result.Cells != "WW" {
		t.Fatalf("cells = %q", result.Cells)
	}
}
