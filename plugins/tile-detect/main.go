package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"math"
	"sort"

	"github.com/justgook/gamectl/pkg/qoi"
	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/wpm/pdk"
)

// =============================================================================
// Input/Output Types
// =============================================================================

// DetectSizeInput for auto-detecting tile size
type DetectSizeInput struct {
	Path    string `json:"path"`    // Path to image file
	MinSize int    `json:"minSize"` // Minimum tile size to check (default: 8)
	MaxSize int    `json:"maxSize"` // Maximum tile size to check (default: 64)
}

// DetectSizeOutput returns detected tile dimensions
type DetectSizeOutput struct {
	Success    bool    `json:"success"`
	TileW      int     `json:"tileW"`
	TileH      int     `json:"tileH"`
	Confidence float64 `json:"confidence"` // 0-1, higher is better
}

// ExtractInput for extracting tiles and tilemap
type ExtractInput struct {
	Path         string `json:"path"`         // Source image path
	TileW        int    `json:"tileW"`        // Tile width
	TileH        int    `json:"tileH"`        // Tile height
	OutputDir    string `json:"outputDir"`    // Directory for tilebank images
	Tolerance    int    `json:"tolerance"`    // Color difference tolerance (0-255, default: 0)
	SkipNthPixel int    `json:"skipNthPixel"` // Sample every nth pixel for comparison (default: 1)
}

// TileBankEntry represents a unique tile
type TileBankEntry struct {
	ID   int    `json:"id"`   // Tile ID (1-based, 0 = empty)
	Path string `json:"path"` // Path to tile image
	Hash uint64 `json:"hash"` // Hash for identification
}

// ExtractOutput returns extraction result
type ExtractOutput struct {
	Success  bool            `json:"success"`
	Tilebank []TileBankEntry `json:"tilebank"`
	Tilemap  TilemapData     `json:"tilemap"`
}

// TilemapData is a simplified tilemap for output
type TilemapData struct {
	Width  int      `json:"width"`  // Width in tiles
	Height int      `json:"height"` // Height in tiles
	TileW  int      `json:"tileW"`  // Tile width in pixels
	TileH  int      `json:"tileH"`  // Tile height in pixels
	Data   []uint32 `json:"data"`   // Tile indices (row-major)
}

// ExportTilesetInput for combining tiles into a single tileset image
type ExportTilesetInput struct {
	Tilebank   []TileBankEntry `json:"tilebank"`   // Tilebank from extract output
	TileW      int             `json:"tileW"`      // Tile width in pixels
	TileH      int             `json:"tileH"`      // Tile height in pixels
	OutputPath string          `json:"outputPath"` // Output path for tileset image
}

// ExportTilesetOutput returns tileset generation result
type ExportTilesetOutput struct {
	Success bool   `json:"success"`
	Path    string `json:"path"`   // Path to generated tileset
	Width   int    `json:"width"`  // Tileset image width in pixels
	Height  int    `json:"height"` // Tileset image height in pixels
	Cols    int    `json:"cols"`   // Number of columns in grid
	Rows    int    `json:"rows"`   // Number of rows in grid
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

func fsMkdir(path string) error {
	status, output, err := pdk.Call("fs", "mkdir", []byte(path))
	if err != nil {
		return fmt.Errorf("fs mkdir error: %w", err)
	}
	if status != 0 {
		return fmt.Errorf("fs mkdir failed: %s", string(output))
	}
	return nil
}

func logMsg(msg string) {
	pdk.Call("host", "log", []byte(msg))
}

// =============================================================================
// Image handling
// =============================================================================

func loadImage(path string) (*image.NRGBA, error) {
	data, err := fsRead(path)
	if err != nil {
		return nil, err
	}

	var img image.Image

	if len(data) >= 4 && string(data[:4]) == "qoif" {
		img, err = qoi.Decode(bytes.NewReader(data))
	} else {
		img, err = png.Decode(bytes.NewReader(data))
	}
	if err != nil {
		return nil, err
	}

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

func saveImage(path string, img *image.NRGBA) error {
	var buf bytes.Buffer
	if err := qoi.Encode(&buf, img); err != nil {
		return err
	}
	return fsWrite(path, buf.Bytes())
}

// =============================================================================
// Tile hashing and comparison
// =============================================================================

// hashTile creates a simple hash of tile pixels
func hashTile(img *image.NRGBA, tileX, tileY, tileW, tileH, imgW, skipNth int) uint64 {
	var hash uint64
	startX := tileX * tileW
	startY := tileY * tileH

	step := skipNth
	if step < 1 {
		step = 1
	}

	for y := 0; y < tileH; y += step {
		for x := 0; x < tileW; x += step {
			px := startX + x
			py := startY + y
			idx := (py*imgW + px) * 4

			// FNV-1a inspired hash
			hash ^= uint64(img.Pix[idx])
			hash *= 0x100000001b3
			hash ^= uint64(img.Pix[idx+1])
			hash *= 0x100000001b3
			hash ^= uint64(img.Pix[idx+2])
			hash *= 0x100000001b3
			hash ^= uint64(img.Pix[idx+3])
			hash *= 0x100000001b3
		}
	}

	return hash
}

// tilesEqual compares two tiles with tolerance
func tilesEqual(img *image.NRGBA, t1x, t1y, t2x, t2y, tileW, tileH, imgW, tolerance, skipNth int) bool {
	step := skipNth
	if step < 1 {
		step = 1
	}

	s1x, s1y := t1x*tileW, t1y*tileH
	s2x, s2y := t2x*tileW, t2y*tileH

	for y := 0; y < tileH; y += step {
		for x := 0; x < tileW; x += step {
			idx1 := ((s1y+y)*imgW + (s1x + x)) * 4
			idx2 := ((s2y+y)*imgW + (s2x + x)) * 4

			for c := 0; c < 4; c++ {
				diff := int(img.Pix[idx1+c]) - int(img.Pix[idx2+c])
				if diff < 0 {
					diff = -diff
				}
				if diff > tolerance {
					return false
				}
			}
		}
	}

	return true
}

// isTileEmpty checks if a tile is fully transparent or single color
func isTileEmpty(img *image.NRGBA, tileX, tileY, tileW, tileH, imgW int) bool {
	startX := tileX * tileW
	startY := tileY * tileH

	// Get first pixel
	idx0 := (startY*imgW + startX) * 4
	r0, g0, b0, a0 := img.Pix[idx0], img.Pix[idx0+1], img.Pix[idx0+2], img.Pix[idx0+3]

	// Check if fully transparent
	if a0 == 0 {
		allTransparent := true
		for y := 0; y < tileH && allTransparent; y++ {
			for x := 0; x < tileW && allTransparent; x++ {
				idx := ((startY+y)*imgW + (startX + x)) * 4
				if img.Pix[idx+3] > 0 {
					allTransparent = false
				}
			}
		}
		if allTransparent {
			return true
		}
	}

	// Check if single color
	singleColor := true
	for y := 0; y < tileH && singleColor; y++ {
		for x := 0; x < tileW && singleColor; x++ {
			idx := ((startY+y)*imgW + (startX + x)) * 4
			if img.Pix[idx] != r0 || img.Pix[idx+1] != g0 ||
				img.Pix[idx+2] != b0 || img.Pix[idx+3] != a0 {
				singleColor = false
			}
		}
	}

	return singleColor && a0 == 0
}

// extractTileImage extracts a tile as a separate image
func extractTileImage(img *image.NRGBA, tileX, tileY, tileW, tileH, imgW int) *image.NRGBA {
	tile := image.NewNRGBA(image.Rect(0, 0, tileW, tileH))

	startX := tileX * tileW
	startY := tileY * tileH

	for y := 0; y < tileH; y++ {
		for x := 0; x < tileW; x++ {
			srcIdx := ((startY+y)*imgW + (startX + x)) * 4
			dstIdx := (y*tileW + x) * 4
			copy(tile.Pix[dstIdx:dstIdx+4], img.Pix[srcIdx:srcIdx+4])
		}
	}

	return tile
}

// =============================================================================
// Auto-detect tile size
// =============================================================================

func detectTileSize(img *image.NRGBA, minSize, maxSize int) (int, int, float64) {
	bounds := img.Bounds()
	imgW, imgH := bounds.Dx(), bounds.Dy()

	type candidate struct {
		w, h  int
		score float64
	}
	var candidates []candidate

	// Try different tile sizes
	for size := minSize; size <= maxSize; size++ {
		// Only consider sizes that divide evenly
		if imgW%size != 0 || imgH%size != 0 {
			continue
		}

		cols := imgW / size
		rows := imgH / size

		// Count duplicate tiles
		seen := make(map[uint64]int)
		for ty := 0; ty < rows; ty++ {
			for tx := 0; tx < cols; tx++ {
				hash := hashTile(img, tx, ty, size, size, imgW, 2)
				seen[hash]++
			}
		}

		// Calculate duplicate ratio
		totalTiles := cols * rows
		uniqueTiles := len(seen)
		duplicates := totalTiles - uniqueTiles
		duplicateRatio := float64(duplicates) / float64(totalTiles)

		// Higher duplicate ratio suggests correct tile size
		candidates = append(candidates, candidate{size, size, duplicateRatio})
	}

	if len(candidates) == 0 {
		// Fallback: find largest common divisor
		gcd := func(a, b int) int {
			for b != 0 {
				a, b = b, a%b
			}
			return a
		}
		size := gcd(imgW, imgH)
		if size > maxSize {
			size = maxSize
		}
		if size < minSize {
			size = minSize
		}
		return size, size, 0.1
	}

	// Sort by score (highest first)
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].score > candidates[j].score
	})

	best := candidates[0]
	return best.w, best.h, best.score
}

// =============================================================================
// Exported Functions
// =============================================================================

//go:wasmexport detectSize
func DetectSize() int32 {
	input := pdk.Input()
	var params DetectSizeInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.Path == "" {
		pdk.Output(util.ErrorResponse("path is required"))
		return 1
	}

	minSize := params.MinSize
	if minSize <= 0 {
		minSize = 8
	}
	maxSize := params.MaxSize
	if maxSize <= 0 {
		maxSize = 64
	}

	img, err := loadImage(params.Path)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load image: " + err.Error()))
		return 1
	}

	tileW, tileH, confidence := detectTileSize(img, minSize, maxSize)

	logMsg(fmt.Sprintf("[tile-detect] Detected tile size: %dx%d (confidence: %.2f)", tileW, tileH, confidence))

	output := DetectSizeOutput{
		Success:    true,
		TileW:      tileW,
		TileH:      tileH,
		Confidence: confidence,
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

//go:wasmexport extract
func Extract() int32 {
	input := pdk.Input()
	var params ExtractInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.Path == "" {
		pdk.Output(util.ErrorResponse("path is required"))
		return 1
	}
	if params.TileW <= 0 || params.TileH <= 0 {
		pdk.Output(util.ErrorResponse("tileW and tileH must be positive"))
		return 1
	}
	if params.OutputDir == "" {
		params.OutputDir = "/tiles"
	}

	tolerance := params.Tolerance
	if tolerance < 0 {
		tolerance = 0
	}
	skipNth := params.SkipNthPixel
	if skipNth <= 0 {
		skipNth = 1
	}

	img, err := loadImage(params.Path)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to load image: " + err.Error()))
		return 1
	}

	bounds := img.Bounds()
	imgW, imgH := bounds.Dx(), bounds.Dy()

	cols := imgW / params.TileW
	rows := imgH / params.TileH

	logMsg(fmt.Sprintf("[tile-detect] Extracting %dx%d tiles from %dx%d image", cols, rows, imgW, imgH))

	// Create output directory
	if err := fsMkdir(params.OutputDir); err != nil {
		// Directory might already exist, continue
		logMsg(fmt.Sprintf("[tile-detect] mkdir warning: %s", err.Error()))
	}

	// Track unique tiles by hash
	type uniqueTile struct {
		id    int
		hash  uint64
		tileX int
		tileY int
	}
	var uniqueTiles []uniqueTile
	hashToID := make(map[uint64]int)

	// Build tilemap data
	tilemapData := make([]uint32, cols*rows)

	for ty := 0; ty < rows; ty++ {
		for tx := 0; tx < cols; tx++ {
			tileIdx := ty*cols + tx

			// Check if empty
			if isTileEmpty(img, tx, ty, params.TileW, params.TileH, imgW) {
				tilemapData[tileIdx] = 0
				continue
			}

			// Compute hash
			hash := hashTile(img, tx, ty, params.TileW, params.TileH, imgW, skipNth)

			// Check if we've seen this hash
			if existingID, exists := hashToID[hash]; exists {
				// Verify with actual comparison if using tolerance
				if tolerance > 0 {
					found := false
					for _, ut := range uniqueTiles {
						if ut.hash == hash && tilesEqual(img, tx, ty, ut.tileX, ut.tileY,
							params.TileW, params.TileH, imgW, tolerance, skipNth) {
							tilemapData[tileIdx] = uint32(ut.id)
							found = true
							break
						}
					}
					if !found {
						// Hash collision but different tile
						newID := len(uniqueTiles) + 1
						uniqueTiles = append(uniqueTiles, uniqueTile{newID, hash, tx, ty})
						tilemapData[tileIdx] = uint32(newID)
					}
				} else {
					tilemapData[tileIdx] = uint32(existingID)
				}
			} else {
				// New unique tile
				newID := len(uniqueTiles) + 1
				uniqueTiles = append(uniqueTiles, uniqueTile{newID, hash, tx, ty})
				hashToID[hash] = newID
				tilemapData[tileIdx] = uint32(newID)
			}
		}
	}

	logMsg(fmt.Sprintf("[tile-detect] Found %d unique tiles", len(uniqueTiles)))

	// Save unique tiles and build tilebank
	var tilebank []TileBankEntry
	for _, ut := range uniqueTiles {
		tileImg := extractTileImage(img, ut.tileX, ut.tileY, params.TileW, params.TileH, imgW)
		tilePath := fmt.Sprintf("%s/tile_%03d.qoi", params.OutputDir, ut.id)

		if err := saveImage(tilePath, tileImg); err != nil {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("failed to save tile %d: %s", ut.id, err.Error())))
			return 1
		}

		tilebank = append(tilebank, TileBankEntry{
			ID:   ut.id,
			Path: tilePath,
			Hash: ut.hash,
		})
	}

	output := ExtractOutput{
		Success:  true,
		Tilebank: tilebank,
		Tilemap: TilemapData{
			Width:  cols,
			Height: rows,
			TileW:  params.TileW,
			TileH:  params.TileH,
			Data:   tilemapData,
		},
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

//go:wasmexport toTilemap
func ToTilemap() int32 {
	// Convert ExtractOutput to internal tilemap format
	input := pdk.Input()
	var extractOutput ExtractOutput
	if err := json.Unmarshal(input, &extractOutput); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm := &tilemap.TileMap{
		Props: map[string]string{
			"tileWidth":  fmt.Sprintf("%d", extractOutput.Tilemap.TileW),
			"tileHeight": fmt.Sprintf("%d", extractOutput.Tilemap.TileH),
		},
		Layers: []tilemap.TileLayer{
			{
				Width: extractOutput.Tilemap.Width,
				Data:  extractOutput.Tilemap.Data,
				Props: map[string]string{
					"name": "extracted",
				},
			},
		},
	}

	result, _ := json.Marshal(tm)
	pdk.Output(result)
	return 0
}

//go:wasmexport exportTileset
func ExportTileset() int32 {
	input := pdk.Input()
	var params ExportTilesetInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if len(params.Tilebank) == 0 {
		pdk.Output(util.ErrorResponse("tilebank is empty"))
		return 1
	}
	if params.TileW <= 0 || params.TileH <= 0 {
		pdk.Output(util.ErrorResponse("tileW and tileH must be positive"))
		return 1
	}
	if params.OutputPath == "" {
		params.OutputPath = "/tiles/tileset.qoi"
	}

	numTiles := len(params.Tilebank)

	// Calculate square-ish grid layout
	cols := int(math.Ceil(math.Sqrt(float64(numTiles))))
	rows := int(math.Ceil(float64(numTiles) / float64(cols)))

	// Create tileset image
	tilesetW := cols * params.TileW
	tilesetH := rows * params.TileH
	tileset := image.NewNRGBA(image.Rect(0, 0, tilesetW, tilesetH))

	logMsg(fmt.Sprintf("[tile-detect] Creating tileset %dx%d (%d cols x %d rows) for %d tiles",
		tilesetW, tilesetH, cols, rows, numTiles))

	// Sort tilebank by ID to ensure correct order
	sortedTilebank := make([]TileBankEntry, len(params.Tilebank))
	copy(sortedTilebank, params.Tilebank)
	sort.Slice(sortedTilebank, func(i, j int) bool {
		return sortedTilebank[i].ID < sortedTilebank[j].ID
	})

	// Load and composite each tile
	for _, tile := range sortedTilebank {
		// Load tile image
		tileImg, err := loadImage(tile.Path)
		if err != nil {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("failed to load tile %d: %s", tile.ID, err.Error())))
			return 1
		}

		// Calculate position in tileset grid (0-based index from 1-based ID)
		tileIndex := tile.ID - 1
		destX := (tileIndex % cols) * params.TileW
		destY := (tileIndex / cols) * params.TileH

		// Copy tile pixels to tileset
		tileBounds := tileImg.Bounds()
		for y := 0; y < tileBounds.Dy() && y < params.TileH; y++ {
			for x := 0; x < tileBounds.Dx() && x < params.TileW; x++ {
				srcIdx := (y*tileBounds.Dx() + x) * 4
				dstIdx := ((destY+y)*tilesetW + (destX + x)) * 4
				copy(tileset.Pix[dstIdx:dstIdx+4], tileImg.Pix[srcIdx:srcIdx+4])
			}
		}
	}

	// Save tileset
	if err := saveImage(params.OutputPath, tileset); err != nil {
		pdk.Output(util.ErrorResponse("failed to save tileset: " + err.Error()))
		return 1
	}

	logMsg(fmt.Sprintf("[tile-detect] Saved tileset to %s", params.OutputPath))

	output := ExportTilesetOutput{
		Success: true,
		Path:    params.OutputPath,
		Width:   tilesetW,
		Height:  tilesetH,
		Cols:    cols,
		Rows:    rows,
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

// Required main function for WASM
func main() {}
