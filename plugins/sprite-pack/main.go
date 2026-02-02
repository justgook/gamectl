package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hash/fnv"
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

// SpriteInput defines a sprite to pack
type SpriteInput struct {
	Path string `json:"path"` // Path to sprite image
	Name string `json:"name"` // Sprite name (for metadata)
}

// PackOptions defines packing configuration
type PackOptions struct {
	Padding     int  `json:"padding"`     // Padding between sprites (default: 0)
	Extrude     int  `json:"extrude"`     // Edge extrusion pixels (default: 0)
	PowerOfTwo  bool `json:"powerOfTwo"`  // Constrain to power of 2 dimensions
	MaxSize     int  `json:"maxSize"`     // Maximum atlas dimension (default: 4096)
	CropAlpha   bool `json:"cropAlpha"`   // Crop sprites to alpha bounds before packing
	Deduplicate bool `json:"deduplicate"` // Deduplicate identical sprites
	FlipY       bool `json:"flipY"`       // Vertically flip sprites
}

// PackInput for packing sprites
type PackInput struct {
	Sprites    []SpriteInput `json:"sprites"`    // Sprites to pack
	Options    PackOptions   `json:"options"`    // Packing options
	OutputPath string        `json:"outputPath"` // Output atlas image path
}

// Placement describes where a sprite is placed in the atlas
type Placement struct {
	Name   string `json:"name"`   // Sprite name
	X      int    `json:"x"`      // X position in atlas
	Y      int    `json:"y"`      // Y position in atlas
	Width  int    `json:"width"`  // Width in atlas (after crop)
	Height int    `json:"height"` // Height in atlas (after crop)
	// Original frame info (for reconstruction)
	FrameX int `json:"frameX"` // Offset X from original
	FrameY int `json:"frameY"` // Offset Y from original
	FrameW int `json:"frameW"` // Original width
	FrameH int `json:"frameH"` // Original height
	// Deduplication and ordering info
	OriginalIndex int `json:"originalIndex"`         // Index in input array (for mapping back)
	DuplicateOf   int `json:"duplicateOf,omitempty"` // Index of canonical sprite (-1 if unique)
}

// =============================================================================
// PackTiles Types - for packing tiles from spritesheets
// =============================================================================

// TileInput defines a tile region to extract from a spritesheet
type TileInput struct {
	Path   string `json:"path"`   // Source spritesheet path
	Name   string `json:"name"`   // Identifier for this tile
	TileId int    `json:"tileId"` // Tile index in grid (row-major)
	TileW  int    `json:"tileW"`  // Tile width in pixels
	TileH  int    `json:"tileH"`  // Tile height in pixels
}

// PackTilesInput for packing tiles from spritesheets
type PackTilesInput struct {
	Tiles      []TileInput `json:"tiles"`
	Options    PackOptions `json:"options"`
	OutputPath string      `json:"outputPath"`
}

// PackTilesOutput returns packing result with original index mapping
type PackTilesOutput struct {
	Success    bool        `json:"success"`
	Placements []Placement `json:"placements"`
	AtlasW     int         `json:"atlasW"`
	AtlasH     int         `json:"atlasH"`
}

// PackOutput returns packing result
type PackOutput struct {
	Success    bool        `json:"success"`
	Placements []Placement `json:"placements"`
	AtlasW     int         `json:"atlasW"`
	AtlasH     int         `json:"atlasH"`
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
// Alpha cropping
// =============================================================================

type croppedSprite struct {
	name  string
	img   *image.NRGBA
	cropX int // Offset from original left
	cropY int // Offset from original top
	origW int // Original width
	origH int // Original height
}

func cropToAlpha(img *image.NRGBA) (cropped *image.NRGBA, offsetX, offsetY int) {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	stride := img.Stride

	minX, minY := w, h
	maxX, maxY := 0, 0

	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			// Use Stride for correct row access
			if img.Pix[y*stride+x*4+3] > 0 {
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

	// Fully transparent
	if minX > maxX || minY > maxY {
		result := image.NewNRGBA(image.Rect(0, 0, 1, 1))
		return result, 0, 0
	}

	cropW := maxX - minX + 1
	cropH := maxY - minY + 1
	result := image.NewNRGBA(image.Rect(0, 0, cropW, cropH))

	for y := 0; y < cropH; y++ {
		for x := 0; x < cropW; x++ {
			// Use Stride for source row access
			srcIdx := (minY+y)*stride + (minX+x)*4
			dstIdx := y*result.Stride + x*4
			copy(result.Pix[dstIdx:dstIdx+4], img.Pix[srcIdx:srcIdx+4])
		}
	}

	return result, minX, minY
}

// flipImageY vertically flips an image (mirrors along horizontal axis)
func flipImageY(img *image.NRGBA) *image.NRGBA {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	flipped := image.NewNRGBA(image.Rect(0, 0, w, h))

	for y := 0; y < h; y++ {
		srcY := h - 1 - y // Flip Y coordinate
		for x := 0; x < w; x++ {
			srcIdx := srcY*img.Stride + x*4
			dstIdx := y*flipped.Stride + x*4
			copy(flipped.Pix[dstIdx:dstIdx+4], img.Pix[srcIdx:srcIdx+4])
		}
	}
	return flipped
}

// =============================================================================
// MaxRects Bin Packing Algorithm
// =============================================================================

type rect struct {
	x, y, w, h int
}

type maxRectsPacker struct {
	width, height int
	freeRects     []rect
}

func newMaxRectsPacker(w, h int) *maxRectsPacker {
	return &maxRectsPacker{
		width:     w,
		height:    h,
		freeRects: []rect{{0, 0, w, h}},
	}
}

// findBestPosition finds the best position for a rect of given size
// Returns position and score (lower is better), or -1,-1 if not found
func (p *maxRectsPacker) findBestPosition(w, h int) (bestX, bestY, bestScore int) {
	bestX, bestY = -1, -1
	bestScore = p.width*p.height + 1 // Impossibly high

	for _, r := range p.freeRects {
		if w <= r.w && h <= r.h {
			// Best Short Side Fit (BSSF)
			leftoverH := r.h - h
			leftoverW := r.w - w
			shortSide := leftoverH
			if leftoverW < leftoverH {
				shortSide = leftoverW
			}

			if shortSide < bestScore {
				bestX = r.x
				bestY = r.y
				bestScore = shortSide
			}
		}
	}

	return bestX, bestY, bestScore
}

// placeRect places a rectangle and splits free rects
func (p *maxRectsPacker) placeRect(x, y, w, h int) {
	placed := rect{x, y, w, h}

	// Split overlapping free rects
	var newFreeRects []rect
	for _, free := range p.freeRects {
		if !rectsIntersect(placed, free) {
			newFreeRects = append(newFreeRects, free)
			continue
		}

		// Generate new free rects from the split
		// Left
		if placed.x > free.x {
			newFreeRects = append(newFreeRects, rect{
				x: free.x,
				y: free.y,
				w: placed.x - free.x,
				h: free.h,
			})
		}
		// Right
		if placed.x+placed.w < free.x+free.w {
			newFreeRects = append(newFreeRects, rect{
				x: placed.x + placed.w,
				y: free.y,
				w: free.x + free.w - (placed.x + placed.w),
				h: free.h,
			})
		}
		// Top
		if placed.y > free.y {
			newFreeRects = append(newFreeRects, rect{
				x: free.x,
				y: free.y,
				w: free.w,
				h: placed.y - free.y,
			})
		}
		// Bottom
		if placed.y+placed.h < free.y+free.h {
			newFreeRects = append(newFreeRects, rect{
				x: free.x,
				y: placed.y + placed.h,
				w: free.w,
				h: free.y + free.h - (placed.y + placed.h),
			})
		}
	}

	// Remove redundant free rects (contained within others)
	p.freeRects = pruneContained(newFreeRects)
}

func rectsIntersect(a, b rect) bool {
	return !(a.x >= b.x+b.w || a.x+a.w <= b.x ||
		a.y >= b.y+b.h || a.y+a.h <= b.y)
}

func rectContains(outer, inner rect) bool {
	return inner.x >= outer.x && inner.y >= outer.y &&
		inner.x+inner.w <= outer.x+outer.w &&
		inner.y+inner.h <= outer.y+outer.h
}

func pruneContained(rects []rect) []rect {
	var result []rect
	for i, r := range rects {
		contained := false
		for j, other := range rects {
			if i != j && rectContains(other, r) {
				contained = true
				break
			}
		}
		if !contained {
			result = append(result, r)
		}
	}
	return result
}

// =============================================================================
// Pack sprites
// =============================================================================

func nextPowerOfTwo(n int) int {
	if n <= 0 {
		return 1
	}
	n--
	n |= n >> 1
	n |= n >> 2
	n |= n >> 4
	n |= n >> 8
	n |= n >> 16
	return n + 1
}

func packSprites(sprites []croppedSprite, opts PackOptions) ([]Placement, int, int, error) {
	if len(sprites) == 0 {
		return nil, 0, 0, fmt.Errorf("no sprites to pack")
	}

	maxSize := opts.MaxSize
	if maxSize <= 0 {
		maxSize = 4096
	}

	padding := opts.Padding
	extrude := opts.Extrude

	// Calculate padded dimensions for each sprite
	type paddedSprite struct {
		sprite      croppedSprite
		paddedW     int
		paddedH     int
		area        int
		placement   Placement
		originalIdx int // Track original index before sorting
	}

	padded := make([]paddedSprite, len(sprites))
	for i, s := range sprites {
		bounds := s.img.Bounds()
		w := bounds.Dx() + padding*2 + extrude*2
		h := bounds.Dy() + padding*2 + extrude*2
		padded[i] = paddedSprite{
			sprite:      s,
			paddedW:     w,
			paddedH:     h,
			area:        w * h,
			originalIdx: i,
		}
	}

	// Sort by area (largest first)
	sort.Slice(padded, func(i, j int) bool {
		return padded[i].area > padded[j].area
	})

	// Try progressively larger atlas sizes
	startSize := 64
	for size := startSize; size <= maxSize; size *= 2 {
		atlasW, atlasH := size, size

		if opts.PowerOfTwo {
			atlasW = nextPowerOfTwo(atlasW)
			atlasH = nextPowerOfTwo(atlasH)
		}

		packer := newMaxRectsPacker(atlasW, atlasH)
		success := true

		for i := range padded {
			x, y, _ := packer.findBestPosition(padded[i].paddedW, padded[i].paddedH)
			if x < 0 {
				success = false
				break
			}

			packer.placeRect(x, y, padded[i].paddedW, padded[i].paddedH)

			// Store placement (accounting for padding/extrude offset)
			imgBounds := padded[i].sprite.img.Bounds()
			padded[i].placement = Placement{
				Name:   padded[i].sprite.name,
				X:      x + padding + extrude,
				Y:      y + padding + extrude,
				Width:  imgBounds.Dx(),
				Height: imgBounds.Dy(),
				FrameX: padded[i].sprite.cropX,
				FrameY: padded[i].sprite.cropY,
				FrameW: padded[i].sprite.origW,
				FrameH: padded[i].sprite.origH,
			}
		}

		if success {
			// Calculate actual used size
			maxX, maxY := 0, 0
			for _, p := range padded {
				endX := p.placement.X + p.placement.Width + padding + extrude
				endY := p.placement.Y + p.placement.Height + padding + extrude
				if endX > maxX {
					maxX = endX
				}
				if endY > maxY {
					maxY = endY
				}
			}

			finalW, finalH := maxX, maxY
			if opts.PowerOfTwo {
				finalW = nextPowerOfTwo(maxX)
				finalH = nextPowerOfTwo(maxY)
			}

			// Return placements in ORIGINAL order (not sorted order)
			// so that placements[i] corresponds to sprites[i]
			placements := make([]Placement, len(padded))
			for _, p := range padded {
				placements[p.originalIdx] = p.placement
			}

			return placements, finalW, finalH, nil
		}
	}

	return nil, 0, 0, fmt.Errorf("sprites don't fit in %dx%d atlas", maxSize, maxSize)
}

// =============================================================================
// Extrude edges
// =============================================================================

func extrudeEdges(atlas *image.NRGBA, p Placement, extrude int) {
	if extrude <= 0 {
		return
	}

	stride := atlas.Stride

	// Get pixel helper using Stride for correct row access
	getPixel := func(x, y int) [4]byte {
		idx := y*stride + x*4
		return [4]byte{atlas.Pix[idx], atlas.Pix[idx+1], atlas.Pix[idx+2], atlas.Pix[idx+3]}
	}
	setPixel := func(x, y int, c [4]byte) {
		idx := y*stride + x*4
		copy(atlas.Pix[idx:idx+4], c[:])
	}

	// Extrude left edge
	for e := 1; e <= extrude; e++ {
		for y := p.Y; y < p.Y+p.Height; y++ {
			c := getPixel(p.X, y)
			setPixel(p.X-e, y, c)
		}
	}

	// Extrude right edge
	for e := 1; e <= extrude; e++ {
		for y := p.Y; y < p.Y+p.Height; y++ {
			c := getPixel(p.X+p.Width-1, y)
			setPixel(p.X+p.Width-1+e, y, c)
		}
	}

	// Extrude top edge
	for e := 1; e <= extrude; e++ {
		for x := p.X; x < p.X+p.Width; x++ {
			c := getPixel(x, p.Y)
			setPixel(x, p.Y-e, c)
		}
	}

	// Extrude bottom edge
	for e := 1; e <= extrude; e++ {
		for x := p.X; x < p.X+p.Width; x++ {
			c := getPixel(x, p.Y+p.Height-1)
			setPixel(x, p.Y+p.Height-1+e, c)
		}
	}

	// Extrude corners
	for ey := 1; ey <= extrude; ey++ {
		for ex := 1; ex <= extrude; ex++ {
			// Top-left
			c := getPixel(p.X, p.Y)
			setPixel(p.X-ex, p.Y-ey, c)
			// Top-right
			c = getPixel(p.X+p.Width-1, p.Y)
			setPixel(p.X+p.Width-1+ex, p.Y-ey, c)
			// Bottom-left
			c = getPixel(p.X, p.Y+p.Height-1)
			setPixel(p.X-ex, p.Y+p.Height-1+ey, c)
			// Bottom-right
			c = getPixel(p.X+p.Width-1, p.Y+p.Height-1)
			setPixel(p.X+p.Width-1+ex, p.Y+p.Height-1+ey, c)
		}
	}
}

// =============================================================================
// Exported Functions
// =============================================================================

//go:wasmexport pack
func Pack() int32 {
	input := pdk.Input()
	var params PackInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.OutputPath == "" {
		pdk.Output(util.ErrorResponse("outputPath is required"))
		return 1
	}
	if len(params.Sprites) == 0 {
		pdk.Output(util.ErrorResponse("at least one sprite is required"))
		return 1
	}

	logMsg(fmt.Sprintf("[sprite-pack] Packing %d sprites", len(params.Sprites)))

	// Load and optionally crop sprites
	var sprites []croppedSprite
	for i, s := range params.Sprites {
		if s.Path == "" {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("sprite %d: path is required", i)))
			return 1
		}

		img, err := loadImage(s.Path)
		if err != nil {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("sprite %d: %s", i, err.Error())))
			return 1
		}

		name := s.Name
		if name == "" {
			name = fmt.Sprintf("sprite_%d", i)
		}

		bounds := img.Bounds()
		origW, origH := bounds.Dx(), bounds.Dy()

		var cropX, cropY int
		if params.Options.CropAlpha {
			img, cropX, cropY = cropToAlpha(img)
		}

		if params.Options.FlipY {
			img = flipImageY(img)
		}

		sprites = append(sprites, croppedSprite{
			name:  name,
			img:   img,
			cropX: cropX,
			cropY: cropY,
			origW: origW,
			origH: origH,
		})
	}

	// Pack sprites
	placements, atlasW, atlasH, err := packSprites(sprites, params.Options)
	if err != nil {
		pdk.Output(util.ErrorResponse(err.Error()))
		return 1
	}

	logMsg(fmt.Sprintf("[sprite-pack] Packed into %dx%d atlas", atlasW, atlasH))

	// Create atlas image
	atlas := image.NewNRGBA(image.Rect(0, 0, atlasW, atlasH))

	// Composite sprites into atlas
	for i, p := range placements {
		sprite := sprites[i].img

		// Copy sprite pixels to atlas using Stride for correct row access
		for y := 0; y < p.Height; y++ {
			for x := 0; x < p.Width; x++ {
				srcIdx := y*sprite.Stride + x*4
				dstIdx := (p.Y+y)*atlas.Stride + (p.X+x)*4
				copy(atlas.Pix[dstIdx:dstIdx+4], sprite.Pix[srcIdx:srcIdx+4])
			}
		}

		// Extrude edges if needed
		if params.Options.Extrude > 0 {
			extrudeEdges(atlas, p, params.Options.Extrude)
		}
	}

	// Save atlas
	if err := saveImage(params.OutputPath, atlas); err != nil {
		pdk.Output(util.ErrorResponse("failed to save atlas: " + err.Error()))
		return 1
	}

	output := PackOutput{
		Success:    true,
		Placements: placements,
		AtlasW:     atlasW,
		AtlasH:     atlasH,
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

// =============================================================================
// Hash function for deduplication
// =============================================================================

func hashImage(img *image.NRGBA) uint64 {
	h := fnv.New64a()
	bounds := img.Bounds()
	w, hh := bounds.Dx(), bounds.Dy()
	// Write dimensions to hash
	h.Write([]byte{byte(w >> 8), byte(w), byte(hh >> 8), byte(hh)})
	// Write pixel data
	h.Write(img.Pix)
	return h.Sum64()
}

// =============================================================================
// PackTiles - Pack tiles from spritesheets with deduplication
// =============================================================================

//go:wasmexport packTiles
func PackTiles() int32 {
	input := pdk.Input()
	var params PackTilesInput
	if err := json.Unmarshal(input, &params); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if params.OutputPath == "" {
		pdk.Output(util.ErrorResponse("outputPath is required"))
		return 1
	}
	if len(params.Tiles) == 0 {
		pdk.Output(util.ErrorResponse("at least one tile is required"))
		return 1
	}

	logMsg(fmt.Sprintf("[sprite-pack] Packing %d tiles", len(params.Tiles)))

	// Image cache to avoid reloading the same spritesheet
	imageCache := make(map[string]*image.NRGBA)

	// Extended sprite info with original index
	type indexedSprite struct {
		sprite        croppedSprite
		originalIndex int
		hash          uint64
		duplicateOf   int // -1 if unique, otherwise index of canonical sprite
	}

	var allSprites []indexedSprite

	// Hash to first occurrence index (for deduplication)
	hashToIndex := make(map[uint64]int)

	// Process each tile
	for i, tile := range params.Tiles {
		if tile.Path == "" {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("tile %d: path is required", i)))
			return 1
		}
		if tile.TileW <= 0 || tile.TileH <= 0 {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("tile %d: tileW and tileH must be positive", i)))
			return 1
		}

		// Load image from cache or file
		srcImg, ok := imageCache[tile.Path]
		if !ok {
			var err error
			srcImg, err = loadImage(tile.Path)
			if err != nil {
				pdk.Output(util.ErrorResponse(fmt.Sprintf("tile %d: %s", i, err.Error())))
				return 1
			}
			imageCache[tile.Path] = srcImg
		}

		// Calculate tile position from tileId
		srcBounds := srcImg.Bounds()
		srcW := srcBounds.Dx()
		srcH := srcBounds.Dy()
		cols := srcW / tile.TileW
		if cols <= 0 {
			cols = 1
		}

		tileX := (tile.TileId % cols) * tile.TileW
		tileY := (tile.TileId / cols) * tile.TileH

		// Bounds check
		if tileX+tile.TileW > srcW || tileY+tile.TileH > srcH {
			pdk.Output(util.ErrorResponse(fmt.Sprintf("tile %d: tileId %d out of bounds (tile at %d,%d size %dx%d, image %dx%d)",
				i, tile.TileId, tileX, tileY, tile.TileW, tile.TileH, srcW, srcH)))
			return 1
		}

		// Extract tile region using image.NRGBA's Stride for correct row access
		tileImg := image.NewNRGBA(image.Rect(0, 0, tile.TileW, tile.TileH))
		for y := 0; y < tile.TileH; y++ {
			for x := 0; x < tile.TileW; x++ {
				// Use Stride for source row calculation (handles images with non-zero origin)
				srcIdx := (tileY+y)*srcImg.Stride + (tileX+x)*4
				dstIdx := y*tileImg.Stride + x*4
				copy(tileImg.Pix[dstIdx:dstIdx+4], srcImg.Pix[srcIdx:srcIdx+4])
			}
		}

		// Apply alpha cropping if enabled
		var cropX, cropY int
		origW, origH := tile.TileW, tile.TileH
		if params.Options.CropAlpha {
			tileImg, cropX, cropY = cropToAlpha(tileImg)
		}

		if params.Options.FlipY {
			tileImg = flipImageY(tileImg)
		}

		name := tile.Name
		if name == "" {
			name = fmt.Sprintf("tile_%d", i)
		}

		sprite := croppedSprite{
			name:  name,
			img:   tileImg,
			cropX: cropX,
			cropY: cropY,
			origW: origW,
			origH: origH,
		}

		// Compute hash for deduplication
		spriteHash := hashImage(tileImg)

		// Check for duplicate
		duplicateOf := -1
		if params.Options.Deduplicate {
			if existingIdx, exists := hashToIndex[spriteHash]; exists {
				duplicateOf = existingIdx
			} else {
				hashToIndex[spriteHash] = i
			}
		}

		allSprites = append(allSprites, indexedSprite{
			sprite:        sprite,
			originalIndex: i,
			hash:          spriteHash,
			duplicateOf:   duplicateOf,
		})
	}

	// Collect unique sprites for packing
	var uniqueSprites []croppedSprite
	var uniqueIndices []int // Maps packed index -> original index
	for _, s := range allSprites {
		if s.duplicateOf == -1 {
			uniqueSprites = append(uniqueSprites, s.sprite)
			uniqueIndices = append(uniqueIndices, s.originalIndex)
		}
	}

	if len(uniqueSprites) == 0 {
		pdk.Output(util.ErrorResponse("no unique sprites to pack"))
		return 1
	}

	logMsg(fmt.Sprintf("[sprite-pack] %d unique sprites after deduplication", len(uniqueSprites)))

	// Pack unique sprites
	placements, atlasW, atlasH, err := packSprites(uniqueSprites, params.Options)
	if err != nil {
		pdk.Output(util.ErrorResponse(err.Error()))
		return 1
	}

	logMsg(fmt.Sprintf("[sprite-pack] Packed into %dx%d atlas", atlasW, atlasH))

	// Create atlas image
	atlas := image.NewNRGBA(image.Rect(0, 0, atlasW, atlasH))

	// Build a map from original index to placement index for unique sprites
	originalToPackedIdx := make(map[int]int)
	for packedIdx, origIdx := range uniqueIndices {
		originalToPackedIdx[origIdx] = packedIdx
	}

	// Composite unique sprites into atlas
	for packedIdx, p := range placements {
		sprite := uniqueSprites[packedIdx].img

		// Copy sprite pixels to atlas using Stride for correct row access
		for y := 0; y < p.Height; y++ {
			for x := 0; x < p.Width; x++ {
				srcIdx := y*sprite.Stride + x*4
				dstIdx := (p.Y+y)*atlas.Stride + (p.X+x)*4
				copy(atlas.Pix[dstIdx:dstIdx+4], sprite.Pix[srcIdx:srcIdx+4])
			}
		}

		// Extrude edges if needed
		if params.Options.Extrude > 0 {
			extrudeEdges(atlas, p, params.Options.Extrude)
		}
	}

	// Save atlas
	if err := saveImage(params.OutputPath, atlas); err != nil {
		pdk.Output(util.ErrorResponse("failed to save atlas: " + err.Error()))
		return 1
	}

	// Build final placements array (in original input order)
	finalPlacements := make([]Placement, len(allSprites))
	for i, s := range allSprites {
		var p Placement
		if s.duplicateOf == -1 {
			// Unique sprite - get placement from packed results
			packedIdx := originalToPackedIdx[s.originalIndex]
			p = placements[packedIdx]
		} else {
			// Duplicate sprite - copy placement from canonical sprite
			canonicalPackedIdx := originalToPackedIdx[s.duplicateOf]
			p = placements[canonicalPackedIdx]
		}

		finalPlacements[i] = Placement{
			Name:          s.sprite.name,
			X:             p.X,
			Y:             p.Y,
			Width:         p.Width,
			Height:        p.Height,
			FrameX:        s.sprite.cropX,
			FrameY:        s.sprite.cropY,
			FrameW:        s.sprite.origW,
			FrameH:        s.sprite.origH,
			OriginalIndex: s.originalIndex,
			DuplicateOf:   s.duplicateOf,
		}
	}

	output := PackTilesOutput{
		Success:    true,
		Placements: finalPlacements,
		AtlasW:     atlasW,
		AtlasH:     atlasH,
	}

	result, _ := json.Marshal(output)
	pdk.Output(result)
	return 0
}

// Required main function for WASM
func main() {}
