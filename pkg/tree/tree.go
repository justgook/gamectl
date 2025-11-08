package tree

import (
	"encoding/json"
	"errors"
)

// Edge represents a one-way link from a parent node to a child node.
type Edge struct {
	To   string `json:"to"`
	Name string `json:"name,omitempty"`
}

// Node represents a tree node with its children.
type Node struct {
	Name     string            `json:"name"`
	Data     map[string]string `json:"data"`
	Parent   string            `json:"parent,omitempty"`
	Children []Edge            `json:"children,omitempty"`
}

// Tree represents a hierarchical structure (rooted, acyclic).
type Tree struct {
	Nodes map[string]*Node `json:"nodes"`
	Root  string           `json:"root"`
}

// New creates an empty tree.
func New(root string) *Tree {
	t := &Tree{
		Nodes: make(map[string]*Node),
		Root:  root,
	}
	t.AddNode(root)
	return t
}

// AddNode adds a new node (must not already exist).
func (t *Tree) AddNode(id string, opt ...string) {
	if _, exists := t.Nodes[id]; !exists {
		name := id
		if len(opt) > 0 {
			name = opt[0]
		}
		t.Nodes[id] = &Node{
			Name: name,
			Data: make(map[string]string), // Initialize to prevent JSON null issues
		}
	}
}

// AddEdge adds a parent → child relationship.
// Returns error if it would create a cycle or multiple parents.
func (t *Tree) AddEdge(parent, child, name string) error {
	// Ensure both exist
	if _, ok := t.Nodes[parent]; !ok {
		return errors.New("parent node not found: " + parent)
	}
	t.AddNode(child)

	childNode := t.Nodes[child]

	// Check for multiple parents
	if childNode.Parent != "" && childNode.Parent != parent {
		return errors.New("node already has a parent: " + child)
	}

	// Prevent cycles by ensuring parent is not a descendant of child
	if t.isDescendant(child, parent) {
		return errors.New("adding edge would create cycle: " + parent + " → " + child)
	}

	// Create link
	t.Nodes[parent].Children = append(t.Nodes[parent].Children, Edge{To: child, Name: name})
	childNode.Parent = parent
	return nil
}

// isDescendant checks if target is a descendant of node.
func (t *Tree) isDescendant(node, target string) bool {
	n, ok := t.Nodes[node]
	if !ok {
		return false
	}
	for _, edge := range n.Children {
		if edge.To == target || t.isDescendant(edge.To, target) {
			return true
		}
	}
	return false
}

// GetChildren returns direct children of a node.
func (t *Tree) GetChildren(node string) []Edge {
	if n, ok := t.Nodes[node]; ok {
		return n.Children
	}
	return nil
}

// GetParent returns parent node name ("" if root or missing).
func (t *Tree) GetParent(node string) string {
	if n, ok := t.Nodes[node]; ok {
		return n.Parent
	}
	return ""
}

// GetEntranceEdge returns the edge that connects the parent to this node.
// Returns nil if the node is the root or doesn't exist.
func (t *Tree) GetEntranceEdge(node string) *Edge {
	n, ok := t.Nodes[node]
	if !ok || n.Parent == "" {
		return nil
	}

	parent := t.Nodes[n.Parent]
	for i := range parent.Children {
		if parent.Children[i].To == node {
			return &parent.Children[i]
		}
	}

	return nil
}

// Traverse performs a preorder traversal (root → children)
func (t *Tree) Traverse(node string, fn func(string)) {
	fn(node)
	for _, child := range t.GetChildren(node) {
		t.Traverse(child.To, fn)
	}
}

// GetRandomNode returns a node ID chosen deterministically based on pt ∈ [0, 1].
// Example: pt=0.0 → first node, pt=1.0 → last node.
func (t *Tree) GetRandomNode(pt float32) string {
	if len(t.Nodes) == 0 {
		return ""
	}

	keys := make([]string, 0, len(t.Nodes))
	for k := range t.Nodes {
		keys = append(keys, k)
	}

	index := int(0.5 + float64(pt)*float64(len(keys)-1))

	if index < 0 {
		index = 0
	} else if index >= len(keys) {
		index = len(keys) - 1
	}

	return keys[index]
}

// ToJSON serializes tree to JSON.
func (t *Tree) ToJSON() ([]byte, error) {
	return json.MarshalIndent(t, "", "  ")
}

// FromJSON deserializes a Tree from JSON.
func FromJSON(data []byte) (*Tree, error) {
	var t Tree
	err := json.Unmarshal(data, &t)
	if err != nil {
		return nil, err
	}
	return &t, nil
}
