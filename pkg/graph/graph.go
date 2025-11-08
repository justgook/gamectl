package graph

import (
	"encoding/json"
	"math"
)

// Edge represents a directed edge with an optional name
type Edge struct {
	To   string `json:"to"`
	Name string `json:"name,omitempty"`
}

// Node represents a graph node with its outgoing edges
type Node struct {
	Name  string `json:"name"`
	Edges []Edge `json:"edges,omitempty"`
}

// Graph represents a directed graph structure
type Graph struct {
	Nodes    map[string]*Node  `json:"nodes"`
	External map[string][]Edge `json:"external,omitempty"`
}

// New creates a new graph instance
func New() *Graph {
	return &Graph{
		Nodes:    make(map[string]*Node),
		External: make(map[string][]Edge),
	}
}

// AddNode adds a node to the graph
func (g *Graph) AddNode(id string, opt ...string) {
	if _, exists := g.Nodes[id]; !exists {
		name := id
		if len(opt) > 0 {
			name = opt[0]
		}
		g.Nodes[id] = &Node{
			Name:  name,
			Edges: []Edge{},
		}
	}
}

// AddEdge adds a directed edge from one node to another
func (g *Graph) AddEdge(from, to, name string, external bool) {
	if external {
		g.External[from] = append(g.External[from], Edge{
			To:   to,
			Name: name,
		})
		return
	}

	if _, exists := g.Nodes[from]; !exists {
		g.AddNode(from)
	}

	g.Nodes[from].Edges = append(g.Nodes[from].Edges, Edge{
		To:   to,
		Name: name,
	})
}

// GetNeighbors returns all outgoing edges from a node
func (g *Graph) GetNeighbors(node string) []Edge {
	if n, exists := g.Nodes[node]; exists {
		return n.Edges
	}
	return []Edge{}
}

// GetExternalNeighbors returns incoming and outgoing external edges
func (g *Graph) GetExternalNeighbors(node string) (incoming, outgoing []Edge) {
	// Find incoming external edges
	for from, edges := range g.External {
		for _, edge := range edges {
			if edge.To == node {
				incoming = append(incoming, Edge{
					To:   from,
					Name: edge.Name,
				})
			}
		}
	}

	// Get outgoing external edges
	if edges, exists := g.External[node]; exists {
		outgoing = edges
	}

	return incoming, outgoing
}

// GetRandomNode returns a random node from the graph
func (g *Graph) GetRandomNode(pt float32) string {
	if len(g.Nodes) == 0 {
		return ""
	}

	keys := make([]string, 0, len(g.Nodes))
	for k := range g.Nodes {
		keys = append(keys, k)
	}

	return keys[int(math.Round(float64(len(keys))*float64(pt)))]
}

// Traverse performs a depth-first traversal of the graph
func (g *Graph) Traverse(node string, fn func(string), visited map[string]bool) {
	if visited == nil {
		visited = make(map[string]bool)
	}

	if visited[node] {
		return
	}

	visited[node] = true
	fn(node)

	for _, edge := range g.GetNeighbors(node) {
		g.Traverse(edge.To, fn, visited)
	}
}

// ToJSON serializes the graph to JSON
func (g *Graph) ToJSON() ([]byte, error) {
	return json.MarshalIndent(g, "", "  ")
}

// FromJSON deserializes a graph from JSON
func FromJSON(data []byte) (*Graph, error) {
	var g Graph
	err := json.Unmarshal(data, &g)
	if err != nil {
		return nil, err
	}
	return &g, nil
}
