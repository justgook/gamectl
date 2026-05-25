package mj

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestOverlapWFCRuns(t *testing.T) {
	root := t.TempDir()
	samples := filepath.Join(root, "resources", "samples")
	if err := os.MkdirAll(samples, 0o755); err != nil {
		t.Fatal(err)
	}
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{A: 255})
	img.Set(1, 0, color.RGBA{R: 255, G: 255, B: 255, A: 255})
	img.Set(0, 1, color.RGBA{R: 255, G: 255, B: 255, A: 255})
	img.Set(1, 1, color.RGBA{A: 255})
	f, err := os.Create(filepath.Join(samples, "Checker.png"))
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(f, img); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	model, err := ParseXMLWithOptions([]byte(`<wfc values="BW" sample="Checker" n="2"/>`), ParseOptions{ResourceRoot: root, ReadFile: os.ReadFile})
	if err != nil {
		t.Fatal(err)
	}
	result, err := Run(model, RunOptions{Width: 4, Height: 4, Seed: 1, Steps: 10})
	if err != nil {
		t.Fatal(err)
	}
	if result.Width != 4 || result.Height != 4 || result.Values != "BW" {
		t.Fatalf("result = %#v", result)
	}
}
