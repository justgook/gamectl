package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"

	"github.com/justgook/gamectl/pkg/qoi"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/wpm/pdk"
)

// =============================================================================
// Input/Output Types
// =============================================================================

// DecodeInput for decoding an image from FS
type DecodeInput struct {
	Path string `json:"path"` // Path to image file (PNG or QOI)
}

// DecodeOutput returns image dimensions and raw RGBA data
type DecodeOutput struct {
	Success  bool   `json:"success"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Channels int    `json:"channels"` // Always 4 (RGBA)
	DataKey  string `json:"dataKey"`  // Key to retrieve raw data via getData
}

// EncodeInput for encoding an image to FS
type EncodeInput struct {
	Path    string `json:"path"`    // Output path
	Width   int    `json:"width"`   // Image width
	Height  int    `json:"height"`  // Image height
	DataKey string `json:"dataKey"` // Key to raw RGBA data (set via setData)
	Format  string `json:"format"`  // "qoi" or "png" (default: qoi)
}

// CropInput for cropping an image
type CropInput struct {
	InputPath  string `json:"inputPath"`  // Source image path
	OutputPath string `json:"outputPath"` // Destination image path
	X          int    `json:"x"`          // Crop start X
	Y          int    `json:"y"`          // Crop start Y
	Width      int    `json:"width"`      // Crop width
	Height     int    `json:"height"`     // Crop height
}

// CropAlphaInput for cropping to non-transparent bounds
type CropAlphaInput struct {
	InputPath  string `json:"inputPath"`  // Source image path
	OutputPath string `json:"outputPath"` // Destination image path
}

// CropAlphaOutput returns the crop bounds
type CropAlphaOutput struct {
	Success bool `json:"success"`
	X       int  `json:"x"`      // Offset from original left
	Y       int  `json:"y"`      // Offset from original top
	Width   int  `json:"width"`  // New width
	Height  int  `json:"height"` // New height
}

// SplitRegion defines a region to extract
type SplitRegion struct {
	X          int    `json:"x"`
	Y          int    `json:"y"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	OutputPath string `json:"outputPath"`
}

// SplitInput for splitting an image into multiple files
type SplitInput struct {
	InputPath string        `json:"inputPath"` // Source image path
	Regions   []SplitRegion `json:"regions"`   // Regions to extract
}

// CombineImage defines an image to composite
type CombineImage struct {
	Path string `json:"path"` // Image file path
	X    int    `json:"x"`    // Position X in output
	Y    int    `json:"y"`    // Position Y in output
}

// CombineInput for combining multiple images
type CombineInput struct {
	Images     []CombineImage `json:"images"`     // Images to combine
	Width      int            `json:"width"`      // Output width
	Height     int            `json:"height"`     // Output height
	OutputPath string         `json:"outputPath"` // Output file path
}

// InfoInput for getting image info without loading full data
type InfoInput struct {
	Path string `json:"path"` // Image file path
}

// InfoOutput returns image metadata
type InfoOutput struct {
	Success  bool   `json:"success"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Channels int    `json:"channels"`
	Format   string `json:"format"` // "png" or "qoi"
}

// =============================================================================
// Temporary data storage for passing binary data between calls
// =============================================================================

var dataStore = make(map[string][]byte)
var dataCounter int

// =============================================================================
// Host Functions - FS access
// =============================================================================

func fsRead(path string) ([]byte, error) {
	status, data, err := pdk.Call("fs", "read", []byte(path))
	if err != nil {
		return nil, fmt.Errorf("fs read error: %w", err)
	}
	if status != 0 {
		return nil, fmt.Errorf("fs read failed: %s", string(data))
	}
	return data, nil
}

func fsWrite(path string, data []byte) error {
	// Format: path + null byte + data
	input := make([]byte, len(path)+1+len(data))
	copy(input, path)
	input[len(path)] = 0
	copy(input[len(path)+1:], data)

	status, output, err := pdk.Call("fs", "write", input)
	if err != nil {
		return fmt.Errorf("fs write error: %w", err)
	}
	if status != 0 {
		return fmt.Errorf("fs write failed: %s", string(output))
	}
	return nil
}

func logMsg(msg string) {
	pdk.Call("host", "log", []byte(msg))
}

// =============================================================================
// Image loading/saving helpers
// =============================================================================

func loadImage(path string) (image.Image, string, error) {
	data, err := fsRead(path)
	if err != nil {
		return nil, "", err
	}

	// Try QOI first (check magic bytes)
	if len(data) >= 4 && string(data[:4]) == "qoif" {
		img, err := qoi.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, "", fmt.Errorf("qoi decode error: %w", err)
		}
		return img, "qoi", nil
	}

	// Try PNG
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("png decode error: %w", err)
	}
	return img, "png", nil
}

func saveImage(path string, img image.Image, format string) error {
	var buf bytes.Buffer

	switch format {
	case "png":
		if err := png.Encode(&buf, img); err != nil {
			return fmt.Errorf("png encode error: %w", err)
		}
	case "qoi":
		fallthrough
	default:
		if err := qoi.Encode(&buf, img); err != nil {
			return fmt.Errorf("qoi encode error: %w", err)
		}
	}

	return fsWrite(path, buf.Bytes())
}

// Convert image to NRGBA for consistent pixel access
func toNRGBA(img image.Image) *image.NRGBA {
	if nrgba, ok := img.(*image.NRGBA); ok {
		return nrgba
	}

	bounds := img.Bounds()
	nrgba := image.NewNRGBA(bounds)

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			nrgba.Set(x, y, img.At(x, y))
		}
	}

	return nrgba
}

// =============================================================================
// Exported Functions
// =============================================================================

//go:wasmexport info
func Info() int32 {
	input := pdk.Input()
	var params InfoInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.Path == "" {
		pdk.Output(util.ErrorResponse("path is required"))
		return 1
	}

	data, err := fsRead(params.Path)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to read file: " + err.Error()))
		return 1
	}

	var output InfoOutput
	output.Success = true
	output.Channels = 4 // Always RGBA

	// Check format and get dimensions
	if len(data) >= 4 && string(data[:4]) == "qoif" {
		cfg, err := qoi.DecodeConfig(bytes.NewReader(data))
		if err != nil {
			pdk.Output(util.ErrorResponse("failed to decode QOI config: " + err.Error()))
			return 1
		}
		output.Width = cfg.Width
		output.Height = cfg.Height
		output.Format = "qoi"
	} else {
		cfg, err := png.DecodeConfig(bytes.NewReader(data))
		if err != nil {
			pdk.Output(util.ErrorResponse("failed to decode PNG config: " + err.Error()))
			return 1
		}
		output.Width = cfg.Width
		output.Height = cfg.Height
		output.Format = "png"
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

//go:wasmexport decode
func Decode() int32 {
	input := pdk.Input()
	var params DecodeInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.Path == "" {
		pdk.Output(util.ErrorResponse("path is required"))
		return 1
	}

	img, _, err := loadImage(params.Path)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load image: " + err.Error()))
		return 1
	}

	nrgba := toNRGBA(img)
	bounds := nrgba.Bounds()

	// Store raw pixel data
	dataCounter++
	dataKey := fmt.Sprintf("img_%d", dataCounter)
	dataStore[dataKey] = nrgba.Pix

	output := DecodeOutput{
		Success:  true,
		Width:    bounds.Dx(),
		Height:   bounds.Dy(),
		Channels: 4,
		DataKey:  dataKey,
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

//go:wasmexport getData
func GetData() int32 {
	input := pdk.Input()
	key := string(input)

	data, ok := dataStore[key]
	if !ok {
		pdk.Output(util.ErrorResponse("data not found: " + key))
		return 1
	}

	pdk.Output(data)
	return 0
}

//go:wasmexport setData
func SetData() int32 {
	input := pdk.Input()

	// Format: key (null terminated) + data
	nullIdx := bytes.IndexByte(input, 0)
	if nullIdx < 0 {
		pdk.Output(util.ErrorResponse("invalid format: missing null separator"))
		return 1
	}

	key := string(input[:nullIdx])
	data := input[nullIdx+1:]

	// Copy data to avoid retaining input buffer
	stored := make([]byte, len(data))
	copy(stored, data)
	dataStore[key] = stored

	pdk.Output(util.SuccessResponse())
	return 0
}

//go:wasmexport freeData
func FreeData() int32 {
	input := pdk.Input()
	key := string(input)
	delete(dataStore, key)
	pdk.Output(util.SuccessResponse())
	return 0
}

//go:wasmexport encode
func Encode() int32 {
	input := pdk.Input()
	var params EncodeInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.Path == "" {
		pdk.Output(util.ErrorResponse("path is required"))
		return 1
	}
	if params.Width <= 0 || params.Height <= 0 {
		pdk.Output(util.ErrorResponse("width and height must be positive"))
		return 1
	}
	if params.DataKey == "" {
		pdk.Output(util.ErrorResponse("dataKey is required"))
		return 1
	}

	pixelData, ok := dataStore[params.DataKey]
	if !ok {
		pdk.Output(util.ErrorResponse("data not found: " + params.DataKey))
		return 1
	}

	expectedSize := params.Width * params.Height * 4
	if len(pixelData) != expectedSize {
		pdk.Output(util.ErrorResponse(fmt.Sprintf("data size mismatch: got %d, expected %d", len(pixelData), expectedSize)))
		return 1
	}

	// Create image from raw data
	img := &image.NRGBA{
		Pix:    pixelData,
		Stride: params.Width * 4,
		Rect:   image.Rect(0, 0, params.Width, params.Height),
	}

	format := params.Format
	if format == "" {
		format = "qoi"
	}

	if err := saveImage(params.Path, img, format); err != nil {
		pdk.Output(util.ErrorResponse("failed to save image: " + err.Error()))
		return 1
	}

	pdk.Output(util.SuccessResponse())
	return 0
}

//go:wasmexport crop
func Crop() int32 {
	input := pdk.Input()
	var params CropInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.InputPath == "" || params.OutputPath == "" {
		pdk.Output(util.ErrorResponse("inputPath and outputPath are required"))
		return 1
	}

	img, _, err := loadImage(params.InputPath)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load image: " + err.Error()))
		return 1
	}

	nrgba := toNRGBA(img)
	bounds := nrgba.Bounds()

	// Validate crop region
	if params.X < 0 || params.Y < 0 || params.Width <= 0 || params.Height <= 0 {
		pdk.Output(util.ErrorResponse("invalid crop dimensions"))
		return 1
	}
	if params.X+params.Width > bounds.Dx() || params.Y+params.Height > bounds.Dy() {
		pdk.Output(util.ErrorResponse("crop region exceeds image bounds"))
		return 1
	}

	// Create cropped image
	cropped := image.NewNRGBA(image.Rect(0, 0, params.Width, params.Height))
	for y := 0; y < params.Height; y++ {
		srcY := params.Y + y
		for x := 0; x < params.Width; x++ {
			srcX := params.X + x
			srcIdx := (srcY*bounds.Dx() + srcX) * 4
			dstIdx := (y*params.Width + x) * 4
			copy(cropped.Pix[dstIdx:dstIdx+4], nrgba.Pix[srcIdx:srcIdx+4])
		}
	}

	if err := saveImage(params.OutputPath, cropped, "qoi"); err != nil {
		pdk.Output(util.ErrorResponse("failed to save image: " + err.Error()))
		return 1
	}

	pdk.Output(util.SuccessResponse())
	return 0
}

//go:wasmexport cropAlpha
func CropAlpha() int32 {
	input := pdk.Input()
	var params CropAlphaInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.InputPath == "" || params.OutputPath == "" {
		pdk.Output(util.ErrorResponse("inputPath and outputPath are required"))
		return 1
	}

	img, _, err := loadImage(params.InputPath)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load image: " + err.Error()))
		return 1
	}

	nrgba := toNRGBA(img)
	bounds := nrgba.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	// Find non-transparent bounds
	minX, minY := w, h
	maxX, maxY := 0, 0

	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			idx := (y*w + x) * 4
			alpha := nrgba.Pix[idx+3]
			if alpha > 0 {
				if x < minX {
					minX = x
				}
				if x > maxX {
					maxX = x
				}
				if y < minY {
					minY = y
				}
				if y > maxY {
					maxY = y
				}
			}
		}
	}

	// Handle fully transparent image
	if minX > maxX || minY > maxY {
		// Return 1x1 transparent pixel
		cropped := image.NewNRGBA(image.Rect(0, 0, 1, 1))
		if err := saveImage(params.OutputPath, cropped, "qoi"); err != nil {
			pdk.Output(util.ErrorResponse("failed to save image: " + err.Error()))
			return 1
		}

		output := CropAlphaOutput{Success: true, X: 0, Y: 0, Width: 1, Height: 1}
		result, _ := json.Marshal(output)
		pdk.Output(result)
		return 0
	}

	// Crop to bounds
	cropW := maxX - minX + 1
	cropH := maxY - minY + 1
	cropped := image.NewNRGBA(image.Rect(0, 0, cropW, cropH))

	for y := 0; y < cropH; y++ {
		srcY := minY + y
		for x := 0; x < cropW; x++ {
			srcX := minX + x
			srcIdx := (srcY*w + srcX) * 4
			dstIdx := (y*cropW + x) * 4
			copy(cropped.Pix[dstIdx:dstIdx+4], nrgba.Pix[srcIdx:srcIdx+4])
		}
	}

	if err := saveImage(params.OutputPath, cropped, "qoi"); err != nil {
		pdk.Output(util.ErrorResponse("failed to save image: " + err.Error()))
		return 1
	}

	output := CropAlphaOutput{
		Success: true,
		X:       minX,
		Y:       minY,
		Width:   cropW,
		Height:  cropH,
	}
	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

//go:wasmexport split
func Split() int32 {
	input := pdk.Input()
	var params SplitInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.InputPath == "" {
		pdk.Output(util.ErrorResponse("inputPath is required"))
		return 1
	}
	if len(params.Regions) == 0 {
		pdk.Output(util.ErrorResponse("at least one region is required"))
		return 1
	}

	img, _, err := loadImage(params.InputPath)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load image: " + err.Error()))
		return 1
	}

	nrgba := toNRGBA(img)
	bounds := nrgba.Bounds()
	w := bounds.Dx()

	for i, region := range params.Regions {
		if region.OutputPath == "" {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("region %d: outputPath is required", i)))
			return 1
		}
		if region.X < 0 || region.Y < 0 || region.Width <= 0 || region.Height <= 0 {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("region %d: invalid dimensions", i)))
			return 1
		}
		if region.X+region.Width > bounds.Dx() || region.Y+region.Height > bounds.Dy() {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("region %d: exceeds image bounds", i)))
			return 1
		}

		// Extract region
		cropped := image.NewNRGBA(image.Rect(0, 0, region.Width, region.Height))
		for y := 0; y < region.Height; y++ {
			srcY := region.Y + y
			for x := 0; x < region.Width; x++ {
				srcX := region.X + x
				srcIdx := (srcY*w + srcX) * 4
				dstIdx := (y*region.Width + x) * 4
				copy(cropped.Pix[dstIdx:dstIdx+4], nrgba.Pix[srcIdx:srcIdx+4])
			}
		}

		if err := saveImage(region.OutputPath, cropped, "qoi"); err != nil {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("region %d: failed to save: %s", i, err.Error())))
			return 1
		}
	}

	pdk.Output(util.SuccessResponse())
	return 0
}

//go:wasmexport combine
func Combine() int32 {
	input := pdk.Input()
	var params CombineInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.OutputPath == "" {
		pdk.Output(util.ErrorResponse("outputPath is required"))
		return 1
	}
	if params.Width <= 0 || params.Height <= 0 {
		pdk.Output(util.ErrorResponse("width and height must be positive"))
		return 1
	}
	if len(params.Images) == 0 {
		pdk.Output(util.ErrorResponse("at least one image is required"))
		return 1
	}

	// Create output image (transparent background)
	output := image.NewNRGBA(image.Rect(0, 0, params.Width, params.Height))

	// Composite each image
	for i, imgDef := range params.Images {
		if imgDef.Path == "" {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("image %d: path is required", i)))
			return 1
		}

		img, _, err := loadImage(imgDef.Path)
		if err != nil {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("image %d: failed to load: %s", i, err.Error())))
			return 1
		}

		nrgba := toNRGBA(img)
		srcBounds := nrgba.Bounds()
		srcW, srcH := srcBounds.Dx(), srcBounds.Dy()

		// Copy pixels with alpha blending
		for y := 0; y < srcH; y++ {
			dstY := imgDef.Y + y
			if dstY < 0 || dstY >= params.Height {
				continue
			}
			for x := 0; x < srcW; x++ {
				dstX := imgDef.X + x
				if dstX < 0 || dstX >= params.Width {
					continue
				}

				srcIdx := (y*srcW + x) * 4
				dstIdx := (dstY*params.Width + dstX) * 4

				srcA := nrgba.Pix[srcIdx+3]
				if srcA == 255 {
					// Fully opaque: just copy
					copy(output.Pix[dstIdx:dstIdx+4], nrgba.Pix[srcIdx:srcIdx+4])
				} else if srcA > 0 {
					// Alpha blend
					dstA := output.Pix[dstIdx+3]
					if dstA == 0 {
						copy(output.Pix[dstIdx:dstIdx+4], nrgba.Pix[srcIdx:srcIdx+4])
					} else {
						// Standard alpha compositing
						srcR := int(nrgba.Pix[srcIdx])
						srcG := int(nrgba.Pix[srcIdx+1])
						srcB := int(nrgba.Pix[srcIdx+2])
						dstR := int(output.Pix[dstIdx])
						dstG := int(output.Pix[dstIdx+1])
						dstB := int(output.Pix[dstIdx+2])

						outA := int(srcA) + int(dstA)*(255-int(srcA))/255
						if outA > 0 {
							output.Pix[dstIdx] = byte((srcR*int(srcA) + dstR*int(dstA)*(255-int(srcA))/255) / outA)
							output.Pix[dstIdx+1] = byte((srcG*int(srcA) + dstG*int(dstA)*(255-int(srcA))/255) / outA)
							output.Pix[dstIdx+2] = byte((srcB*int(srcA) + dstB*int(dstA)*(255-int(srcA))/255) / outA)
							output.Pix[dstIdx+3] = byte(outA)
						}
					}
				}
				// srcA == 0: keep destination as is
			}
		}
	}

	if err := saveImage(params.OutputPath, output, "qoi"); err != nil {
		pdk.Output(util.ErrorResponse("failed to save output: " + err.Error()))
		return 1
	}

	pdk.Output(util.SuccessResponse())
	return 0
}

// Required main function for WASM
func main() {}
