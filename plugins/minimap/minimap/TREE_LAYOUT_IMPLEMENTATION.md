# Tree Layout Algorithm Implementation Guide

## 🎯 Project Overview & Algorithm Design

**Language:** Go  
**Algorithm:** Linear Hierarchical Layout → Circular Transformation → Physics-Based Optimization  
**Goal:** Place 1000+ tree nodes with custom shapes on 2D grid with guaranteed connectivity  
**Key Innovation:** Pre-allocate space fairly, then optimize through physics simulation  

### 🧠 Core Algorithm Philosophy

The algorithm solves a fundamental challenge in procedural generation: **how to place hierarchical structures (trees) with custom-shaped nodes in 2D space while maintaining connectivity and visual appeal**.

#### The Three-Phase Approach:

1. **🏗️ Foundation Phase (Linear Layout)**
   - **Why Linear First?** Linear layouts are predictable and guarantee no overlaps
   - **Space Allocation Strategy:** Pre-calculate space requirements for each subtree
   - **Hierarchical Respect:** Maintain parent-child visual relationships
   
2. **🔄 Transformation Phase (Circular Layout)**  
   - **Why Circular?** Distributes nodes more evenly, reduces "sprawl"
   - **Angular Allocation:** Proportional space based on subtree size/importance
   - **Compactness Goal:** Minimize overall bounding box while preserving structure

3. **⚡ Optimization Phase (Physics Simulation)**
   - **Why Physics?** Natural way to resolve conflicts and improve aesthetics  
   - **Force Balance:** Spring forces (connectivity) vs repulsion forces (spacing)
   - **Convergence:** System naturally settles into optimal configuration

### 🤔 Design Decisions & Trade-offs

#### Space Allocation Strategy
```
Option A: Equal space per node → Simple but wastes space
Option B: Proportional to subtree size → Better space usage
Option C: Adaptive based on shape → Most complex but optimal
```
**Chosen:** Option B with potential C enhancements

#### Connectivity Strategy
```
Option A: Direct lines → Simple but may cross shapes
Option B: A* pathfinding → Complex but avoids obstacles  
Option C: Hybrid approach → Balance simplicity and quality
```
**Chosen:** Start with A, upgrade to C as needed

#### Physics Model Complexity
```
Simple: Spring + Repulsion forces only
Advanced: Add rotational forces, shape-aware collision
Expert: Include aesthetic forces (symmetry, balance)
```
**Approach:** Start simple, add complexity based on results

---

## 🏗️ Integration with Existing Project

### Existing Infrastructure
- **Input:** `tree.Tree` (slice of `*tree.Node`) with room data in `Data map[string]string`
- **Shapes:** `RoomShape [][2]int` retrieved via `GetRoomShapeFunc`
- **Output:** `Grid map[Point]int` where `Point = [2]int` and values are room IDs
- **Conversion:** `Grid2Tilemap()` creates `tilemap.TileMap` for visualization
- **Testing:** Browser viewers (`view-tilemap.js`, `view-minimap.js`) for real-time visualization

### 🔌 Technical Integration Points

**Input Pipeline:** `tree.Tree` → Shape Analysis → Grid Placement → `tilemap.TileMap`  
**Testing Infrastructure:** Real-time browser visualization via existing viewers  
**Storage Integration:** Plugin system with `tilemap-storage` for persistence

### Stage Function Signature
```go
func StageN(rng Random, tree *tree.Tree, getRoomShape GetRoomShapeFunc, grid *Grid)
```

This signature allows:
- **Incremental Development**: Each stage can be implemented and tested independently
- **Parameter Tuning**: Easy to experiment with different approaches
- **Visual Debugging**: Immediate feedback through browser viewers

---

## 📋 Implementation Stages - Deep Dive

### Stage 1: Foundation & Linear Hierarchical Layout 🏗️

**Objective:** Establish fundamental spatial relationships using predictable linear arrangement

#### 🧩 Design Challenge
How do we place tree nodes with arbitrary shapes in a way that:
- Guarantees no overlaps
- Preserves hierarchical relationships  
- Provides foundation for later optimization
- Handles 1000+ nodes efficiently

#### 💭 Linear Layout Philosophy

**Why Start Linear?**
- **Predictability**: Easy to calculate space requirements
- **Debugging**: Visual relationships are obvious
- **Foundation**: Provides stable base for transformations
- **Scalability**: O(n) complexity for initial placement

#### 🎯 Space Allocation Algorithm

**Challenge:** How much horizontal space does each subtree need?

```
Traditional Approach: Equal spacing
Problems: Wastes space, ignores subtree complexity

Our Approach: Proportional allocation based on:
1. Subtree node count
2. Shape complexity (width/height)  
3. Minimum spacing requirements
4. Parent-child relationship preservation
```

#### 🔧 Implementation Considerations

**Level Calculation Strategy:**
- BFS traversal to assign consistent levels
- Handle disconnected components gracefully
- Consider tree depth for vertical spacing

**Horizontal Positioning Algorithm:**
```
For each level L:
  1. Collect all nodes at level L
  2. Group by parent for proper clustering  
  3. Calculate total width needed (shapes + spacing)
  4. Distribute available space proportionally
  5. Position nodes to minimize parent-child distance
```

**Shape Placement Strategy:**
- Use shape bounding boxes for collision detection
- Anchor points for consistent positioning
- Buffer zones to prevent touching edges

**Current State:** `stage1.go` exists but is empty
**Files to enhance:**
- `stage1.go` - Linear hierarchical placement  
- `common.go` - Shared utilities

#### Core Utilities (enhance `common.go`):
```go
package minimap

import (
    "github.com/justgook/gams/pkg/tree"
)

// NodePosition tracks position and metadata for tree nodes
type NodePosition struct {
    Node     *tree.Node
    Shape    RoomShape
    Position Point    // Anchor position on grid
    Level    int      // Distance from root (0 = root)
}

// GetBoundingBox calculates the bounding box of a room shape
func GetBoundingBox(shape RoomShape) (minX, minY, maxX, maxY int) {
    if len(shape) == 0 {
        return 0, 0, 0, 0
    }
    minX, minY = shape[0][0], shape[0][1]
    maxX, maxY = shape[0][0], shape[0][1]
    
    for _, point := range shape[1:] {
        if point[0] < minX { minX = point[0] }
        if point[1] < minY { minY = point[1] }
        if point[0] > maxX { maxX = point[0] }
        if point[1] > maxY { maxY = point[1] }
    }
    return
}

// PlaceShapeOnGrid places a room shape at the given position
func PlaceShapeOnGrid(grid *Grid, shape RoomShape, position Point, roomID int) {
    for _, offset := range shape {
        point := Point{position[0] + offset[0], position[1] + offset[1]}
        (*grid)[point] = roomID
    }
}

// ShapesOverlap checks if two shapes would overlap at given positions
func ShapesOverlap(shape1, shape2 RoomShape, pos1, pos2 Point) bool {
    occupied := make(map[Point]bool)
    
    // Mark all points of shape1
    for _, offset := range shape1 {
        point := Point{pos1[0] + offset[0], pos1[1] + offset[1]}
        occupied[point] = true
    }
    
    // Check if any point of shape2 overlaps
    for _, offset := range shape2 {
        point := Point{pos2[0] + offset[0], pos2[1] + offset[1]}
        if occupied[point] {
            return true
        }
    }
    return false
}

// GetShapeWidth returns the width of a room shape
func GetShapeWidth(shape RoomShape) int {
    minX, _, maxX, _ := GetBoundingBox(shape)
    return maxX - minX + 1
}

// GetShapeHeight returns the height of a room shape  
func GetShapeHeight(shape RoomShape) int {
    _, minY, _, maxY := GetBoundingBox(shape)
    return maxY - minY + 1
}
```

#### Tree Analysis Utilities (enhance `common.go`):
```go
// GetRootNode finds the root node (node with ParentId pointing to itself or -1)
func GetRootNode(t *tree.Tree) *tree.Node {
    for i, node := range *t {
        if node.ParentId == i || node.ParentId == -1 {
            return node
        }
    }
    return (*t)[0] // fallback to first node
}

// GetNodeLevel calculates the level (depth) of a node from root
func GetNodeLevel(t *tree.Tree, node *tree.Node) int {
    level := 0
    current := node
    nodeIndex := t.IndexOf(node)
    
    for nodeIndex != current.ParentId && current.ParentId != -1 {
        current = (*t)[current.ParentId]
        nodeIndex = current.ParentId
        level++
        if level > len(*t) { // prevent infinite loops
            break
        }
    }
    return level
}

// CountSubtreeNodes counts total nodes in subtree including the node itself
func CountSubtreeNodes(t *tree.Tree, node *tree.Node) int {
    count := 1 // count the node itself
    for child := range t.Children(node) {
        count += CountSubtreeNodes(t, child)
    }
    return count
}

// CountLeaves counts leaf nodes in subtree
func CountLeaves(t *tree.Tree, node *tree.Node) int {
    children := make([]*tree.Node, 0)
    for child := range t.Children(node) {
        children = append(children, child)
    }
    
    if len(children) == 0 {
        return 1 // this is a leaf
    }
    
    count := 0
    for _, child := range children {
        count += CountLeaves(t, child)
    }
    return count
}

// GetTreeDepth returns maximum depth of tree from given root
func GetTreeDepth(t *tree.Tree, root *tree.Node) int {
    maxDepth := 0
    for node := range t.Traverse(root) {
        level := GetNodeLevel(t, node)
        if level > maxDepth {
            maxDepth = level
        }
    }
    return maxDepth
}

// GetNodesAtLevel returns all nodes at specified level from given root
func GetNodesAtLevel(t *tree.Tree, root *tree.Node, targetLevel int) []*tree.Node {
    var result []*tree.Node
    for node := range t.Traverse(root) {
        if GetNodeLevel(t, node) == targetLevel {
            result = append(result, node)
        }
    }
    return result
}
```

#### Stage 1 Implementation (`stage1.go`):
```go
package minimap

import (
    "github.com/justgook/gams/pkg/tree"
)

func Stage1(rng Random, treeInput *tree.Tree, getRoomShape GetRoomShapeFunc, grid *Grid) {
    if len(*treeInput) == 0 {
        return
    }
    
    // 1. Find root and analyze tree structure
    root := GetRootNode(treeInput)
    positions := make(map[*tree.Node]NodePosition)
    
    // 2. Create position tracking for all nodes
    roomID := 1
    for node := range treeInput.Traverse(root) {
        shape := getRoomShape(node)
        level := GetNodeLevel(treeInput, node)
        positions[node] = NodePosition{
            Node:     node,
            Shape:    shape,
            Position: Point{0, 0}, // will be calculated
            Level:    level,
        }
        roomID++
    }
    
    // 3. Place root at origin
    rootPos := positions[root]
    rootPos.Position = Point{0, 0}
    positions[root] = rootPos
    PlaceShapeOnGrid(grid, rootPos.Shape, rootPos.Position, 1)
    
    // 4. Place each level horizontally
    levelSpacing := 10 // vertical spacing between levels
    nodeSpacing := 5   // horizontal spacing between siblings
    
    maxDepth := GetTreeDepth(treeInput, root)
    for level := 1; level <= maxDepth; level++ {
        nodesAtLevel := GetNodesAtLevel(treeInput, root, level)
        if len(nodesAtLevel) == 0 {
            continue
        }
        
        // Calculate total width needed for this level
        totalWidth := 0
        for _, node := range nodesAtLevel {
            shape := positions[node].Shape
            totalWidth += GetShapeWidth(shape) + nodeSpacing
        }
        if totalWidth > 0 {
            totalWidth -= nodeSpacing // remove last spacing
        }
        
        // Place nodes from left to right
        currentX := -(totalWidth / 2) // center around origin
        currentY := level * levelSpacing
        
        for i, node := range nodesAtLevel {
            pos := positions[node]
            shape := pos.Shape
            
            pos.Position = Point{currentX, currentY}
            positions[node] = pos
            
            // Place on grid using room ID (node index + 1)
            roomID := treeInput.IndexOf(node) + 1
            PlaceShapeOnGrid(grid, shape, pos.Position, roomID)
            
            // Move to next position
            currentX += GetShapeWidth(shape) + nodeSpacing
        }
    }
}
```

**Testing After Stage 1:**
```bash
# The stage can be tested immediately using existing infrastructure
# 1. Run the minimap generation
# 2. View results in browser using view-tilemap.js or view-minimap.js
# 3. Verify linear hierarchical layout is working
```

**Success Criteria:** 
- All rooms placed without overlaps
- Proper hierarchical level arrangement 
- Linear layout visible in browser viewers
- Each room gets unique color based on room ID

---

### Stage 2: Circular Transformation 🔄

**Objective:** Transform linear layout into more compact circular arrangement

#### 🧩 Design Challenge
Linear layouts work but create "sprawling" structures. How do we:
- Maintain hierarchical relationships in circular space?
- Allocate angular space fairly among subtrees?
- Prevent overlaps during transformation?
- Preserve connectivity for later path creation?

#### 💭 Circular Layout Philosophy

**Why Circular?**
- **Compactness**: Better space utilization than linear
- **Natural Hierarchy**: Concentric circles represent tree levels intuitively
- **Even Distribution**: Angular allocation spreads nodes uniformly
- **Aesthetic Appeal**: More visually pleasing than linear arrangements

#### 🎯 Angular Allocation Strategy

**Core Problem:** How to divide 2π radians among root children?

```
Naive Approach: Equal angular sections (2π / child_count)
Problems: Ignores subtree complexity, wastes space

Proportional Approach: Allocate based on subtree "importance"
Metrics to consider:
- Leaf count (terminal nodes need more space)
- Total node count (larger subtrees need more space)  
- Shape complexity (wider shapes need more angular space)
- Depth (deeper subtrees might need different treatment)
```

#### 🔧 Radius Calculation Strategy

**Challenge:** What radius for each level?

```
Option A: Fixed spacing (r = level * constant)
Pros: Simple, predictable
Cons: May not account for shape sizes

Option B: Dynamic spacing based on content
Pros: More efficient space usage
Cons: Complex calculations

Option C: Hybrid approach
Start with fixed, adjust based on content density
```

#### 📐 Coordinate Transformation Math

**Polar to Cartesian Conversion:**
```
Given: radius r, angle θ
x = r * cos(θ)
y = r * sin(θ)

Considerations:
- Coordinate system origin (center vs corner)
- Angle direction (clockwise vs counterclockwise)
- Shape anchor points (center vs corner placement)
```

#### 🤔 Design Decisions to Explore

1. **Angular Allocation Metrics**: Which factors should influence space allocation?
2. **Level Radius Formula**: Fixed vs dynamic spacing between levels?
3. **Overlap Resolution**: How to handle shapes that would overlap after transformation?
4. **Symmetry vs Optimization**: Preserve visual balance vs minimize space?

**Files to add:**
- `stage2.go` - Circular layout transformation

#### Stage 2 Implementation (`stage2.go`):
```go
package minimap

import (
    "math"
    "github.com/justgook/gams/pkg/tree"
)

type AngularAllocation struct {
    StartAngle, EndAngle float64
    CenterAngle         float64
}

func Stage2(rng Random, treeInput *tree.Tree, getRoomShape GetRoomShapeFunc, grid *Grid) {
    if len(*treeInput) == 0 {
        return
    }
    
    // Clear existing grid
    *grid = make(Grid)
    
    root := GetRootNode(treeInput)
    positions := make(map[*tree.Node]Point)
    
    // 1. Allocate angular space for each root child subtree
    children := make([]*tree.Node, 0)
    for child := range treeInput.Children(root) {
        children = append(children, child)
    }
    
    if len(children) == 0 {
        // Only root exists
        rootShape := getRoomShape(root)
        positions[root] = Point{0, 0}
        PlaceShapeOnGrid(grid, rootShape, Point{0, 0}, 1)
        return
    }
    
    // Calculate angular allocation based on subtree sizes
    allocations := make(map[*tree.Node]AngularAllocation)
    totalLeaves := 0
    childLeaves := make(map[*tree.Node]int)
    
    for _, child := range children {
        leaves := CountLeaves(treeInput, child)
        childLeaves[child] = leaves
        totalLeaves += leaves
    }
    
    currentAngle := 0.0
    angleStep := 2 * math.Pi
    
    for _, child := range children {
        proportion := float64(childLeaves[child]) / float64(totalLeaves)
        angularWidth := angleStep * proportion
        
        allocations[child] = AngularAllocation{
            StartAngle:  currentAngle,
            EndAngle:    currentAngle + angularWidth,
            CenterAngle: currentAngle + angularWidth/2,
        }
        currentAngle += angularWidth
    }
    
    // 2. Place root at center
    rootShape := getRoomShape(root)
    positions[root] = Point{0, 0}
    PlaceShapeOnGrid(grid, rootShape, Point{0, 0}, 1)
    
    // 3. Calculate radius for each level
    maxDepth := GetTreeDepth(treeInput, root)
    levelRadius := make([]float64, maxDepth+1)
    levelRadius[0] = 0 // root at center
    
    for level := 1; level <= maxDepth; level++ {
        levelRadius[level] = float64(level * 15) // spacing between levels
    }
    
    // 4. Position nodes in circular layout
    for node := range treeInput.Traverse(root) {
        if node == root {
            continue // already placed
        }
        
        level := GetNodeLevel(treeInput, node)
        if level == 0 {
            continue
        }
        
        // Find which root child subtree this node belongs to
        var rootChild *tree.Node
        current := node
        for GetNodeLevel(treeInput, current) > 1 {
            current = treeInput.Parent(current)
        }
        rootChild = current
        
        allocation, exists := allocations[rootChild]
        if !exists {
            continue
        }
        
        // Calculate position within the angular allocation
        siblings := GetNodesAtLevel(treeInput, root, level)
        siblingIndex := 0
        totalSiblings := 0
        
        // Count siblings in this subtree at this level
        for _, sibling := range siblings {
            siblingCurrent := sibling
            for GetNodeLevel(treeInput, siblingCurrent) > 1 {
                siblingCurrent = treeInput.Parent(siblingCurrent)
            }
            if siblingCurrent == rootChild {
                totalSiblings++
                if sibling == node {
                    siblingIndex = totalSiblings - 1
                }
            }
        }
        
        // Calculate angle for this node
        var angle float64
        if totalSiblings == 1 {
            angle = allocation.CenterAngle
        } else {
            angleRange := allocation.EndAngle - allocation.StartAngle
            angleStep := angleRange / float64(totalSiblings)
            angle = allocation.StartAngle + angleStep*float64(siblingIndex) + angleStep/2
        }
        
        // Convert to cartesian coordinates
        radius := levelRadius[level]
        x := int(radius * math.Cos(angle))
        y := int(radius * math.Sin(angle))
        
        position := Point{x, y}
        positions[node] = position
        
        // Place on grid
        shape := getRoomShape(node)
        roomID := treeInput.IndexOf(node) + 1
        PlaceShapeOnGrid(grid, shape, position, roomID)
    }
}
```

**Testing After Stage 2:**
```bash
# Update gen.go to call Stage2 instead of Stage1
# View results to see circular transformation
# Verify angular allocation is working correctly
# Check that hierarchical relationships are preserved in circular layout
```

**Success Criteria:** 
- Circular layout with proper angular allocation
- Hierarchical relationships maintained
- No overlaps between rooms
- Root at center, children arranged in circles

---

### Stage 3: Path Creation & Connectivity 🛤️

**Objective:** Establish connections between all parent-child pairs while avoiding shape obstacles

#### 🧩 Design Challenge
Now that rooms are positioned, how do we connect them?
- Paths must not intersect room shapes (except at endpoints)
- Multiple paths may share infrastructure (corridors)
- Path aesthetics matter (prefer straight lines, avoid weird angles)
- Must handle cases where direct connection is impossible

#### 💭 Connectivity Philosophy

**Path Creation Strategy Spectrum:**
```
Simple → Complex
1. Direct lines (ignore obstacles)
2. Shape-aware lines (avoid room intersections)  
3. Manhattan distance paths (grid-aligned)
4. A* pathfinding (optimal obstacle avoidance)
5. Shared corridor systems (infrastructure reuse)
```

#### 🎯 Connection Point Selection

**Challenge:** Where exactly should paths connect to rooms?

```
Option A: Room centers (simple but may look odd)
Option B: Closest points between rooms (optimal distance)
Option C: Canonical connection points (doors/exits)
Option D: Aesthetically pleasing points (visual balance)
```

#### 🛤️ Path Representation Strategies

**Grid Representation Options:**
```
Option A: Negative room IDs for paths (-1, -2, etc.)
Pros: Simple, works with existing grid system
Cons: Limited path type differentiation

Option B: Separate path layer
Pros: More flexible, can overlay with rooms
Cons: Requires changes to existing system

Option C: Mixed approach - special grid values
Pros: Extends current system naturally
Cons: Need to handle special cases
```

#### 🔧 Pathfinding Algorithm Choices

**For Initial Implementation:**
- **Bresenham's Line Algorithm**: Fast, creates straight paths
- **Shape Intersection Checks**: Verify paths don't cross room interiors
- **Simple Rerouting**: If intersection detected, try alternative routes

**For Advanced Implementation:**
- **A* Pathfinding**: Optimal paths around obstacles
- **Corridor Sharing**: Paths can overlap/merge for efficiency
- **Path Aesthetics**: Prefer orthogonal paths, avoid diagonal sprawl

#### 🤔 Design Questions to Address

1. **Path Sharing**: Should multiple parent-child connections share corridor space?
2. **Path Width**: Single-cell paths vs wider corridors?
3. **Obstacle Avoidance**: How aggressive should obstacle avoidance be?
4. **Path Aesthetics**: Straight lines vs natural curves vs grid-aligned?
5. **Performance**: How to handle pathfinding for 1000+ connections efficiently?

#### 🎮 Integration with Game Mechanics

**Considerations for Game Context:**
- Paths become traversable corridors in final game
- Connection points become doorways/transitions
- Path width affects gameplay (narrow vs wide corridors)
- Shared paths create interesting hub areas

**Files to add:**
- `stage3.go` - Path creation and connectivity

#### Stage 3 Implementation (`stage3.go`):
```go
package minimap

import (
    "math"
    "github.com/justgook/gams/pkg/tree"
)

// Simple pathfinding using straight lines for now
// Can be enhanced with A* later if needed

func Stage3(rng Random, treeInput *tree.Tree, getRoomShape GetRoomShapeFunc, grid *Grid) {
    if len(*treeInput) == 0 {
        return
    }
    
    root := GetRootNode(treeInput)
    
    // Create paths between all parent-child pairs
    for node := range treeInput.Traverse(root) {
        if node == root {
            continue // root has no parent
        }
        
        parent := treeInput.Parent(node)
        if parent == nil {
            continue
        }
        
        // Find room positions from current grid
        parentPos, childPos := findRoomCenters(grid, treeInput, parent, node)
        if parentPos == nil || childPos == nil {
            continue
        }
        
        // Create simple straight-line path
        createPath(grid, *parentPos, *childPos)
    }
}

// findRoomCenters locates the center positions of parent and child rooms in the grid
func findRoomCenters(grid *Grid, t *tree.Tree, parent, child *tree.Node) (*Point, *Point) {
    parentID := t.IndexOf(parent) + 1
    childID := t.IndexOf(child) + 1
    
    var parentPoints, childPoints []Point
    
    // Find all points belonging to each room
    for point, id := range *grid {
        if id == parentID {
            parentPoints = append(parentPoints, point)
        } else if id == childID {
            childPoints = append(childPoints, point)
        }
    }
    
    if len(parentPoints) == 0 || len(childPoints) == 0 {
        return nil, nil
    }
    
    // Calculate centroids
    parentCenter := calculateCentroid(parentPoints)
    childCenter := calculateCentroid(childPoints)
    
    return &parentCenter, &childCenter
}

// calculateCentroid finds the center point of a set of points
func calculateCentroid(points []Point) Point {
    if len(points) == 0 {
        return Point{0, 0}
    }
    
    sumX, sumY := 0, 0
    for _, p := range points {
        sumX += p[0]
        sumY += p[1]
    }
    
    return Point{sumX / len(points), sumY / len(points)}
}

// createPath creates a simple straight line path between two points
func createPath(grid *Grid, start, end Point) {
    // Use Bresenham's line algorithm for straight path
    dx := abs(end[0] - start[0])
    dy := abs(end[1] - start[1])
    
    x, y := start[0], start[1]
    stepX := 1
    if start[0] > end[0] {
        stepX = -1
    }
    stepY := 1
    if start[1] > end[1] {
        stepY = -1
    }
    
    err := dx - dy
    
    for {
        // Use negative room ID to indicate path (will show differently in viewer)
        point := Point{x, y}
        if _, exists := (*grid)[point]; !exists {
            (*grid)[point] = -1 // path marker
        }
        
        if x == end[0] && y == end[1] {
            break
        }
        
        e2 := 2 * err
        if e2 > -dy {
            err -= dy
            x += stepX
        }
        if e2 < dx {
            err += dx
            y += stepY
        }
    }
}

// abs returns the absolute value of an integer
func abs(x int) int {
    if x < 0 {
        return -x
    }
    return x
}

**Testing After Stage 3:**
```bash
# Update gen.go to call Stage3 after Stage2
# View results to see rooms connected with paths
# Paths should show as different color/pattern in viewers
# Verify all parent-child relationships have paths
```

**Success Criteria:**
- All parent-child pairs connected with paths
- Paths visible in browser viewers
- No disconnected rooms
- Simple straight-line paths working

---

### Stage 4: Physics-Based Optimization ⚡

**Objective:** Use physics simulation to naturally resolve conflicts and improve layout aesthetics

#### 🧩 Design Challenge
The previous stages give us a valid layout, but it might not be optimal:
- Some paths might be unnecessarily long
- Rooms might be too far from their parents  
- The overall layout might not be as compact as possible
- Visual balance might be poor

How do we improve the layout while maintaining all constraints?

#### 💭 Physics Simulation Philosophy

**Why Physics-Based Optimization?**
- **Natural Conflict Resolution**: Forces naturally balance competing requirements
- **Emergent Behavior**: Complex layouts emerge from simple force rules
- **Intuitive Parameters**: Spring constants and repulsion forces are understandable
- **Incremental Improvement**: System gradually improves rather than jumping to solutions

#### ⚡ Force Model Design

**Core Forces to Consider:**

1. **🔗 Spring Forces (Attraction)**
   ```
   Purpose: Pull connected nodes closer together
   Formula: F = k * (current_distance - ideal_distance)
   Tuning: Stronger springs = tighter clusters
   ```

2. **💥 Repulsion Forces (Separation)**  
   ```
   Purpose: Push overlapping or too-close nodes apart
   Formula: F = k / (distance^2) 
   Range: Only affect nearby nodes for performance
   ```

3. **🎯 Hierarchical Forces (Structure Preservation)**
   ```
   Purpose: Maintain parent-child spatial relationships
   Implementation: Modified spring force with level awareness
   Consideration: Stronger forces between parent-child than siblings
   ```

4. **🌊 Boundary Forces (Containment)**
   ```
   Purpose: Prevent layout from sprawling infinitely
   Implementation: Weak inward force from layout edges
   Tuning: Balance compactness vs natural spacing
   ```

#### 🔧 Simulation Parameters

**Key Tuning Variables:**
```
Spring Constant (k_spring):
  High: Tight clusters, may cause instability
  Low: Loose layouts, slow convergence

Repulsion Constant (k_repulsion):
  High: Well-separated nodes, may prevent tight grouping
  Low: Potential overlaps, compact but crowded

Damping Factor:
  High: Quick convergence, may miss optimal solutions
  Low: Smooth movement, may oscillate indefinitely

Max Iterations:
  Balance: Computation time vs solution quality
```

#### 📊 Convergence Strategy

**How do we know when to stop the simulation?**

```
Option A: Fixed iteration count
Pros: Predictable performance
Cons: May stop before convergence or waste computation

Option B: Energy-based convergence
Monitor total system energy, stop when changes are small
Pros: Adaptive, stops at natural equilibrium
Cons: May never converge in some cases

Option C: Hybrid approach
Max iterations with early stopping if energy stabilizes
Pros: Best of both worlds
Cons: More complex implementation
```

#### 🎮 Performance Considerations

**Scaling to 1000+ Nodes:**
- **Spatial Partitioning**: Only calculate forces between nearby nodes
- **Force Caching**: Reuse calculations where possible  
- **Adaptive Time Steps**: Larger steps when system is stable
- **Early Termination**: Stop individual nodes that have converged

#### 🤔 Research Questions & Improvements

1. **Force Model Extensions**: 
   - Should we add rotational forces for shape orientation?
   - Aesthetic forces for visual balance/symmetry?
   - User preference forces (some rooms want to be central/peripheral)?

2. **Adaptive Parameters**:
   - Should spring constants vary based on tree level?
   - Dynamic damping based on system state?
   - Learning from previous optimizations?

3. **Multi-Objective Optimization**:
   - How to balance path length vs layout compactness?
   - Trading aesthetic appeal vs functional efficiency?
   - Preserving user-specified constraints during optimization?

#### 🔬 Experimental Validation

**Metrics to Track:**
- Total path length (connectivity efficiency)
- Layout compactness (bounding box area)  
- Overlap count (constraint violations)
- Visual balance (center of mass, symmetry measures)
- Convergence time (performance)

**Files to add:**
- `stage4.go` - Physics-based optimization

#### Stage 4 Implementation (`stage4.go`):
```go
package minimap

import (
    "math"
    "github.com/justgook/gams/pkg/tree"
)

type Force struct {
    X, Y float64
}

func Stage4(rng Random, treeInput *tree.Tree, getRoomShape GetRoomShapeFunc, grid *Grid) {
    if len(*treeInput) == 0 {
        return
    }
    
    // Simple physics-based optimization
    // Move rooms closer to their parents to minimize path lengths
    // Apply repulsion to prevent overlaps
    
    root := GetRootNode(treeInput)
    positions := extractCurrentPositions(grid, treeInput, getRoomShape)
    
    iterations := 10
    damping := 0.8
    
    for iter := 0; iter < iterations; iter++ {
        forces := make(map[*tree.Node]Force)
        
        // Calculate forces for each node
        for node := range treeInput.Traverse(root) {
            if node == root {
                continue // root stays fixed
            }
            
            force := Force{0, 0}
            
            // Spring force toward parent (attraction)
            parent := treeInput.Parent(node)
            if parent != nil {
                parentPos := positions[parent]
                nodePos := positions[node]
                
                dx := float64(parentPos[0] - nodePos[0])
                dy := float64(parentPos[1] - nodePos[1])
                distance := math.Sqrt(dx*dx + dy*dy)
                
                if distance > 0 {
                    springForce := 0.1 // spring constant
                    force.X += springForce * dx / distance
                    force.Y += springForce * dy / distance
                }
            }
            
            // Repulsion force from other nodes
            for otherNode := range treeInput.Traverse(root) {
                if otherNode == node {
                    continue
                }
                
                otherPos := positions[otherNode]
                nodePos := positions[node]
                
                dx := float64(nodePos[0] - otherPos[0])
                dy := float64(nodePos[1] - otherPos[1])
                distance := math.Sqrt(dx*dx + dy*dy)
                
                if distance > 0 && distance < 50 { // repulsion range
                    repulsionForce := 20.0 / (distance * distance) // inverse square
                    force.X += repulsionForce * dx / distance
                    force.Y += repulsionForce * dy / distance
                }
            }
            
            forces[node] = force
        }
        
        // Apply forces with damping
        for node, force := range forces {
            currentPos := positions[node]
            
            // Apply force with damping
            deltaX := int(force.X * damping)
            deltaY := int(force.Y * damping)
            
            newPos := Point{currentPos[0] + deltaX, currentPos[1] + deltaY}
            positions[node] = newPos
        }
    }
    
    // Update grid with new positions
    updateGridWithPositions(grid, treeInput, getRoomShape, positions)
    
    // Recreate paths after optimization
    Stage3(rng, treeInput, getRoomShape, grid)
}

// extractCurrentPositions finds the current center positions of all rooms
func extractCurrentPositions(grid *Grid, t *tree.Tree, getRoomShape GetRoomShapeFunc) map[*tree.Node]Point {
    positions := make(map[*tree.Node]Point)
    
    for _, node := range *t {
        roomID := t.IndexOf(node) + 1
        var roomPoints []Point
        
        for point, id := range *grid {
            if id == roomID {
                roomPoints = append(roomPoints, point)
            }
        }
        
        if len(roomPoints) > 0 {
            positions[node] = calculateCentroid(roomPoints)
        } else {
            positions[node] = Point{0, 0}
        }
    }
    
    return positions
}

// updateGridWithPositions clears and replaces room positions in the grid
func updateGridWithPositions(grid *Grid, t *tree.Tree, getRoomShape GetRoomShapeFunc, positions map[*tree.Node]Point) {
    // Clear existing room placements (keep paths for now)
    newGrid := make(Grid)
    for point, id := range *grid {
        if id < 0 { // keep paths (negative IDs)
            newGrid[point] = id
        }
    }
    *grid = newGrid
    
    // Place rooms at new positions
    for _, node := range *t {
        if pos, exists := positions[node]; exists {
            shape := getRoomShape(node)
            roomID := t.IndexOf(node) + 1
            PlaceShapeOnGrid(grid, shape, pos, roomID)
        }
    }
}

**Testing After Stage 4:**
```bash
# Update gen.go to call Stage4 after Stage3
# View results to see optimized layout
# Rooms should be closer to their parents
# Overlapping rooms should be pushed apart
# Verify paths are recreated after optimization
```

**Success Criteria:**
- Layout shows improvement over iterations
- Rooms move closer to their parents
- Overlapping rooms are separated
- System stabilizes after several iterations

---

### Stage 5: Integration, Analysis & Future Improvements 🎯

**Objective:** Complete system integration with analysis capabilities and improvement pathways

#### 🧩 Integration Challenges

**Stage Coordination Questions:**
- Should stages build incrementally or start fresh each time?
- How to handle cases where optimization breaks connectivity?  
- Parameter tuning across stages - local optima vs global optimization?
- Performance profiling - which stages are bottlenecks?

#### 📊 Analysis & Metrics Framework

**Layout Quality Metrics:**
```
Connectivity Metrics:
- Average path length
- Path efficiency ratio (straight-line vs actual)
- Connectivity graph properties (diameter, clustering)

Spatial Metrics:  
- Layout compactness (area utilization)
- Node density distribution
- Shape overlap incidents

Aesthetic Metrics:
- Visual balance (center of mass analysis)
- Symmetry measures  
- Edge crossing count (for paths)

Performance Metrics:
- Generation time per stage
- Memory usage during processing
- Scaling behavior (time vs node count)
```

#### 🔬 Experimental Framework

**A/B Testing Infrastructure:**
```go
type LayoutExperiment struct {
    Name string
    Parameters map[string]interface{}
    TestTrees []*tree.Tree
    Results []LayoutMetrics
}

// Compare different parameter sets
func CompareLayoutStrategies(experiments []LayoutExperiment)

// Statistical analysis of results  
func AnalyzeLayoutQuality(results []LayoutMetrics)
```

#### 🚀 Future Enhancement Pathways

**Level 1 Improvements (Near-term):**
- Parameter auto-tuning based on tree characteristics
- Better path aesthetics (prefer orthogonal paths)
- Shape rotation optimization for better packing
- Incremental updates for dynamic trees

**Level 2 Improvements (Medium-term):**
- Multi-objective optimization (Pareto frontiers)
- Machine learning for parameter prediction
- Advanced pathfinding with shared corridor systems
- Interactive layout editing capabilities

**Level 3 Improvements (Research-level):**
- Game-mechanic aware optimization (flow analysis, strategic positioning)
- Procedural room shape generation based on function
- Dynamic layout adaptation during gameplay
- VR/AR spatial layout considerations

#### 🤔 Open Research Questions

1. **Scalability Limits**: Where does the algorithm break down? 10K nodes? 100K?

2. **Tree Structure Dependencies**: How does algorithm performance vary with:
   - Tree depth vs breadth
   - Degree of node count imbalance
   - Shape complexity distribution

3. **Parameter Sensitivity**: Which parameters most affect final quality?

4. **Cross-Domain Applications**: Could this work for:
   - Network topology visualization
   - Organizational chart layout  
   - File system visualization
   - Abstract syntax tree display

#### 🛠️ Development Infrastructure

**Profiling & Debugging Tools:**
- Stage-by-stage timing analysis
- Memory allocation tracking
- Visual diff tools for layout comparison
- Parameter space exploration tools

**Quality Assurance:**
- Regression test suite with known-good layouts
- Stress testing with extreme tree structures  
- Performance benchmarking across platforms
- Visual inspection tools for manual quality assessment

#### Updated `gen.go` - Complete Pipeline:
```go
package minimap

import (
    "github.com/justgook/gams/pkg/tilemap"
    "github.com/justgook/gams/pkg/tree"
)

func GenerateMinimap(
    rng Random,
    treeInput *tree.Tree,
    getRoomShape GetRoomShapeFunc,
) (*tilemap.TileMap, error) {
    grid := &Grid{}
    
    // Stage 1: Linear hierarchical layout
    Stage1(rng, treeInput, getRoomShape, grid)
    
    // Stage 2: Circular transformation
    Stage2(rng, treeInput, getRoomShape, grid)
    
    // Stage 3: Path creation
    Stage3(rng, treeInput, getRoomShape, grid)
    
    // Stage 4: Physics optimization
    Stage4(rng, treeInput, getRoomShape, grid)
    
    // Convert to tilemap for visualization
    data, width := Grid2Tilemap(grid)
    return &tilemap.TileMap{
        Layers: []tilemap.TileLayer{{
            Width: width,
            Data:  data,
        }},
    }, nil
}

// Individual stage functions for testing
func GenerateMinimapStage1(rng Random, treeInput *tree.Tree, getRoomShape GetRoomShapeFunc) (*tilemap.TileMap, error) {
    grid := &Grid{}
    Stage1(rng, treeInput, getRoomShape, grid)
    data, width := Grid2Tilemap(grid)
    return &tilemap.TileMap{Layers: []tilemap.TileLayer{{Width: width, Data: data}}}, nil
}

func GenerateMinimapStage2(rng Random, treeInput *tree.Tree, getRoomShape GetRoomShapeFunc) (*tilemap.TileMap, error) {
    grid := &Grid{}
    Stage2(rng, treeInput, getRoomShape, grid)
    data, width := Grid2Tilemap(grid)
    return &tilemap.TileMap{Layers: []tilemap.TileLayer{{Width: width, Data: data}}}, nil
}

func GenerateMinimapStage3(rng Random, treeInput *tree.Tree, getRoomShape GetRoomShapeFunc) (*tilemap.TileMap, error) {
    grid := &Grid{}
    Stage2(rng, treeInput, getRoomShape, grid)
    Stage3(rng, treeInput, getRoomShape, grid)
    data, width := Grid2Tilemap(grid)
    return &tilemap.TileMap{Layers: []tilemap.TileLayer{{Width: width, Data: data}}}, nil
}

func GenerateMinimapStage4(rng Random, treeInput *tree.Tree, getRoomShape GetRoomShapeFunc) (*tilemap.TileMap, error) {
    grid := &Grid{}
    Stage2(rng, treeInput, getRoomShape, grid)
    Stage3(rng, treeInput, getRoomShape, grid)
    Stage4(rng, treeInput, getRoomShape, grid)
    data, width := Grid2Tilemap(grid)
    return &tilemap.TileMap{Layers: []tilemap.TileLayer{{Width: width, Data: data}}}, nil
}
```

#### Testing Strategy:
```bash
# Test each stage independently using existing viewers
# 1. Create test trees with known structures
# 2. Call GenerateMinimapStageN functions
# 3. View results in browser using view-tilemap.js or view-minimap.js
# 4. Verify each stage produces expected results before proceeding

# Integration testing:
# 1. Test with simple trees (2-3 nodes)
# 2. Test with medium trees (10-20 nodes) 
# 3. Test with large trees (100+ nodes)
# 4. Test with different room shapes
# 5. Monitor performance and layout quality
```

**Success Criteria:**
- Each stage can be tested independently
- All stages work together in complete pipeline
- Browser viewers show expected results at each stage
- Layout quality improves through the stages
- System handles various tree sizes and shapes

---

## 🧪 Research-Oriented Testing Strategy

### 🔬 Experimental Design Framework

#### Hypothesis-Driven Testing:
```
H1: Circular layouts produce more compact results than linear layouts
Test: Generate same tree with both approaches, measure bounding box area

H2: Physics optimization converges faster with higher damping  
Test: Vary damping parameter, measure iterations to convergence

H3: Angular allocation based on leaf count produces better balance than equal allocation
Test: Compare visual balance metrics between allocation strategies
```

#### 📊 Comparative Analysis Infrastructure:
```go
type LayoutComparison struct {
    Strategy string
    Tree *tree.Tree  
    Parameters map[string]interface{}
    Metrics LayoutMetrics
    VisualResult *tilemap.TileMap
}

func RunLayoutExperiment(trees []*tree.Tree, strategies []LayoutStrategy) []LayoutComparison
func AnalyzeResults(comparisons []LayoutComparison) ExperimentReport
```

### 🎮 Interactive Research Tools

#### Browser-Based Research Interface:
- **Parameter Sliders**: Real-time parameter adjustment with immediate visual feedback
- **Side-by-Side Comparison**: Multiple layout strategies displayed simultaneously  
- **Metric Dashboard**: Real-time display of compactness, path length, balance metrics
- **Tree Structure Editor**: Create custom test trees for specific scenarios

#### Research Scenarios:
```
Scenario A: "Balanced vs Unbalanced Trees"
- Generate trees with varying balance factors
- Measure how algorithm handles different structures
- Identify optimal parameters for each tree type

Scenario B: "Shape Complexity Impact"  
- Test with simple shapes (squares) vs complex shapes (L-shapes, crosses)
- Measure performance degradation and quality changes
- Optimize for shape-specific parameters

Scenario C: "Scale Testing"
- Trees from 10 nodes to 10,000 nodes
- Measure performance scaling and quality degradation
- Identify algorithmic bottlenecks

Scenario D: "Real-world Tree Patterns"
- File system hierarchies  
- Organizational charts
- Game skill trees
- Measure algorithm applicability across domains
```

### 🔍 Deep Analysis Tools

#### Visual Analysis:
- **Heat Maps**: Node density, force magnitude, stress areas
- **Flow Visualization**: Path efficiency, bottleneck identification  
- **Time-lapse**: Algorithm progression over iterations
- **Comparison Overlays**: Before/after optimization results

#### Statistical Analysis:
```go
type ResearchMetrics struct {
    // Spatial Analysis
    CompactnessRatio float64
    LayoutDensity float64  
    SpaceEfficiency float64
    
    // Connectivity Analysis
    AveragePathLength float64
    PathEfficiencyRatio float64
    ConnectivityIndex float64
    
    // Aesthetic Analysis  
    VisualBalance float64
    SymmetryMeasure float64
    EdgeCrossings int
    
    // Performance Analysis
    GenerationTime time.Duration
    MemoryUsage int64
    ConvergenceIterations int
}
```

### 🧠 Learning & Improvement Framework

#### Parameter Learning:
```go
type ParameterLearner struct {
    TreeCharacteristics TreeFeatures
    OptimalParameters map[string]float64
    QualityScore float64
}

// Learn optimal parameters for different tree types
func LearnOptimalParameters(experiments []LayoutComparison) ParameterLearner
```

#### Quality Feedback Loop:
- Manual quality ratings on generated layouts
- Correlation analysis between metrics and human preference
- Parameter adjustment recommendations
- Continuous improvement tracking

### 🎯 Research Questions for Investigation

#### Algorithmic Questions:
1. **Convergence Analysis**: Under what conditions does physics simulation fail to converge?
2. **Parameter Sensitivity**: Which parameters have the most impact on final quality?
3. **Scalability Bounds**: What are the practical limits for tree size and complexity?

#### Design Questions:  
1. **Force Model Effectiveness**: Do simple spring/repulsion forces capture layout quality well?
2. **Stage Interaction**: How do earlier stages constrain later optimization effectiveness?
3. **Metric Correlation**: Which automated metrics best predict human aesthetic preferences?

#### Application Questions:
1. **Domain Specificity**: Does the algorithm work equally well for different tree types?
2. **Real-time Adaptation**: Could the algorithm adapt layouts during interactive use?
3. **Cross-cultural Aesthetics**: Do layout preferences vary across different user groups?

---

## 🛠️ Development Commands

```bash
# Work within existing project structure
cd plugins/minimap/minimap

# Test specific stage implementations
go test -v

# Build minimap plugin
cd ../.. && go build -o minimap main.go

# Test in browser
# 1. Start browser server: cd ../cmd/browser && go run server.go
# 2. Open browser to view results
# 3. Use existing viewers to test each stage
```

---

## 📁 Current Project Structure

```
plugins/minimap/minimap/
├── TREE_LAYOUT_IMPLEMENTATION.md   # This updated guide
├── common.go                       # Enhanced with new utilities  
├── gen.go                         # Main orchestration (update to call stages)
├── stage1.go                      # Linear hierarchical layout (implement)
├── stage2.go                      # Circular transformation (implement)  
├── stage3.go                      # Path creation (implement)
├── stage4.go                      # Physics optimization (implement)
└── [tests as needed]
```

**Integration Points:**
- Input: `tree.Tree` from existing tree package
- Shapes: `RoomShape [][2]int` via `GetRoomShapeFunc`  
- Output: `Grid map[Point]int` → `tilemap.TileMap`
- Visualization: Existing browser viewers (view-tilemap.js, view-minimap.js)
- Storage: Existing tilemap-storage plugin

---

## 🚀 Research-Driven Implementation Workflow

### Phase 1: Foundation & Exploration 🔍
1. **Enhance `common.go`** with utility functions and research infrastructure
2. **Implement `stage1.go`** with multiple linear layout strategies for comparison
3. **Create analysis tools** to measure and compare different approaches
4. **Research Questions**: What linear layout strategy works best for different tree types?

### Phase 2: Transformation & Optimization 🔄  
1. **Implement `stage2.go`** with configurable circular transformation parameters
2. **Add parameter exploration tools** for angular allocation strategies
3. **Implement `stage3.go`** with multiple pathfinding approaches
4. **Research Questions**: How does circular transformation affect final layout quality?

### Phase 3: Physics & Refinement ⚡
1. **Implement `stage4.go`** with extensible force model system
2. **Add convergence analysis tools** and performance profiling  
3. **Create parameter learning system** for automatic tuning
4. **Research Questions**: Can physics simulation significantly improve on geometric placement?

### Phase 4: Analysis & Future Research 🎯
1. **Build comprehensive analysis framework** with quality metrics
2. **Create experimental harness** for systematic parameter exploration
3. **Implement comparison tools** for strategy evaluation
4. **Research Questions**: What are the fundamental limits and opportunities?

---

## 🤝 Collaboration & Discussion Framework

### 💬 Implementation Discussion Points

#### Stage 1 Decisions:
- **Space Allocation**: Fixed vs proportional vs adaptive spacing strategies?
- **Level Calculation**: BFS vs DFS vs user-defined level assignment?
- **Overflow Handling**: What happens when shapes don't fit in allocated space?

#### Stage 2 Decisions:
- **Angular Metrics**: Leaf count vs node count vs custom importance for space allocation?
- **Radius Strategy**: Linear vs logarithmic vs content-dependent level spacing?
- **Transformation Smoothness**: Gradual vs immediate transformation between linear and circular?

#### Stage 3 Decisions:
- **Pathfinding Complexity**: Direct lines vs A* vs corridor sharing systems?
- **Connection Aesthetics**: Straight vs orthogonal vs curved path preferences?
- **Performance Trade-offs**: Path quality vs generation speed for large trees?

#### Stage 4 Decisions:
- **Force Model**: Which forces are essential vs nice-to-have?
- **Convergence Criteria**: Energy-based vs movement-based vs time-based stopping?
- **Parameter Adaptation**: Fixed vs dynamic vs learned parameter strategies?

### 🧪 Experimental Validation Framework

#### Immediate Experiments:
```go
// Compare linear layout strategies
func ExperimentLinearSpacing(tree *tree.Tree) LayoutComparison

// Test circular transformation parameters  
func ExperimentAngularAllocation(tree *tree.Tree, strategies []AllocationStrategy) []LayoutComparison

// Validate physics model effectiveness
func ExperimentPhysicsParameters(tree *tree.Tree, forceParams []ForceParameters) []LayoutComparison
```

#### Long-term Research Directions:
- **Cross-domain Validation**: Test on file systems, org charts, game trees
- **User Study Integration**: Human preference vs automated metrics correlation
- **Performance Optimization**: Algorithmic improvements for very large trees
- **Interactive Extensions**: Real-time editing and constraint satisfaction

This research-oriented approach ensures that implementation decisions are data-driven and that the algorithm can be systematically improved and validated.
