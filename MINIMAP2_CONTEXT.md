# Minimap2 Context Summary

## **Algorithm Overview**
Minimap2 uses **incremental corridor generation** to convert `tree3.Tree` → 2D spatial layout with **100% success guarantee**.

### **Core Principle**
- **Corridors = Room Extensions** (not separate entities)
- **One spatial constraint**: "path to outside map bounds"
- **Guaranteed placement** through adaptive room expansion

### **Algorithm Flow**
```
1. Place root at origin
2. BFS through tree nodes
3. For each parent node:
   a. Count children needing doors
   b. If insufficient door capacity → Expand room with corridors
   c. Place each child at available door position
   d. If child placement blocks existing rooms → Expand blocked room
   e. Connect with doors
```

### **Corridor Expansion Strategy** (Critical!)
When room needs more doors or placement blocks other rooms:
1. **Systematic depth search**: Try all +1 extensions, then +2, then +3, etc.
2. **Adjacent tile priority**: Only extend to tiles directly adjacent to current room
3. **Iterative deepening**: 
   - Depth 1: Try all single-tile extensions
   - Depth 2: Try all 2-tile combinations  
   - Depth 3: Try all 3-tile combinations
   - Continue up to MaxExtensionDepth (default: 20)
4. **Path validation**: Each extension must maintain "path to outside" constraint

### **Key Data Structures**
- `IncrementalGenerator`: Main algorithm state
- `ExtensionCache`: Performance optimization for corridor search
- `TileMap`: Output format with layers/metadata

## **Current Issues Found**

### **Test Results** (`go run test_nodecount_validation.go`)
- **67% of tests fail** - fewer rooms placed than tree nodes
- **Missing rooms increase with tree size** (13+ missing in large trees)
- **Silent failures** - no errors thrown, rooms just don't get placed

### **Root Cause Locations**
1. **Lines 218-238**: Complex door expansion retry logic - not following systematic depth search
2. **Lines 273-320**: "Last resort" fallback that fails silently - should use proper extension algorithm  
3. **Lines 186-190**: BFS queue management skips nodes when placement fails
4. **Lines 374-411**: Extension search exists but not properly integrated with placement
5. **Missing error handling**: Failed placements don't propagate up

### **Priority Fixes**
1. **Integrate systematic extension search** into main placement logic
2. **Fix door capacity expansion** to use depth-first tile search (not retries)
3. **Add room blocking detection** and automatic expansion of blocked rooms
4. **Ensure every tree node becomes a room** (1:1 guarantee)  
5. **Remove complex retry logic** - replace with proper extension algorithm
6. **Fix BFS traversal** to never skip nodes due to placement failures

## **Test Framework**
- `test_nodecount_validation.go`: Validates tree nodes = placed rooms
- Uses `treegen` package to generate test trees
- Black-box testing approach with multiple configurations
- Run: `go run test_nodecount_validation.go`

## **Expected Behavior**
**Input**: tree3.Tree with N nodes  
**Output**: TileMap with N rooms placed + corridors  
**Constraints**: 
- Every tree node MUST become exactly one room
- If room needs more doors → extend with corridors systematically
- If room placement blocks others → expand blocked room automatically  
- Always maintain "path to outside map bounds"

## **Refactoring Goal**
Transform unreliable placement logic → guaranteed 1:1 node-to-room mapping while maintaining the incremental corridor generation approach described in README.