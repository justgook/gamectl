package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"sort"

	"github.com/justgook/gamectl/pkg/qoi"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/wpm/pdk"
)

// =============================================================================
// Input/Output Types
// =============================================================================

// DetectInput for blob detection
type DetectInput struct {
	Path             string `json:"path"`             // Path to image file
	MinSize          int    `json:"minSize"`          // Minimum sprite size in pixels (default: 1)
	MergeOverlapping bool   `json:"mergeOverlapping"` // Merge overlapping bounding boxes
	AlphaThreshold   int    `json:"alphaThreshold"`   // Alpha threshold for "visible" (default: 1)
}

// Sprite represents a detected sprite region
type Sprite struct {
	X          int `json:"x"`          // Left position
	Y          int `json:"y"`          // Top position
	Width      int `json:"width"`      // Width
	Height     int `json:"height"`     // Height
	PixelCount int `json:"pixelCount"` // Number of non-transparent pixels
}

// DetectOutput returns detected sprites
type DetectOutput struct {
	Success bool     `json:"success"`
	Sprites []Sprite `json:"sprites"`
	ImageW  int      `json:"imageW"` // Source image width
	ImageH  int      `json:"imageH"` // Source image height
}

// DetectGridInput for grid-based detection
type DetectGridInput struct {
	Path      string `json:"path"`      // Path to image file
	CellW     int    `json:"cellW"`     // Cell width
	CellH     int    `json:"cellH"`     // Cell height
	SkipEmpty bool   `json:"skipEmpty"` // Skip empty cells in output
}

// GridCell represents a cell in grid detection
type GridCell struct {
	X       int  `json:"x"`       // Cell X index
	Y       int  `json:"y"`       // Cell Y index
	PxX     int  `json:"pxX"`     // Pixel X position
	PxY     int  `json:"pxY"`     // Pixel Y position
	IsEmpty bool `json:"isEmpty"` // True if cell is fully transparent
}

// DetectGridOutput returns grid cells
type DetectGridOutput struct {
	Success bool       `json:"success"`
	Cells   []GridCell `json:"cells"`
	Columns int        `json:"columns"` // Number of columns
	Rows    int        `json:"rows"`    // Number of rows
	CellW   int        `json:"cellW"`   // Cell width
	CellH   int        `json:"cellH"`   // Cell height
	ImageW  int        `json:"imageW"`  // Source image width
	ImageH  int        `json:"imageH"`  // Source image height
}

// =============================================================================
// Host Functions
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

func logMsg(msg string) {
	pdk.Call("host", "log", []byte(msg))
}

// =============================================================================
// Image loading
// =============================================================================

func loadImage(path string) (*image.NRGBA, error) {
	data, err := fsRead(path)
	if err != nil {
		return nil, err
	}

	var img image.Image

	// Try QOI first
	if len(data) >= 4 && string(data[:4]) == "qoif" {
		img, err = qoi.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("qoi decode error: %w", err)
		}
	} else {
		// Try PNG
		img, err = png.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("png decode error: %w", err)
		}
	}

	// Convert to NRGBA
	if nrgba, ok := img.(*image.NRGBA); ok {
		return nrgba, nil
	}

	bounds := img.Bounds()
	nrgba := image.NewNRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			nrgba.Set(x, y, img.At(x, y))
		}
	}
	return nrgba, nil
}

// =============================================================================
// Blob Detection Algorithm
// =============================================================================

// BlobDetector handles connected component detection
type BlobDetector struct {
	img            *image.NRGBA
	width, height  int
	visited        []bool
	alphaThreshold byte
}

func newBlobDetector(img *image.NRGBA, alphaThreshold int) *BlobDetector {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	threshold := byte(1)
	if alphaThreshold > 0 && alphaThreshold < 256 {
		threshold = byte(alphaThreshold)
	}

	return &BlobDetector{
		img:            img,
		width:          w,
		height:         h,
		visited:        make([]bool, w*h),
		alphaThreshold: threshold,
	}
}

func (d *BlobDetector) isOpaque(x, y int) bool {
	if x < 0 || x >= d.width || y < 0 || y >= d.height {
		return false
	}
	idx := (y*d.width + x) * 4
	return d.img.Pix[idx+3] >= d.alphaThreshold
}

func (d *BlobDetector) isVisited(x, y int) bool {
	return d.visited[y*d.width+x]
}

func (d *BlobDetector) markVisited(x, y int) {
	d.visited[y*d.width+x] = true
}

// floodFill finds all connected non-transparent pixels starting from (startX, startY)
// Returns bounding box and pixel count
func (d *BlobDetector) floodFill(startX, startY int) (minX, minY, maxX, maxY, pixelCount int) {
	minX, minY = startX, startY
	maxX, maxY = startX, startY
	pixelCount = 0

	// Use a stack for iterative flood fill (avoid stack overflow on large blobs)
	type point struct{ x, y int }
	stack := []point{{startX, startY}}

	for len(stack) > 0 {
		// Pop
		p := stack[len(stack)-1]
		stack = stack[:len(stack)-1]

		x, y := p.x, p.y

		// Skip if out of bounds, already visited, or transparent
		if x < 0 || x >= d.width || y < 0 || y >= d.height {
			continue
		}
		if d.isVisited(x, y) {
			continue
		}
		if !d.isOpaque(x, y) {
			continue
		}

		// Mark visited and count pixel
		d.markVisited(x, y)
		pixelCount++

		// Update bounding box
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

		// Add neighbors (4-connected)
		stack = append(stack, point{x - 1, y})
		stack = append(stack, point{x + 1, y})
		stack = append(stack, point{x, y - 1})
		stack = append(stack, point{x, y + 1})
	}

	return minX, minY, maxX, maxY, pixelCount
}

// DetectBlobs finds all connected non-transparent regions
func (d *BlobDetector) DetectBlobs(minSize int) []Sprite {
	var sprites []Sprite

	for y := 0; y < d.height; y++ {
		for x := 0; x < d.width; x++ {
			if d.isVisited(x, y) || !d.isOpaque(x, y) {
				continue
			}

			// Found a new blob
			minX, minY, maxX, maxY, pixelCount := d.floodFill(x, y)

			w := maxX - minX + 1
			h := maxY - minY + 1

			// Filter by minimum size
			if w >= minSize && h >= minSize {
				sprites = append(sprites, Sprite{
					X:          minX,
					Y:          minY,
					Width:      w,
					Height:     h,
					PixelCount: pixelCount,
				})
			}
		}
	}

	return sprites
}

// =============================================================================
// Merge overlapping bounding boxes
// =============================================================================

func boxesOverlap(a, b Sprite) bool {
	// Check if bounding boxes overlap
	return !(a.X+a.Width <= b.X || b.X+b.Width <= a.X ||
		a.Y+a.Height <= b.Y || b.Y+b.Height <= a.Y)
}

func mergeBoxes(a, b Sprite) Sprite {
	minX := a.X
	if b.X < minX {
		minX = b.X
	}
	minY := a.Y
	if b.Y < minY {
		minY = b.Y
	}
	maxX := a.X + a.Width
	if b.X+b.Width > maxX {
		maxX = b.X + b.Width
	}
	maxY := a.Y + a.Height
	if b.Y+b.Height > maxY {
		maxY = b.Y + b.Height
	}

	return Sprite{
		X:          minX,
		Y:          minY,
		Width:      maxX - minX,
		Height:     maxY - minY,
		PixelCount: a.PixelCount + b.PixelCount, // Approximate
	}
}

func mergeOverlappingSprites(sprites []Sprite) []Sprite {
	if len(sprites) <= 1 {
		return sprites
	}

	// Keep merging until no more merges are possible
	for {
		merged := false
		result := make([]Sprite, 0, len(sprites))

		for i, sprite := range sprites {
			// Check if this sprite should be skipped (already merged)
			skip := false
			for j := 0; j < i; j++ {
				if boxesOverlap(sprite, sprites[j]) {
					skip = true
					break
				}
			}
			if skip {
				continue
			}

			// Check for overlaps with remaining sprites and merge
			current := sprite
			for j := i + 1; j < len(sprites); j++ {
				if boxesOverlap(current, sprites[j]) {
					current = mergeBoxes(current, sprites[j])
					merged = true
				}
			}
			result = append(result, current)
		}

		sprites = result
		if !merged {
			break
		}
	}

	return sprites
}

// =============================================================================
// Sort sprites by position (top-to-bottom, left-to-right)
// =============================================================================

func sortSprites(sprites []Sprite) {
	sort.Slice(sprites, func(i, j int) bool {
		if sprites[i].Y != sprites[j].Y {
			return sprites[i].Y < sprites[j].Y
		}
		return sprites[i].X < sprites[j].X
	})
}

// =============================================================================
// Exported Functions
// =============================================================================

//go:wasmexport detect
func Detect() int32 {
	input := pdk.Input()
	var params DetectInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.Path == "" {
		pdk.Output(util.ErrorResponse("path is required"))
		return 1
	}

	// Set defaults
	minSize := params.MinSize
	if minSize <= 0 {
		minSize = 1
	}
	alphaThreshold := params.AlphaThreshold
	if alphaThreshold <= 0 {
		alphaThreshold = 1
	}

	// Load image
	img, err := loadImage(params.Path)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load image: " + err.Error()))
		return 1
	}

	bounds := img.Bounds()
	logMsg(fmt.Sprintf("[sprite-detect] Detecting blobs in %dx%d image", bounds.Dx(), bounds.Dy()))

	// Detect blobs
	detector := newBlobDetector(img, alphaThreshold)
	sprites := detector.DetectBlobs(minSize)

	logMsg(fmt.Sprintf("[sprite-detect] Found %d sprites before merge", len(sprites)))

	// Merge overlapping if requested
	if params.MergeOverlapping {
		sprites = mergeOverlappingSprites(sprites)
		logMsg(fmt.Sprintf("[sprite-detect] %d sprites after merge", len(sprites)))
	}

	// Sort by position
	sortSprites(sprites)

	output := DetectOutput{
		Success: true,
		Sprites: sprites,
		ImageW:  bounds.Dx(),
		ImageH:  bounds.Dy(),
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

//go:wasmexport detectGrid
func DetectGrid() int32 {
	input := pdk.Input()
	var params DetectGridInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.Path == "" {
		pdk.Output(util.ErrorResponse("path is required"))
		return 1
	}
	if params.CellW <= 0 || params.CellH <= 0 {
		pdk.Output(util.ErrorResponse("cellW and cellH must be positive"))
		return 1
	}

	// Load image
	img, err := loadImage(params.Path)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load image: " + err.Error()))
		return 1
	}

	bounds := img.Bounds()
	imgW, imgH := bounds.Dx(), bounds.Dy()

	// Calculate grid dimensions
	cols := imgW / params.CellW
	rows := imgH / params.CellH

	logMsg(fmt.Sprintf("[sprite-detect] Grid detection: %dx%d cells in %dx%d image", cols, rows, imgW, imgH))

	var cells []GridCell

	for row := 0; row < rows; row++ {
		for col := 0; col < cols; col++ {
			pxX := col * params.CellW
			pxY := row * params.CellH

			// Check if cell is empty (all transparent)
			isEmpty := true
			for y := 0; y < params.CellH && isEmpty; y++ {
				for x := 0; x < params.CellW && isEmpty; x++ {
					idx := ((pxY+y)*imgW + (pxX + x)) * 4
					if img.Pix[idx+3] > 0 {
						isEmpty = false
					}
				}
			}

			if params.SkipEmpty && isEmpty {
				continue
			}

			cells = append(cells, GridCell{
				X:       col,
				Y:       row,
				PxX:     pxX,
				PxY:     pxY,
				IsEmpty: isEmpty,
			})
		}
	}

	output := DetectGridOutput{
		Success: true,
		Cells:   cells,
		Columns: cols,
		Rows:    rows,
		CellW:   params.CellW,
		CellH:   params.CellH,
		ImageW:  imgW,
		ImageH:  imgH,
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

// Required main function for WASM
func main() {}
