// Package main implements the tree-storage2 WASM plugin for GameCtl.
//
// This plugin provides centralized storage for tree3 structures that can be
// accessed by other plugins via pdk.Call(). It maintains an in-memory map of trees
// during the plugin's lifecycle.
//
// Features:
//   - Store and retrieve tree3.Tree instances
//   - Simple set/get API for tree management
//
// The plugin exposes three functions:
//   - set: Store a tree with an ID
//   - get: Retrieve a tree by ID
//   - list: List all stored tree IDs
package main

import (
	"encoding/json"

	"github.com/justgook/gamectl/pkg/tree3"
	"github.com/justgook/wpm/pdk"
)

// Global storage - persists while WASM module is loaded
var storage = make(map[string]*tree3.Tree)

// Response types for JSON output
type SuccessResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

type ListResponse struct {
	IDs   []string `json:"ids,omitempty"`
	Error string   `json:"error,omitempty"`
}

// =============================================================================
// Tree-level operations
// =============================================================================

//go:wasmexport set
func Set() int32 {
	input := pdk.Input()
	var req struct {
		ID   string      `json:"id"`
		Tree *tree3.Tree `json:"tree"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	if req.ID == "" {
		pdk.Output(errorResponse("id is required"))
		return 1
	}

	if req.Tree == nil {
		pdk.Output(errorResponse("tree is required"))
		return 1
	}

	storage[req.ID] = req.Tree
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

	t, exists := storage[req.ID]
	if !exists {
		pdk.Output(errorResponse("tree not found: " + req.ID))
		return 1
	}

	output, err := json.Marshal(t)
	if err != nil {
		pdk.Output(errorResponse("failed to marshal tree: " + err.Error()))
		return 1
	}

	pdk.Output(output)
	return 0
}

//go:wasmexport list
func List() int32 {
	var result []string
	for id := range storage {
		result = append(result, id)
	}

	pdk.Output(listResponse(result))
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

func listResponse(ids []string) []byte {
	resp := ListResponse{IDs: ids}
	data, _ := json.Marshal(resp)
	return data
}

// Required main function for WASM
func main() {}
