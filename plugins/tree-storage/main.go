// Package main implements the tree-storage WASM plugin for GameCtl.
//
// This plugin provides centralized storage for tree structures that can be
// accessed by other plugins via pdk.Call(). It maintains an in-memory map of trees
// during the plugin's lifecycle.
//
// Features:
//   - Store and retrieve tree.Tree instances
//   - Simple set/get API for tree management
//
// The plugin exposes three functions:
//   - set: Store a tree with an ID
//   - get: Retrieve a tree by ID
//   - list: List all stored tree IDs
package main

import (
	"encoding/json"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/gamectl/pkg/util"
	"github.com/justgook/wpm/pdk"
)

// Global storage - persists while WASM module is loaded
var storage = make(map[string]*tree.Tree)

// Response types for JSON output
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
		ID   string     `json:"id"`
		Tree *tree.Tree `json:"tree"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	if req.ID == "" {
		pdk.Output(util.ErrorResponse("id is required"))
		return 1
	}

	if req.Tree == nil {
		pdk.Output(util.ErrorResponse("tree is required"))
		return 1
	}

	storage[req.ID] = req.Tree
	pdk.Output(util.SuccessResponse())
	return 0
}

//go:wasmexport get
func Get() int32 {
	input := pdk.Input()
	var req struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(util.ErrorResponse("invalid input: " + err.Error()))
		return 1
	}

	t, exists := storage[req.ID]
	if !exists {
		pdk.Output(util.ErrorResponse("tree not found: " + req.ID))
		return 1
	}

	output, err := json.Marshal(t)
	if err != nil {
		pdk.Output(util.ErrorResponse("failed to marshal tree: " + err.Error()))
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

func listResponse(ids []string) []byte {
	resp := ListResponse{IDs: ids}
	data, _ := json.Marshal(resp)
	return data
}
