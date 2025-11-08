// Package main implements the tree-storage WASM plugin for GameCtl.
//
// This plugin provides a centralized storage system for multiple trees that can be
// accessed by other plugins via pdk.Call(). It maintains an in-memory map of trees
// during the plugin's lifecycle.
//
// Features:
//   - Create, retrieve, and update trees
//   - Fine-grained access to nodes and edges
//   - Query trees by metadata
//   - Granular setters/getters for all struct fields
//
// The plugin exposes functions organized into three categories:
//   - Tree operations: set, get, setRoot, getRoot, list, select
//   - Node operations: addNode, getNode, setNodeData, getNodeData, getChildren, getParent, traverse
//   - Edge operations: addEdge, getEntranceEdge
package main

import (
	"encoding/json"
	"strings"

	"github.com/justgook/gamectl/pkg/tree"
	"github.com/justgook/wpm/pdk"
)

// Global storage - persists while WASM module is loaded
var storage = make(map[string]*tree.Tree)

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
	IDs   []string `json:"ids,omitempty"`
	Nodes []string `json:"nodes,omitempty"`
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

//go:wasmexport setRoot
func SetRoot() int32 {
	input := pdk.Input()
	var req struct {
		ID   string `json:"id"`
		Root string `json:"root"`
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

	t.Root = req.Root
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getRoot
func GetRoot() int32 {
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

	pdk.Output(valueResponse(t.Root))
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

	// Parse simple query: "root=nodeId"
	parts := strings.SplitN(req.Query, "=", 2)
	if len(parts) != 2 {
		pdk.Output(errorResponse("invalid query format, expected 'key=value'"))
		return 1
	}
	key := strings.TrimSpace(parts[0])
	value := strings.TrimSpace(parts[1])

	var result []string
	for id, t := range storage {
		if key == "root" && t.Root == value {
			result = append(result, id)
		}
	}

	pdk.Output(listResponse(result, nil))
	return 0
}

// =============================================================================
// Node operations
// =============================================================================

//go:wasmexport addNode
func AddNode() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		NodeID string `json:"nodeId"`
		Name   string `json:"name,omitempty"`
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

	if req.NodeID == "" {
		pdk.Output(errorResponse("nodeId is required"))
		return 1
	}

	if req.Name != "" {
		t.AddNode(req.NodeID, req.Name)
	} else {
		t.AddNode(req.NodeID)
	}

	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getNode
func GetNode() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		NodeID string `json:"nodeId"`
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

	node, ok := t.Nodes[req.NodeID]
	if !ok {
		pdk.Output(errorResponse("node not found: " + req.NodeID))
		return 1
	}

	output, err := json.Marshal(node)
	if err != nil {
		pdk.Output(errorResponse("failed to marshal node: " + err.Error()))
		return 1
	}

	pdk.Output(output)
	return 0
}

//go:wasmexport setNodeData
func SetNodeData() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		NodeID string `json:"nodeId"`
		Key    string `json:"key"`
		Value  string `json:"value"`
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

	node, ok := t.Nodes[req.NodeID]
	if !ok {
		pdk.Output(errorResponse("node not found: " + req.NodeID))
		return 1
	}

	if node.Data == nil {
		node.Data = make(map[string]string)
	}

	node.Data[req.Key] = req.Value
	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getNodeData
func GetNodeData() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		NodeID string `json:"nodeId"`
		Key    string `json:"key"`
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

	node, ok := t.Nodes[req.NodeID]
	if !ok {
		pdk.Output(errorResponse("node not found: " + req.NodeID))
		return 1
	}

	value, ok := node.Data[req.Key]
	if !ok {
		pdk.Output(valueResponse(""))
		return 0
	}

	pdk.Output(valueResponse(value))
	return 0
}

//go:wasmexport getChildren
func GetChildren() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		NodeID string `json:"nodeId"`
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

	children := t.GetChildren(req.NodeID)
	if children == nil {
		pdk.Output(valueResponse([]tree.Edge{}))
		return 0
	}

	pdk.Output(valueResponse(children))
	return 0
}

//go:wasmexport getParent
func GetParent() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		NodeID string `json:"nodeId"`
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

	parent := t.GetParent(req.NodeID)
	pdk.Output(valueResponse(parent))
	return 0
}

//go:wasmexport traverse
func Traverse() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		NodeID string `json:"nodeId"`
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

	var nodes []string
	t.Traverse(req.NodeID, func(nodeID string) {
		nodes = append(nodes, nodeID)
	})

	pdk.Output(listResponse(nil, nodes))
	return 0
}

//go:wasmexport getRandomNode
func GetRandomNode() int32 {
	input := pdk.Input()
	var req struct {
		ID string  `json:"id"`
		Pt float32 `json:"pt"`
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

	nodeID := t.GetRandomNode(req.Pt)
	pdk.Output(valueResponse(nodeID))
	return 0
}

// =============================================================================
// Edge operations
// =============================================================================

//go:wasmexport addEdge
func AddEdge() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		Parent string `json:"parent"`
		Child  string `json:"child"`
		Name   string `json:"name,omitempty"`
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

	if req.Parent == "" {
		pdk.Output(errorResponse("parent is required"))
		return 1
	}

	if req.Child == "" {
		pdk.Output(errorResponse("child is required"))
		return 1
	}

	err := t.AddEdge(req.Parent, req.Child, req.Name)
	if err != nil {
		pdk.Output(errorResponse(err.Error()))
		return 1
	}

	pdk.Output(successResponse())
	return 0
}

//go:wasmexport getEntranceEdge
func GetEntranceEdge() int32 {
	input := pdk.Input()
	var req struct {
		ID     string `json:"id"`
		NodeID string `json:"nodeId"`
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

	edge := t.GetEntranceEdge(req.NodeID)
	if edge == nil {
		pdk.Output(valueResponse(nil))
		return 0
	}

	output, err := json.Marshal(edge)
	if err != nil {
		pdk.Output(errorResponse("failed to marshal edge: " + err.Error()))
		return 1
	}

	pdk.Output(output)
	return 0
}

//go:wasmexport toJSON
func ToJSON() int32 {
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

	output, err := t.ToJSON()
	if err != nil {
		pdk.Output(errorResponse("failed to serialize tree: " + err.Error()))
		return 1
	}

	pdk.Output(output)
	return 0
}

//go:wasmexport fromJSON
func FromJSON() int32 {
	input := pdk.Input()
	var req struct {
		ID   string          `json:"id"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(input, &req); err != nil {
		pdk.Output(errorResponse("invalid input: " + err.Error()))
		return 1
	}

	if req.ID == "" {
		pdk.Output(errorResponse("id is required"))
		return 1
	}

	t, err := tree.FromJSON(req.Data)
	if err != nil {
		pdk.Output(errorResponse("failed to deserialize tree: " + err.Error()))
		return 1
	}

	storage[req.ID] = t
	pdk.Output(successResponse())
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

func listResponse(ids []string, nodes []string) []byte {
	resp := ListResponse{IDs: ids, Nodes: nodes}
	data, _ := json.Marshal(resp)
	return data
}

// Required main function for WASM
func main() {}
