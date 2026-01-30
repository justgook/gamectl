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

// PivotPoint represents a pivot position as relative coordinates (0.0-1.0)
type PivotPoint struct {
	X float64 `json:"x"` // 0.0 = left, 0.5 = center, 1.0 = right
	Y float64 `json:"y"` // 0.0 = top, 0.5 = center, 1.0 = bottom
}

// ExportSpritesheetInput for creating uniform-sized spritesheet with pivot points
type ExportSpritesheetInput struct {
	SourcePath   string                `json:"sourcePath"`   // Path to source image
	Sprites      []Sprite              `json:"sprites"`      // Sprites to include
	Pivots       map[string]PivotPoint `json:"pivots"`       // Sprite index (string) -> pivot
	DefaultPivot PivotPoint            `json:"defaultPivot"` // Default pivot for sprites without custom
	CellW        int                   `json:"cellW"`        // Output cell width
	CellH        int                   `json:"cellH"`        // Output cell height
	OutputPath   string                `json:"outputPath"`   // Output file path
}

// ExportSpritesheetOutput returns spritesheet generation result
type ExportSpritesheetOutput struct {
	Success bool   `json:"success"`
	Path    string `json:"path"`
	Width   int    `json:"width"`
	Height  int    `json:"height"`
	Cols    int    `json:"cols"`
	Rows    int    `json:"rows"`
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

func fsWrite(path string, data []byte) error {
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
	if len(sprites) == 0 {
		return
	}

	// Calculate row tolerance based on average sprite height
	totalHeight := 0
	for _, s := range sprites {
		totalHeight += s.Height
	}
	avgHeight := totalHeight / len(sprites)
	// Use half of average height as row tolerance
	rowTolerance := avgHeight / 2
	if rowTolerance < 4 {
		rowTolerance = 4 // minimum tolerance
	}

	// First, sort by Y to prepare for row clustering
	sort.Slice(sprites, func(i, j int) bool {
		return sprites[i].Y < sprites[j].Y
	})

	// Assign row indices by clustering sprites with similar Y values
	rowIndices := make([]int, len(sprites))
	currentRow := 0
	rowStartY := sprites[0].Y

	for i := range sprites {
		// If this sprite's Y is too far from row start, begin a new row
		if sprites[i].Y-rowStartY > rowTolerance {
			currentRow++
			rowStartY = sprites[i].Y
		}
		rowIndices[i] = currentRow
	}

	// Now sort by row index first, then by X within each row
	// Create index array for indirect sorting
	indices := make([]int, len(sprites))
	for i := range indices {
		indices[i] = i
	}

	sort.Slice(indices, func(i, j int) bool {
		ii, jj := indices[i], indices[j]
		if rowIndices[ii] != rowIndices[jj] {
			return rowIndices[ii] < rowIndices[jj]
		}
		return sprites[ii].X < sprites[jj].X
	})

	// Reorder sprites according to sorted indices
	sorted := make([]Sprite, len(sprites))
	for i, idx := range indices {
		sorted[i] = sprites[idx]
	}
	copy(sprites, sorted)
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

func saveImage(path string, img *image.NRGBA) error {
	var buf bytes.Buffer
	if err := qoi.Encode(&buf, img); err != nil {
		return err
	}
	return fsWrite(path, buf.Bytes())
}

//go:wasmexport exportSpritesheet
func ExportSpritesheet() int32 {
	input := pdk.Input()
	var params ExportSpritesheetInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.SourcePath == "" {
		pdk.Output(util.ErrorResponse("sourcePath is required"))
		return 1
	}
	if len(params.Sprites) == 0 {
		pdk.Output(util.ErrorResponse("sprites list is empty"))
		return 1
	}
	if params.CellW <= 0 || params.CellH <= 0 {
		pdk.Output(util.ErrorResponse("cellW and cellH must be positive"))
		return 1
	}
	if params.OutputPath == "" {
		params.OutputPath = "/sprites/spritesheet.qoi"
	}

	// Default pivot to center if not specified
	if params.DefaultPivot.X == 0 && params.DefaultPivot.Y == 0 {
		params.DefaultPivot = PivotPoint{X: 0.5, Y: 0.5}
	}

	// Load source image
	sourceImg, err := loadImage(params.SourcePath)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load source image: " + err.Error()))
		return 1
	}
	sourceW := sourceImg.Bounds().Dx()

	numSprites := len(params.Sprites)

	// Calculate square-ish grid layout
	cols := 1
	for cols*cols < numSprites {
		cols++
	}
	rows := (numSprites + cols - 1) / cols

	// Create spritesheet image (filled with transparent pixels by default)
	sheetW := cols * params.CellW
	sheetH := rows * params.CellH
	spritesheet := image.NewNRGBA(image.Rect(0, 0, sheetW, sheetH))

	logMsg(fmt.Sprintf("[sprite-detect] Creating spritesheet %dx%d (%d cols x %d rows) with %dx%d cells for %d sprites",
		sheetW, sheetH, cols, rows, params.CellW, params.CellH, numSprites))

	// Process each sprite
	for i, sprite := range params.Sprites {
		// Get pivot for this sprite (custom or default)
		pivot := params.DefaultPivot
		spriteIdxStr := fmt.Sprintf("%d", i)
		if customPivot, exists := params.Pivots[spriteIdxStr]; exists {
			pivot = customPivot
		}

		// Calculate where the pivot point is in the source sprite
		// Pivot is relative to sprite bounds (0,0 = top-left of sprite, 1,1 = bottom-right)
		spritePivotX := pivot.X * float64(sprite.Width)
		spritePivotY := pivot.Y * float64(sprite.Height)

		// Calculate position in output grid
		destCellX := (i % cols) * params.CellW
		destCellY := (i / cols) * params.CellH

		// Calculate the center of the output cell
		outputCenterX := float64(params.CellW) / 2.0
		outputCenterY := float64(params.CellH) / 2.0

		// Calculate offset to place sprite so its pivot aligns with output center
		offsetX := int(outputCenterX - spritePivotX)
		offsetY := int(outputCenterY - spritePivotY)

		// Copy sprite pixels from source to spritesheet with offset
		for y := 0; y < sprite.Height; y++ {
			for x := 0; x < sprite.Width; x++ {
				destX := destCellX + offsetX + x
				destY := destCellY + offsetY + y

				// Skip if outside output cell bounds
				if destX < destCellX || destX >= destCellX+params.CellW ||
					destY < destCellY || destY >= destCellY+params.CellH {
					continue
				}

				srcX := sprite.X + x
				srcY := sprite.Y + y
				srcIdx := (srcY*sourceW + srcX) * 4
				dstIdx := (destY*sheetW + destX) * 4
				copy(spritesheet.Pix[dstIdx:dstIdx+4], sourceImg.Pix[srcIdx:srcIdx+4])
			}
		}
	}

	// Save spritesheet
	if err := saveImage(params.OutputPath, spritesheet); err != nil {
		pdk.Output(util.ErrorResponse("failed to save spritesheet: " + err.Error()))
		return 1
	}

	logMsg(fmt.Sprintf("[sprite-detect] Saved spritesheet to %s", params.OutputPath))

	output := ExportSpritesheetOutput{
		Success: true,
		Path:    params.OutputPath,
		Width:   sheetW,
		Height:  sheetH,
		Cols:    cols,
		Rows:    rows,
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

// Required main function for WASM
func main() {}
