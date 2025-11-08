# Worldgraph Plugin

This plugin generates a complete world graph for a Metroidvania-style game as a **single unified tree** containing all rooms across all biomes.

## Features

### Single Tree Structure
Instead of having separate biome graphs, all rooms are in one flat tree structure:
- Each biome is expanded into individual rooms
- Rooms have descriptive names: `{Biome}-{RoomType}`
- All connections are preserved in the tree hierarchy
- Keys and locks are tracked on edges and node data

### Room Types Per Biome

Each biome generates several room types:

- **Entry Room**: `{Biome}-ENTER` (for the first biome only)
- **Entrance Rooms**: `{Biome}-FROM-{ParentBiome}` (from parent biomes)
- **Key Rooms**: `{Biome}-{KeyName}` (contains a specific key/ability)
- **Boss Room**: `{Biome}-BOSS` (central challenge)
- **Exit Rooms**: `{Biome}-TO-{ChildBiome}` (to child biomes)
- **Final Exit**: `{Biome}-EXIT` (for leaf biomes only)

### Room Connections

- Rooms connect sequentially within each biome
- 30% chance of adding shortcuts from earlier rooms
- Exit rooms connect to entrance rooms of adjacent biomes
- Edges can have lock requirements (comma-separated keys)

## Output Structure

Single tree with all rooms:

```json
{
  "nodes": {
    "Tower-ENTER": {
      "name": "Tower-ENTER",
      "data": null,
      "children": [{"to": "Tower-BOSS"}]
    },
    "Tower-BOSS": {
      "name": "Tower-BOSS",
      "data": {"type": "boss"},
      "parent": "Tower-ENTER",
      "children": [{"to": "Tower-TO-Lab"}]
    },
    "Lab-FROM-Tower": {
      "name": "Lab-FROM-Tower",
      "parent": "Tower-TO-Lab",
      "children": [{"to": "Lab-DoubleJump"}]
    },
    "Lab-DoubleJump": {
      "name": "Lab-DoubleJump",
      "data": {"key": "DoubleJump"},
      "parent": "Lab-FROM-Tower",
      "children": [{"to": "Lab-BOSS"}]
    }
  },
  "root": "Tower-ENTER"
}
```

## Example World

**Input:**
```json
{
  "biomes": ["Tower", "Lab", "Ruins", "Caves", "Depths", "Start"],
  "keys": ["DoubleJump", "KeyA", "KeyB", "Fireball"]
}
```

**Generated Rooms (24 total):**

### Tower (entry biome, no keys)
```
Tower-ENTER → Tower-BOSS → Tower-TO-Lab
                         ├→ Tower-TO-Caves  
                         └→ Tower-TO-Start
```

### Lab (has DoubleJump)
```
Lab-FROM-Tower → Lab-DoubleJump [key] → Lab-BOSS → Lab-TO-Ruins
```

### Caves (has KeyB, requires DoubleJump+KeyA)
```
Caves-FROM-Tower → Caves-KeyB [key] → Caves-BOSS → Caves-TO-Depths [locked: DoubleJump,KeyA,KeyB]
```

### Depths (exit biome, no keys)
```
Depths-FROM-Caves → Depths-BOSS → Depths-EXIT
```

## Usage

The plugin is called via WASM:

```bash
make cli-run
```

### Input

```json
{
  "biomes": ["Start", "Caves", "Ruins", "Tower", "Lab", "Depths"],
  "keys": ["DoubleJump", "KeyA", "KeyB", "Fireball"],
  "treeId": "my-world",  // Optional: ID to store in tree-storage (default: "worldgraph")
  "storeTree": true      // Optional: whether to store in tree-storage (default: true)
}
```

### Tree Storage Integration

By default, the worldgraph plugin stores its output in the `tree-storage` plugin:
- **Default behavior**: Tree is stored with ID `"worldgraph"`
- **Custom ID**: Set `treeId` to use a different storage ID
- **Disable storage**: Set `storeTree: false` to skip storage

This allows the minimap plugin (and other plugins) to reference the tree by ID instead of passing the entire tree structure.

**Example workflow:**
```go
// 1. Generate world graph (stores in tree-storage as "my-world")
worldgraphInput := {"biomes": [...], "keys": [...], "treeId": "my-world"}
manager.Call("worldgraph", "worldgraph2", worldgraphInput)

// 2. Generate minimap from stored tree
minimapInput := {"treeId": "my-world"}
manager.Call("minimap", "minimap", minimapInput)
```

## Node Data

Nodes can have optional metadata in their `data` field:

- **Key rooms**: `{"key": "DoubleJump"}`
- **Boss rooms**: `{"type": "boss"}`
- **Exit rooms**: `{"type": "exit"}`

## Edge Names

Edges can have lock requirements:
- Empty string `""` = no lock
- `"shortcut"` = optional shortcut path
- `"KeyA,KeyB"` = requires KeyA AND KeyB

## Benefits

1. **Single flat structure** - Easy to traverse and query
2. **Clear room naming** - Room type and biome in the name
3. **Preserved hierarchy** - Parent-child relationships maintained
4. **Lock tracking** - Edge names contain required keys
5. **Ready for spatial layout** - Can be converted to 2D room placement

## Next Steps

This room tree can be used for:
1. 2D spatial layout generation (minimap)
2. Room content generation (enemies, treasures)
3. Door placement based on parent-child connections
4. Graph analysis (critical path, optional areas)
5. Difficulty balancing by depth

## Implementation

- `buildProgressionGraph2()` - Creates initial biome tree with key placement
- `placeKeysEvenly()` - Distributes keys across biomes
- `assignLocks()` - Determines lock requirements for biome transitions
- `expandBiomesToRooms()` - **NEW** - Expands each biome into rooms in a single tree
