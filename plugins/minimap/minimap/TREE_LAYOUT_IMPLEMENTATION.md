# Tree Layout Algorithm Implementation Guide

## 🎯 Project Overview

**Language:** Go  
**Algorithm:** Linear Hierarchical Layout → Circular Transformation → Physics-Based Optimization  
**Goal:** Place 1000+ tree nodes with custom shapes on 2D grid with guaranteed connectivity  
**Key Innovation:** Pre-allocate space fairly, then optimize through physics simulation  

---

## 📋 Implementation Stages

### Stage 1: Foundation & Data Structures 🏗️

**Objective:** Create basic building blocks and core types

**Files to create:**
- `types.go` - Core data structures
- `shapes.go` - Shape operations
- `tree.go` - Tree utilities

#### Core Types (`types.go`):
```go
package treelayout

import "math"

type Point struct {
    X, Y int
}

type TreeNode struct {
    ID       string
    Shape    []Point        // Custom shape as relative coordinates from anchor
    Children []*TreeNode
    Position Point          // Anchor position on grid
    Level    int            // Distance from root (0 = root)
    Parent   *TreeNode      // Back-reference to parent
}

type Grid map[Point]GridCell

type GridCell struct {
    IsOccupied bool
    OwnerID    string
    IsPath     bool
}

type BoundingBox struct {
    MinX, MinY, MaxX, MaxY int
}
```

#### Shape Operations (`shapes.go`):
```go
package treelayout

// NewTreeNode creates a new tree node with given ID and shape
func NewTreeNode(id string, shape []Point) *TreeNode {
    return &TreeNode{
        ID:       id,
        Shape:    shape,
        Children: make([]*TreeNode, 0),
        Level:    0,
    }
}

// GetBoundingBox calculates the bounding box of a shape
func GetBoundingBox(shape []Point) BoundingBox {
    // TODO: Implement
    // Find min/max X and Y coordinates in shape
}

// TranslateShape converts relative shape coordinates to absolute grid positions
func TranslateShape(shape []Point, anchor Point) []Point {
    // TODO: Implement
    // Add anchor position to each point in shape
}

// ShapesOverlap checks if two shapes overlap when placed at given positions
func ShapesOverlap(shape1, shape2 []Point, pos1, pos2 Point) bool {
    // TODO: Implement
    // 1. Translate both shapes to absolute coordinates
    // 2. Check if any points coincide
}

// GetShapeWidth returns the width of a shape
func GetShapeWidth(shape []Point) int {
    // TODO: Implement
}

// GetShapeHeight returns the height of a shape
func GetShapeHeight(shape []Point) int {
    // TODO: Implement
}
```

#### Tree Utilities (`tree.go`):
```go
package treelayout

// AddChild adds a child to a parent node and updates relationships
func AddChild(parent, child *TreeNode) {
    // TODO: Implement
    // 1. Add child to parent's Children slice
    // 2. Set child's Parent reference
    // 3. Update child's Level
}

// CountSubtreeNodes counts total nodes in subtree including the node itself
func CountSubtreeNodes(node *TreeNode) int {
    // TODO: Implement recursive counting
}

// CountLeaves counts leaf nodes in subtree
func CountLeaves(node *TreeNode) int {
    // TODO: Implement
}

// GetTreeDepth returns maximum depth of tree
func GetTreeDepth(root *TreeNode) int {
    // TODO: Implement recursive depth calculation
}

// GetNodesAtLevel returns all nodes at specified level
func GetNodesAtLevel(root *TreeNode, targetLevel int) []*TreeNode {
    // TODO: Implement BFS to collect nodes at specific level
}

// AssignLevels assigns level numbers to all nodes in tree
func AssignLevels(root *TreeNode) {
    // TODO: Implement BFS traversal to set Level field
}
```

**Test Cases (`stage1_test.go`):**
```go
package treelayout

import "testing"

func TestBasicShapeOperations(t *testing.T) {
    // Test shape creation and operations
    shape := []Point{{0, 0}, {1, 0}, {0, 1}, {1, 1}} // 2x2 square
    
    // Test bounding box
    bbox := GetBoundingBox(shape)
    // Assert bbox is correct
    
    // Test translation
    translated := TranslateShape(shape, Point{10, 20})
    // Assert translation is correct
    
    // Test overlap detection
    overlap := ShapesOverlap(shape, shape, Point{0, 0}, Point{1, 1})
    // Assert overlap detected correctly
}

func TestTreeConstruction(t *testing.T) {
    // Create simple tree: root with 2 children
    root := NewTreeNode("root", []Point{{0, 0}})
    child1 := NewTreeNode("child1", []Point{{0, 0}})
    child2 := NewTreeNode("child2", []Point{{0, 0}})
    
    AddChild(root, child1)
    AddChild(root, child2)
    
    // Test tree structure
    // Assert parent-child relationships
    // Assert level assignments
}
```

**Success Criteria:** Basic tree creation and shape operations working

---

### Stage 2: Linear Hierarchical Layout 📐

**Objective:** Place all nodes in optimal linear arrangement

**Files to add:**
- `linear_layout.go` - Linear placement algorithms

#### Linear Layout (`linear_layout.go`):
```go
package treelayout

type SpaceAllocation struct {
    StartX, EndX int
    CenterX      int
    Width        int
}

// CalculateSubtreeWidths calculates horizontal space needed for each subtree
func CalculateSubtreeWidths(root *TreeNode, nodeSpacing int) map[string]int {
    // TODO: Implement
    // 1. For each child of root, calculate total width of its subtree
    // 2. Consider shape widths and spacing between siblings
    // 3. Return map of node ID to required width
}

// AllocateHorizontalSpace allocates X-coordinate ranges for each root child
func AllocateHorizontalSpace(root *TreeNode, subtreeWidths map[string]int) map[string]SpaceAllocation {
    // TODO: Implement
    // 1. Calculate total width needed
    // 2. Assign X-ranges to each child proportionally
    // 3. Return allocation map
}

// PlaceNodesLinear places all nodes in linear hierarchical layout
func PlaceNodesLinear(root *TreeNode, nodeSpacing, levelSpacing int) {
    // TODO: Implement
    // 1. Place root at origin (0, 0)
    // 2. Assign levels to all nodes
    // 3. For each level:
    //    a. Get nodes at that level
    //    b. Calculate their horizontal positions within allocated space
    //    c. Set their Position field
    // 4. Ensure no shape overlaps occur
}

// ExpandSpacingIfNeeded increases spacing to prevent overlaps
func ExpandSpacingIfNeeded(nodes []*TreeNode, minSpacing int) {
    // TODO: Implement
    // Check if any nodes at same level would overlap
    // If so, increase spacing and re-position all nodes at that level
}
```

**Test Cases (`stage2_test.go`):**
```go
func TestLinearLayout(t *testing.T) {
    // Create test tree with known structure
    root := createTestTree() // Helper function to create consistent test tree
    
    // Apply linear layout
    PlaceNodesLinear(root, 50, 100) // node spacing=50, level spacing=100
    
    // Verify:
    // 1. Root is at origin
    // 2. Children are at correct level
    // 3. No overlaps occur
    // 4. Siblings have proper spacing
    
    // Test with different tree structures:
    // - Balanced tree
    // - Unbalanced tree (one child has many descendants)
    // - Trees with different shaped nodes
}
```

**Success Criteria:** All nodes placed with no overlaps, proper hierarchical spacing

---

### Stage 3: Circular Transformation 🔄

**Objective:** Transform linear layout into circular arrangement

**Files to add:**
- `circular_transform.go` - Circular layout transformation

#### Circular Transformation (`circular_transform.go`):
```go
package treelayout

import "math"

type AngularAllocation struct {
    StartAngle, EndAngle float64
    CenterAngle         float64
    AngularWidth        float64
}

// AllocateAngularSpace allocates angular space for each root child subtree
func AllocateAngularSpace(root *TreeNode) map[string]AngularAllocation {
    // TODO: Implement
    // 1. Count leaves in each child's subtree
    // 2. Allocate 2π radians proportionally
    // 3. Return allocation map
}

// CalculateInitialRadius determines radius needed to fit bottom layer
func CalculateInitialRadius(bottomLayerNodes []*TreeNode, minSpacing float64) float64 {
    // TODO: Implement
    // 1. Calculate total width of all bottom layer nodes + spacing
    // 2. Calculate circumference needed
    // 3. Return radius = circumference / (2π)
}

// WrapBottomLayer positions bottom layer nodes around circle
func WrapBottomLayer(nodes []*TreeNode, radius float64, allocations map[string]AngularAllocation) {
    // TODO: Implement
    // 1. For each bottom layer node:
    //    a. Determine which root child subtree it belongs to
    //    b. Calculate its position within that subtree's angular allocation
    //    c. Set Position using polar coordinates: x = r*cos(θ), y = r*sin(θ)
}

// PositionIntermediateLayers places nodes between bottom layer and root
func PositionIntermediateLayers(root *TreeNode, maxRadius float64) {
    // TODO: Implement
    // 1. For each level from (maxLevel-1) down to 1:
    //    a. Calculate appropriate radius for this level
    //    b. For each node at this level:
    //       - Find average angle of its children
    //       - Position at that angle, at level's radius
    //       - Adjust if it would overlap with siblings
}

// TransformToCircular converts linear layout to circular layout
func TransformToCircular(root *TreeNode) {
    // TODO: Implement orchestration function
    // 1. Calculate angular allocations
    // 2. Get bottom layer nodes
    // 3. Calculate initial radius
    // 4. Wrap bottom layer
    // 5. Position intermediate layers
}
```

**Test Cases (`stage3_test.go`):**
```go
func TestCircularTransformation(t *testing.T) {
    // Start with linear layout from Stage 2
    root := createTestTree()
    PlaceNodesLinear(root, 50, 100)
    
    // Transform to circular
    TransformToCircular(root)
    
    // Verify:
    // 1. Angular allocations sum to 2π
    // 2. Bottom layer forms proper circle
    // 3. Intermediate layers positioned correctly
    // 4. Hierarchical relationships maintained
    // 5. No overlaps created
    
    // Test distance from root increases with level
    // Test siblings in same subtree are in same angular sector
}
```

**Success Criteria:** Circular layout maintains hierarchical relationships, no overlaps

---

### Stage 4: Path Creation & Connectivity 🛤️

**Objective:** Connect all parent-child pairs with paths

**Files to add:**
- `pathfinding.go` - A* pathfinding implementation
- `connectivity.go` - Path creation and management

#### Pathfinding (`pathfinding.go`):
```go
package treelayout

type PathNode struct {
    Point  Point
    G, H, F float64
    Parent *PathNode
}

// ManhattanDistance calculates heuristic distance
func ManhattanDistance(a, b Point) float64 {
    return math.Abs(float64(a.X-b.X)) + math.Abs(float64(a.Y-b.Y))
}

// GetNeighbors returns valid neighboring cells for pathfinding
func GetNeighbors(current Point, obstacles map[Point]bool) []Point {
    // TODO: Implement
    // Return 4-connected or 8-connected neighbors
    // Exclude obstacles
}

// AStar finds optimal path between start and goal
func AStar(start, goal Point, obstacles map[Point]bool) []Point {
    // TODO: Implement A* algorithm
    // 1. Initialize open and closed lists
    // 2. Add start to open list
    // 3. While open list not empty:
    //    a. Get node with lowest F cost
    //    b. If it's goal, reconstruct path
    //    c. Move to closed list
    //    d. Generate neighbors
    //    e. Update costs and add to open list
    // 4. Return path or empty slice if no path found
}
```

#### Connectivity (`connectivity.go`):
```go
package treelayout

type Connection struct {
    ParentID    string
    ChildID     string
    Path        []Point
    ParentPoint Point
    ChildPoint  Point
}

// FindClosestPoints finds optimal connection points between two shapes
func FindClosestPoints(parentShape, childShape []Point, parentPos, childPos Point) (Point, Point) {
    // TODO: Implement
    // 1. Translate shapes to absolute coordinates
    // 2. Find pair of points (one from each shape) with minimum distance
    // 3. Return the closest pair
}

// CreateConnection creates a path between parent and child
func CreateConnection(parent, child *TreeNode, obstacles map[Point]bool) Connection {
    // TODO: Implement
    // 1. Find optimal connection points
    // 2. Use A* to find path
    // 3. Return Connection struct
}

// CreateAllConnections creates paths for all parent-child relationships
func CreateAllConnections(root *TreeNode) ([]Connection, map[Point]bool) {
    // TODO: Implement
    // 1. Collect all parent-child pairs from tree
    // 2. Build initial obstacles map from node shapes
    // 3. For each pair:
    //    a. Create connection
    //    b. Add path to shared infrastructure (allow path sharing)
    //    c. Update obstacles to exclude new path (paths can overlap)
    // 4. Return all connections and final grid state
}

// ValidateConnectivity ensures all nodes are properly connected
func ValidateConnectivity(root *TreeNode, connections []Connection) bool {
    // TODO: Implement
    // Verify every non-root node has exactly one incoming connection
}
```

**Test Cases (`stage4_test.go`):**
```go
func TestPathfinding(t *testing.T) {
    // Test basic A* pathfinding
    start := Point{0, 0}
    goal := Point{5, 5}
    obstacles := make(map[Point]bool)
    
    path := AStar(start, goal, obstacles)
    // Verify path exists and is reasonable
    
    // Test with obstacles
    // Test no path available case
}

func TestConnectivity(t *testing.T) {
    // Use circular layout from Stage 3
    root := createTestTree()
    PlaceNodesLinear(root, 50, 100)
    TransformToCircular(root)
    
    // Create all connections
    connections, grid := CreateAllConnections(root)
    
    // Verify:
    // 1. Every child has connection to parent
    // 2. Paths don't go through shape obstacles
    // 3. Path sharing works correctly
    // 4. Grid state is consistent
}
```

**Success Criteria:** All nodes connected, paths avoid shape overlaps, path sharing works

---

### Stage 5: Physics-Based Optimization ⚡

**Objective:** Optimize layout through force simulation

**Files to add:**
- `forces.go` - Force calculation system
- `optimization.go` - Physics simulation engine

#### Forces (`forces.go`):
```go
package treelayout

type Force struct {
    X, Y float64
}

type OptimizationState struct {
    Nodes       map[string]*TreeNode
    Connections []Connection
    Grid        map[Point]bool
    TotalEnergy float64
    Iteration   int
}

// Add adds two forces together
func (f Force) Add(other Force) Force {
    return Force{f.X + other.X, f.Y + other.Y}
}

// Scale multiplies force by scalar
func (f Force) Scale(factor float64) Force {
    return Force{f.X * factor, f.Y * factor}
}

// CalculateSpringForces calculates forces from path length springs
func CalculateSpringForces(node *TreeNode, connections []Connection, springConstant float64) Force {
    // TODO: Implement
    // 1. Find all connections involving this node
    // 2. For each connection, calculate spring force trying to minimize path length
    // 3. Sum all forces on this node
}

// CalculateRepulsionForces calculates forces pushing overlapping nodes apart
func CalculateRepulsionForces(node *TreeNode, allNodes []*TreeNode, repulsionConstant float64) Force {
    // TODO: Implement
    // 1. Check node against all other nodes
    // 2. If shapes overlap or are too close, calculate repulsion force
    // 3. Force magnitude inversely proportional to distance
    // 4. Sum all repulsion forces
}

// CalculateNodeForces calculates total force on a single node
func CalculateNodeForces(node *TreeNode, state OptimizationState, springK, repulsionK float64) Force {
    // TODO: Implement
    // Combine spring and repulsion forces
}
```

#### Optimization (`optimization.go`):
```go
package treelayout

// ApplyForces moves nodes based on calculated forces
func ApplyForces(state OptimizationState, forces map[string]Force, damping float64) OptimizationState {
    // TODO: Implement
    // 1. For each node, apply its force with damping
    // 2. Update node positions
    // 3. Recalculate connections if nodes moved significantly
    // 4. Update grid state
    // 5. Calculate new total energy
    // 6. Return new state
}

// RecalculateConnections updates paths after node movements
func RecalculateConnections(state OptimizationState, movedNodes map[string]bool) OptimizationState {
    // TODO: Implement
    // 1. For connections involving moved nodes
    // 2. Recalculate optimal connection points
    // 3. Recalculate paths
    // 4. Update grid state
}

// CalculateSystemEnergy computes total energy of current state
func CalculateSystemEnergy(state OptimizationState) float64 {
    // TODO: Implement
    // 1. Sum path lengths (spring potential energy)
    // 2. Sum overlap penalties (repulsion potential energy)
    // 3. Return total energy
}

// OptimizeLayout runs physics simulation to improve layout
func OptimizeLayout(initialState OptimizationState, maxIterations int) OptimizationState {
    // TODO: Implement main optimization loop
    // 1. For each iteration:
    //    a. Calculate forces on all nodes
    //    b. Apply forces with damping
    //    c. Recalculate connections if needed
    //    d. Check for convergence
    //    e. Update state
    // 2. Return final optimized state
}
```

**Test Cases (`stage5_test.go`):**
```go
func TestForceCalculations(t *testing.T) {
    // Test individual force calculations
    // Verify spring forces point in correct direction
    // Verify repulsion forces push apart correctly
}

func TestOptimization(t *testing.T) {
    // Start with suboptimal layout (artificially bad)
    // Run optimization
    // Verify layout improves (energy decreases)
    // Verify system eventually stabilizes
}
```

**Success Criteria:** Layout improves over iterations, forces balance, system stabilizes

---

### Stage 6: Convergence & Layer Contraction 🎯

**Objective:** Achieve stable, compact final layout

**Files to add:**
- `convergence.go` - Convergence detection
- `contraction.go` - Layer contraction system
- `validation.go` - Final layout validation

#### Convergence (`convergence.go`):
```go
package treelayout

type ConvergenceMetrics struct {
    EnergyChange    float64
    MaxMovement     float64
    AvgMovement     float64
    CollisionCount  int
    Iteration       int
}

// CheckConvergence determines if optimization should stop
func CheckConvergence(history []OptimizationState, threshold float64, windowSize int) bool {
    // TODO: Implement multi-criteria convergence detection
    // 1. Energy change < threshold for windowSize iterations
    // 2. Node movement < threshold
    // 3. Collision count stable
    // Return true if converged
}

// CalculateConvergenceMetrics computes convergence indicators
func CalculateConvergenceMetrics(current, previous OptimizationState) ConvergenceMetrics {
    // TODO: Implement metrics calculation
}
```

#### Contraction (`contraction.go`):
```go
package treelayout

// ContractLayer moves nodes at specified level toward center
func ContractLayer(level int, contractionFactor float64, state OptimizationState) OptimizationState {
    // TODO: Implement
    // 1. Get all nodes at specified level
    // 2. Move each toward its parent by contractionFactor
    // 3. Ensure no overlaps created
    // 4. Recalculate affected connections
    // 5. Return updated state
}

// ProgressiveContraction contracts layers from outside to inside
func ProgressiveContraction(state OptimizationState, maxDepth int) OptimizationState {
    // TODO: Implement
    // 1. For level = maxDepth down to 1:
    //    a. Contract layer by appropriate factor
    //    b. Run mini-optimization to settle
    //    c. Check for improvements
    // 2. Return final compacted state
}
```

#### Validation (`validation.go`):
```go
package treelayout

type ValidationReport struct {
    Success         bool
    Issues          []string
    TotalNodes      int
    ConnectedNodes  int
    OverlapCount    int
    DisconnectedNodes []string
}

// ValidateFinalLayout performs comprehensive validation of final layout
func ValidateFinalLayout(state OptimizationState) ValidationReport {
    // TODO: Implement comprehensive validation
    // 1. Check all nodes are connected
    // 2. Verify no shape overlaps
    // 3. Ensure all paths are valid
    // 4. Check layout compactness metrics
    // 5. Return detailed report
}

// CheckShapeOverlaps finds all overlapping shapes in layout
func CheckShapeOverlaps(state OptimizationState) []string {
    // TODO: Implement overlap detection
}

// CheckConnectivity verifies all parent-child connections exist
func CheckConnectivity(root *TreeNode, connections []Connection) []string {
    // TODO: Implement connectivity verification
}
```

**Test Cases (`stage6_test.go`):**
```go
func TestConvergence(t *testing.T) {
    // Test convergence detection with known scenarios
    // Test with oscillating systems
    // Test with steadily improving systems
}

func TestContraction(t *testing.T) {
    // Test layer contraction doesn't break connectivity
    // Test progressive contraction improves compactness
    // Test final validation passes
}
```

**Success Criteria:** Reliable convergence detection, compact final layouts, validation passes

---

## 🧪 Testing Strategy

### Progressive Testing:
```go
// Create test utilities in test_utils.go
func createSimpleTree() *TreeNode {
    // Root with 2 children (triangle)
}

func createMediumTree() *TreeNode {
    // Balanced tree with 3 levels, ~15 nodes
}

func createLargeTree() *TreeNode {
    // Unbalanced tree with 100+ nodes for stress testing
}

func createCustomShapes() map[string][]Point {
    // Various shapes: squares, rectangles, L-shapes, etc.
}
```

### Integration Tests:
```go
func TestFullPipeline(t *testing.T) {
    // Test complete algorithm from start to finish
    // Verify each stage produces valid output for next stage
}

func TestScaling(t *testing.T) {
    // Test with increasing node counts: 10, 50, 100, 500, 1000
    // Monitor performance and quality metrics
}
```

### Benchmarks:
```go
func BenchmarkLinearLayout(b *testing.B)
func BenchmarkCircularTransform(b *testing.B)
func BenchmarkPathfinding(b *testing.B)
func BenchmarkOptimization(b *testing.B)
```

---

## 🛠️ Development Commands

```bash
# Initialize Go module
go mod init treelayout

# Run tests for specific stage
go test ./... -v -run TestStage1

# Run all tests
go test ./...

# Run benchmarks
go test -bench=.

# Generate test coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Build example program
go build -o treelayout cmd/main.go
```

---

## 📁 Project Structure

```
treelayout/
├── README.md
├── go.mod
├── go.sum
├── types.go                    # Core data structures
├── shapes.go                   # Shape operations
├── tree.go                     # Tree utilities
├── linear_layout.go            # Stage 2: Linear layout
├── circular_transform.go       # Stage 3: Circular transformation  
├── pathfinding.go              # Stage 4: A* pathfinding
├── connectivity.go             # Stage 4: Connection management
├── forces.go                   # Stage 5: Force calculations
├── optimization.go             # Stage 5: Physics simulation
├── convergence.go              # Stage 6: Convergence detection
├── contraction.go              # Stage 6: Layer contraction
├── validation.go               # Stage 6: Layout validation
├── test_utils.go               # Testing utilities
├── stage1_test.go              # Stage 1 tests
├── stage2_test.go              # Stage 2 tests
├── stage3_test.go              # Stage 3 tests
├── stage4_test.go              # Stage 4 tests
├── stage5_test.go              # Stage 5 tests
├── stage6_test.go              # Stage 6 tests
├── integration_test.go         # Full pipeline tests
└── cmd/
    └── main.go                 # Example program
```

---

## 🚀 Implementation Workflow

1. **Start with Stage 1**: Implement basic types and shape operations
2. **Test thoroughly**: Each stage must pass tests before proceeding
3. **Add visualization**: Debug output helps verify correctness
4. **Optimize incrementally**: Don't optimize until algorithm works
5. **Scale gradually**: Test with small trees first, then scale up

When implementing with LLM assistance:
- Request one stage at a time
- Always ask for comprehensive tests
- Request debug/visualization helpers
- Test each stage before moving to next
- Ask for performance optimization suggestions

This staged approach ensures reliable, testable implementation of your innovative tree layout algorithm.
