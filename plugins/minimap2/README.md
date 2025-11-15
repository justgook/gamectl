# Minimap2 Plugin

Modern refactored minimap generation plugin for GameCtl, following the clean architecture patterns established in treegen.

## Overview

Minimap2 generates 2D spatial layouts from `tree3.Tree` structures for Metroidvania-style minimap generation. It provides a clean separation between plugin wrapper logic and pure generation functions for improved testability and maintainability.

## Architecture

### File Structure
- `main.go` - Plugin wrapper logic (WASM exports, PDK integration, storage calls)
- `gen.go` - Pure minimap generation logic (testable, reusable)
- `README.md` - Documentation

### Key Improvements over Original Minimap
1. **Clean Separation**: Plugin concerns separated from generation logic
2. **tree3.Tree Support**: Works with modern tree3 structure using ParentId references
3. **Dependency Injection**: `getRoomShape` function passed as parameter for testability
4. **Pure Functions**: Generation logic can be unit tested without WASM context
5. **Consistent Patterns**: Follows treegen architectural patterns

## API

### Input
```json
{
  "treeId": "string",     // Required: tree to read from tree-storage2
  "mapId": "string",      // Required: map ID to save in tilemap-storage
  "config": {             // Optional: generation configuration
    "maxAttempts": 20,    // Maximum placement attempts per room
    "roomSpacing": 0,     // Minimum spacing between rooms
    "layoutStyle": "bfs", // Layout generation style
    "allowOverlap": false,// Allow room overlap
    "preferCompact": true // Prefer compact layouts
  }
}
```

### Output
```json
{
  "success": true,
  "error": "optional error message"
}
```

## Workflow

1. **Read Tree**: Retrieves `tree3.Tree` from `tree-storage2` using provided `treeId`
2. **Generate Layout**: Creates 2D spatial layout with room placement and door connections
3. **Store Tilemap**: Saves resulting tilemap to `tilemap-storage` using provided `mapId`

## Room Shape Selection

Currently implemented in `main.go` as `getRoomShape(*tree3.Node) minimap.RoomShape`. This function:
- Uses the same room shape variants as the original minimap
- Will be extracted to a dedicated plugin in the future
- Provides random shape selection with bias toward flexible shapes

## Integration

The plugin integrates with:
- **tree-storage2**: Input tree source
- **tilemap-storage**: Output tilemap destination 
- **pkg/minimap**: Core minimap generation utilities
- **pkg/tree3**: Modern tree data structures

## Future Plans

- Extract `getRoomShape` logic to dedicated room shape plugin
- Add more layout generation algorithms beyond BFS
- Support for custom constraint validation
- Performance optimizations for large trees