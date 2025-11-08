// Package main implements the tilemap-storage WASM plugin for GameCtl.
//
// This plugin provides a centralized storage system for multiple tilemaps that can be
// accessed by other plugins via pdk.Call(). It maintains an in-memory map of tilemaps
// during the plugin's lifecycle.
//
// Features:
//   - Create, retrieve, and update tilemaps
//   - Fine-grained access to layers and individual tiles
//   - Query tilemaps by metadata
//   - Granular setters/getters for all struct fields
//
// The plugin exposes 17 functions organized into three categories:
//   - TileMap operations: set, get, setMeta, getMeta, list, select
//   - TileLayer operations: setLayer, getLayer, setLayerWidth, getLayerWidth, setLayerData, getLayerData, setLayerMeta, getLayerMeta, selectLayer
//   - Tile operations: setTile, getTile
package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/justgook/gamectl/pkg/tilemap"
	"github.com/justgook/wpm/pdk"
)

// Global storage - persists while WASM module is loaded
var storage = make(map[string]*tilemap.TileMap)

// Response types for JSON output
type SuccessResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type ValueResponse struct {
	Value any    `json:"value"`
	Error string `json:"error,omitempty"`
}

type ListResponse struct {
	IDs     []string `json:"ids,omitempty"`
	Indices []int    `json:"indices,omitempty"`
	Error   string   `json:"error,omitempty"`
}

// =============================================================================
// TileMap-level operations
// =============================================================================

//go:wasmexport set
func Set() int32 {
	input := pdk.Input()
	var req struct {
		ID  string           `json:"id"`
		Map *tilemap.TileMap `json:"map"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	if req.ID == "" {
		pdk.Output(errorResponse("id is required"))
		return 1
	}

	if req.Map == nil {
		pdk.Output(errorResponse("map is required"))
		return 1
	}

	storage[req.ID] = req.Map
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport get
func Get() int32 {
	input := pdk.Input()
	var req struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	output, err := json.Marshal(tm)
	if err != nil {
		pdk.Output(errorResponse("failed to marshal tilemap: " + err.Error()))
		return 1
	}

	pdk.Output(output)
	return 0
}

//go:wasmexport setMeta
func SetMeta() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if tm.Meta == nil {
		tm.Meta = make(map[string]string)
	}

	tm.Meta[req.Key] = req.Value
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getMeta
func GetMeta() int32 {
	input := pdk.Input()
	var req struct {
		ID  string `json:"id"`
		Key string `json:"key"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	value, ok := tm.Meta[req.Key]
	if !ok {
		pdk.Output(valueResponse(""))
		return 0
	}

	pdk.Output(valueResponse(value))
	return 0
}

//go:wasmexport list
func List() int32 {
	var result []string
	for id := range storage {
		result = append(result, id)
	}

	pdk.Output(listResponse(result, nil))
	return 0
}

//go:wasmexport select
func Select() int32 {
	input := pdk.Input()
	var req struct {
		Query string `json:"query"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	// Parse simple query: "key=value"
	parts := strings.SplitN(req.Query, "=", 2)
	if len(parts) != 2 {
		pdk.Output(errorResponse("invalid query format, expected 'key=value'"))
		return 1
	}
	key := strings.TrimSpace(parts[0])
	value := strings.TrimSpace(parts[1])

	var result []string
	for id, tm := range storage {
		if metaValue, ok := tm.Meta[key]; ok && metaValue == value {
			result = append(result, id)
		}
	}

	pdk.Output(listResponse(result, nil))
	return 0
}

// =============================================================================
// TileLayer operations
// =============================================================================

//go:wasmexport setLayer
func SetLayer() int32 {
	input := pdk.Input()
	var req struct {
		ID    string             `json:"id"`
		Index int                `json:"index"`
		Layer *tilemap.TileLayer `json:"layer"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Layer == nil {
		pdk.Output(errorResponse("layer is required"))
		return 1
	}

	// Ensure layers array is large enough
	for len(tm.Layers) <= req.Index {
		tm.Layers = append(tm.Layers, tilemap.TileLayer{})
	}

	tm.Layers[req.Index] = *req.Layer
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getLayer
func GetLayer() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Index int    `json:"index"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	output, err := json.Marshal(tm.Layers[req.Index])
	if err != nil {
		pdk.Output(errorResponse("failed to marshal layer: " + err.Error()))
		return 1
	}

	pdk.Output(output)
	return 0
}

//go:wasmexport setLayerWidth
func SetLayerWidth() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Index int    `json:"index"`
		Value int    `json:"value"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	tm.Layers[req.Index].Width = req.Value
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getLayerWidth
func GetLayerWidth() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Index int    `json:"index"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	pdk.Output(valueResponse(tm.Layers[req.Index].Width))
	return 0
}

//go:wasmexport setLayerData
func SetLayerData() int32 {
	input := pdk.Input()
	var req struct {
		ID    string   `json:"id"`
		Index int      `json:"index"`
		Data  []uint32 `json:"data"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	tm.Layers[req.Index].Data = req.Data
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getLayerData
func GetLayerData() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Index int    `json:"index"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	pdk.Output(valueResponse(tm.Layers[req.Index].Data))
	return 0
}

//go:wasmexport setLayerMeta
func SetLayerMeta() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Index int    `json:"index"`
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	if tm.Layers[req.Index].Meta == nil {
		tm.Layers[req.Index].Meta = make(map[string]string)
	}

	tm.Layers[req.Index].Meta[req.Key] = req.Value
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getLayerMeta
func GetLayerMeta() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Index int    `json:"index"`
		Key   string `json:"key"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	value, ok := tm.Layers[req.Index].Meta[req.Key]
	if !ok {
		pdk.Output(valueResponse(""))
		return 0
	}

	pdk.Output(valueResponse(value))
	return 0
}

//go:wasmexport selectLayer
func SelectLayer() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Query string `json:"query"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	// Parse simple query: "key=value"
	parts := strings.SplitN(req.Query, "=", 2)
	if len(parts) != 2 {
		pdk.Output(errorResponse("invalid query format, expected 'key=value'"))
		return 1
	}
	key := strings.TrimSpace(parts[0])
	value := strings.TrimSpace(parts[1])

	var result []int
	for i, layer := range tm.Layers {
		if metaValue, ok := layer.Meta[key]; ok && metaValue == value {
			result = append(result, i)
		}
	}

	pdk.Output(listResponse(nil, result))
	return 0
}

// =============================================================================
// Individual Tile operations
// =============================================================================

//go:wasmexport setTile
func SetTile() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Index int    `json:"index"`
		X     int    `json:"x"`
		Y     int    `json:"y"`
		Value uint32 `json:"value"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	layer := &tm.Layers[req.Index]

	// Bounds check
	if layer.Width == 0 {
		pdk.Output(errorResponse("layer width is 0"))
		return 1
	}

	height := layer.Height()
	if req.X < 0 || req.X >= layer.Width || req.Y < 0 || req.Y >= height {
		pdk.Output(errorResponse(fmt.Sprintf("coordinates (%d, %d) out of bounds (width=%d, height=%d)", req.X, req.Y, layer.Width, height)))
		return 1
	}

	// Calculate flat array index
	idx := req.Y*layer.Width + req.X
	if idx >= len(layer.Data) {
		pdk.Output(errorResponse(fmt.Sprintf("data array too small for calculated index %d", idx)))
		return 1
	}

	layer.Data[idx] = req.Value
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getTile
func GetTile() int32 {
	input := pdk.Input()
	var req struct {
		ID    string `json:"id"`
		Index int    `json:"index"`
		X     int    `json:"x"`
		Y     int    `json:"y"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	tm, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tilemap not found: " + req.ID))
		return 1
	}

	if req.Index < 0 || req.Index >= len(tm.Layers) {
		pdk.Output(errorResponse(fmt.Sprintf("layer index %d out of bounds", req.Index)))
		return 1
	}

	layer := &tm.Layers[req.Index]

	// Bounds check
	if layer.Width == 0 {
		pdk.Output(errorResponse("layer width is 0"))
		return 1
	}

	height := layer.Height()
	if req.X < 0 || req.X >= layer.Width || req.Y < 0 || req.Y >= height {
		pdk.Output(errorResponse(fmt.Sprintf("coordinates (%d, %d) out of bounds (width=%d, height=%d)", req.X, req.Y, layer.Width, height)))
		return 1
	}

	// Calculate flat array index
	idx := req.Y*layer.Width + req.X
	if idx >= len(layer.Data) {
		pdk.Output(errorResponse(fmt.Sprintf("data array too small for calculated index %d", idx)))
		return 1
	}

	pdk.Output(valueResponse(layer.Data[idx]))
	return 0
}

// =============================================================================
// Helper functions
// =============================================================================

func successResponse() []byte {
	resp := SuccessResponse{Success: true}
	data, _ := json.Marshal(resp)
	return data
}

func errorResponse(msg string) []byte {
	resp := SuccessResponse{Success: false, Error: msg}
	data, _ := json.Marshal(resp)
	return data
}

func valueResponse(value any) []byte {
	resp := ValueResponse{Value: value}
	data, _ := json.Marshal(resp)
	return data
}

func listResponse(ids []string, indices []int) []byte {
	resp := ListResponse{IDs: ids, Indices: indices}
	data, _ := json.Marshal(resp)
	return data
}

// Required main function for WASM
func main() {}
