package mj

import (
	"bytes"
	"fmt"
	"image"
	_ "image/png"
	"path"
)

type sampleImage struct {
	W, H int
	Data []uint32
}

func loadResourcePattern(opts ParseOptions, folder, name, legend string) (Pattern, error) {
	if opts.ReadFile == nil {
		return Pattern{}, fmt.Errorf("resource rule %q requires ReadFile", name)
	}
	if legend == "" {
		return Pattern{}, fmt.Errorf("no legend for %s", name)
	}
	resourcePath := path.Join(opts.ResourceRoot, "resources", "rules")
	if folder != "" {
		resourcePath = path.Join(resourcePath, folder)
	}
	pngPath := path.Join(resourcePath, name+".png")
	data, err := opts.ReadFile(pngPath)
	if err == nil {
		sample, err := decodeImage(data, pngPath)
		if err != nil {
			return Pattern{}, err
		}
		return patternFromColors(sample.W, sample.H, 1, sample.Data, legend, pngPath)
	}
	voxPath := path.Join(resourcePath, name+".vox")
	data, voxErr := opts.ReadFile(voxPath)
	if voxErr != nil {
		return Pattern{}, err
	}
	vox, err := decodeVox(data, voxPath)
	if err != nil {
		return Pattern{}, err
	}
	return patternFromColors(vox.W, vox.H, vox.D, vox.Data, legend, voxPath)
}

func patternFromColors(w, h, d int, colorsData []uint32, legend string, label string) (Pattern, error) {
	colors := make([]uint32, 0, len(legend))
	out := make([]byte, len(colorsData))
	for i, color := range colorsData {
		ord := -1
		for j, known := range colors {
			if known == color {
				ord = j
				break
			}
		}
		if ord < 0 {
			ord = len(colors)
			colors = append(colors, color)
			if len(colors) > len(legend) {
				return Pattern{}, fmt.Errorf("the amount of colors in %s is more than legend length", label)
			}
		}
		out[i] = legend[ord]
	}
	return Pattern{W: w, H: h, D: d, Data: out}, nil
}

func loadSampleImage(opts ParseOptions, name string) (sampleImage, error) {
	if opts.ReadFile == nil {
		return sampleImage{}, fmt.Errorf("sample %q requires ReadFile", name)
	}
	resourcePath := path.Join(opts.ResourceRoot, "resources", "samples", name+".png")
	data, err := opts.ReadFile(resourcePath)
	if err != nil {
		return sampleImage{}, err
	}
	return decodeImage(data, resourcePath)
}

func decodeImage(data []byte, label string) (sampleImage, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return sampleImage{}, fmt.Errorf("decode %s: %w", label, err)
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	out := make([]uint32, 0, w*h)
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			r, g, bl, a := img.At(x, y).RGBA()
			out = append(out, uint32(a>>8)<<24|uint32(r>>8)<<16|uint32(g>>8)<<8|uint32(bl>>8))
		}
	}
	return sampleImage{W: w, H: h, Data: out}, nil
}
