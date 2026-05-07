package mj

import (
	"bytes"
	"fmt"
	"image"
	_ "image/png"
	"path"
)

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
	resourcePath = path.Join(resourcePath, name+".png")
	data, err := opts.ReadFile(resourcePath)
	if err != nil {
		return Pattern{}, err
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return Pattern{}, fmt.Errorf("decode %s: %w", resourcePath, err)
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	colors := make([]uint32, 0, len(legend))
	out := make([]byte, 0, w*h)
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			r, g, bl, a := img.At(x, y).RGBA()
			color := uint32(a>>8)<<24 | uint32(r>>8)<<16 | uint32(g>>8)<<8 | uint32(bl>>8)
			ord := -1
			for i, known := range colors {
				if known == color {
					ord = i
					break
				}
			}
			if ord < 0 {
				ord = len(colors)
				colors = append(colors, color)
				if len(colors) > len(legend) {
					return Pattern{}, fmt.Errorf("the amount of colors in %s is more than legend length", resourcePath)
				}
			}
			out = append(out, legend[ord])
		}
	}
	return Pattern{W: w, H: h, Data: out}, nil
}
