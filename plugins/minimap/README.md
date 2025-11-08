# Minimap Plugin

This WASM plugin converts a world tree (from the worldgraph plugin) into a 2D spatial layout for Metroidvania-style minimap generation.

## Input Format

The minimap plugin supports three input modes:

### 1. Reference Tree Storage (Recommended)

```json
{
  "treeId": "worldgraph"
}
```

This loads the tree from the `tree-storage` plugin. Use this when chaining with worldgraph:
1. Worldgraph generates and stores tree with ID `"worldgraph"` (default)
2. Minimap loads tree from storage using the same ID

### 2. Direct Tree Input

```json
{
  "tree": {
    "nodes": {
      "Tower-ENTER": {"name": "Tower-ENTER", "data": {}, "children": [{"to": "Tower-BOSS"}]},
      "Tower-BOSS": {"name": "Tower-BOSS", "data": {"type": "boss"}, "parent": "Tower-ENTER"}
    },
    "root": "Tower-ENTER"
  }
}
```

### 3. Legacy Format (Backwards Compatible)

```json
{
  "nodes": {
    "Tower-ENTER": {"name": "Tower-ENTER", "children": [{"to": "Tower-BOSS"}]},
    "Tower-BOSS": {"name": "Tower-BOSS", "parent": "Tower-ENTER"}
  },
  "root": "Tower-ENTER"
}
```

## Output Format

```json
{
  "rooms": {
    "Tower-ENTER": {
      "tiles": [[0, 0]],
      "doors": {
        "0_0": 4
      },
      "tileOrigins": {
        "0_0": 0
      }
    },
    "Tower-BOSS": {
      "tiles": [[0, 1], [1, 1]],
      "doors": {
        "0_1": 1,
        "1_1": 8
      },
      "tileOrigins": {
        "0_1": 0,
        "1_1": 0
      }
    }
  },
  "bounds": {
    "minX": 0, "maxX": 1,
    "minY": 0, "maxY": 1
  }
}
```

## Door Masks

Doors are encoded as a bitmask for cardinal directions:
- North: 1
- East: 2
- South: 4
- West: 8

Multiple doors on the same tile are combined using bitwise OR (e.g., North + East = 3).

## Tile Origins

The `tileOrigins` field tracks how each tile in a room was created:
- `0` (TileOriginShape): Original tile from the room shape (from `getRoomShape`)
- `1` (TileOriginConnection): Generated tile for connections (e.g., pathfinding corridors)

This metadata helps downstream systems know which tiles need decoration and which are structural connections. For example:
- **Original tiles** (0) can be decorated with room-specific content, enemies, treasures, etc.
- **Connection tiles** (1) are primarily for connectivity and might only need basic corridor decoration

## Algorithm

1. Place root room at origin (0, 0)
2. Traverse tree using breadth-first search
3. For each child room:
   - Get parent room's available neighbors
   - Place child room at nearest available location
   - Add doors between parent and child
4. Export final grid with room positions and door placements

## Room Types

The plugin supports different room shapes based on room type:
- `ENTER`: Single tile
- `CORRIDOR_VERT_*`: Vertical corridors (2-4 tiles)
- `CORRIDOR_HORIZ_*`: Horizontal corridors (2-4 tiles)
- `BOSS`: Larger boss room (4-8 tiles)
- `KEY`: Room containing an ability/item
- `SQUARE_2x2`: 2x2 square room
- `RECT_2x3`: 2x3 rectangular room

## Visualization

You can visualize the minimap output using the web-based visualizer at `tools/minimap_visualizer.html`. The visualizer displays:

- **Room tiles** with unique colors per room
- **Doors** as gray circles on tile edges
- **Tile origins** with visual patterns:
  - Solid color: Original tiles from room shape (origin = 0)
  - Diagonal stripes: Connection tiles generated for pathfinding (origin = 1)
- **Hover information** showing room name, position, tile origin, and doors
- **Statistics** including tile counts by origin type

Simply paste the plugin's JSON output into the visualizer to see an interactive map.

## Building

```bash
make plugins-release
```

This will compile the plugin to `build.nosync/minimap.wasm`.
