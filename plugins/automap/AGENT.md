# Automap Plugin - Agent Testing & Development Guide

## 🎯 Purpose

This guide helps AI agents (and developers) understand how to test, debug, and improve the automap plugin. It provides complete context on where test data lives, how to run tests, and what to verify.

## 📂 Project Structure

### Plugin Files (Current Directory)
```
plugins/automap/
├── AGENT.md          ← This file
├── README.md         ← User-facing documentation
├── SPEC.md          ← Automapping metadata specification
├── main.go          ← Entry point & tilemap storage integration
├── engine.go        ← Main automapping orchestration
├── parser.go        ← Rules parsing from tilemap format
├── matcher.go       ← Pattern matching logic
├── output.go        ← Output application logic
├── config.go        ← Global configuration parsing
├── special.go       ← Special tile handling
└── types.go         ← Core data structures
```

### Test Data Locations

#### 1. **SQL Storage** (Primary Data Source)
**Location:** `cmd/browser/data/tilemap-storage.sql`

This file contains SQL INSERT statements that populate the in-memory SQLite database used by the browser application.

**Current Maps:**
- `tileset_demo` - Simple 3x3 demo tilemap
- `rules` - **Main rules map for automap** (39x9 grid with multiple patterns)

**Format:**
```sql
INSERT INTO tilemap_storage (name, data) VALUES
(
  'rules',
  '{"props":{...},"layers":[...]}'
);
```

#### 2. **Generated Maps** (Runtime)
These are created during pipeline execution:
- `progression` - World tree (created by treegen plugin)
- `new_map` - Minimap generated from tree (created by minimap plugin)
- `automap_result` - Output from automap transformation

**Storage:** In-memory SQLite database (browser context)

#### 3. **Test Data in Code**
**Location:** `plugins/automap/main.go`

Functions that create example tilemaps:
- `createRulesMap()` - Creates basic wall corner detection rules
- `createInputMap()` - Creates 20x15 room outline for testing
- `createOutputMap()` - Creates empty output map template

## 🧪 Testing Strategies

### 1. Browser-Based Testing (Recommended)

**Prerequisites:**
```bash
# Ensure server is running
make browser-run
# Navigate to http://localhost:8080
```

**Test Workflow:**

**Option A: Using Pipeline View**
1. Switch to "Pipeline" view in right panel
2. Click "Generate Tree" (Step 1)
3. Click "Generate Minimap" (Step 2)
4. Click "Apply Automap" (Step 3)
5. Check console for `[Automap] Success` message
6. Verify toast notification: "Automap generated: automap_result"

**Option B: Using Node Graph**
1. Switch to "Node Graph" view
2. Click "▶ Run" button
3. Watch node_3 (AutoMap) execute
4. View results in tilemap viewers (node_6, node_7, node_8)

**Option C: Direct Plugin Call (Console)**
```javascript
// In browser console
const result = await pluginManager.call("automap", "automap", JSON.stringify({
  rulesMapId: "rules",
  inputMapId: "new_map",
  outputMapId: "automap_result"
}))
console.log(new TextDecoder().decode(result.output))
```

### 2. Unit Testing (Go)

**Create Test File:**
```bash
cd /Users/gook/Repos/gamectl/plugins/automap
touch parser_test.go matcher_test.go engine_test.go
```

**Example Test Structure:**
```go
// parser_test.go
package main

import (
    "testing"
    "github.com/justgook/gamectl/pkg/tilemap"
)

func TestParseRules(t *testing.T) {
    rulesMap := createTestRulesMap()
    config := &GlobalConfig{
        SpecialTiles: SpecialTileDefs{
            Empty: 4,
            NonEmpty: 3,
            Ignore: 2,
            Negate: 1,
            Other: 5,
        },
    }
    
    rules, err := ParseRules(rulesMap, config)
    if err != nil {
        t.Fatalf("ParseRules failed: %v", err)
    }
    
    if len(rules) == 0 {
        t.Error("Expected at least one rule")
    }
}

func createTestRulesMap() *tilemap.TileMap {
    tm := tilemap.NewTileMap()
    tm.Props["rule_Empty"] = "4"
    tm.Props["rule_NonEmpty"] = "3"
    // ... setup test data
    return tm
}
```

**Run Tests:**
```bash
go test ./plugins/automap/... -v
```

### 3. Integration Testing

**Test Full Pipeline:**
```bash
# Start server in background
make browser-run &

# Wait for startup
sleep 3

# Run playwright tests (if available)
# or use manual browser testing
```

## 🔍 Debugging Guide

### Common Issues

#### 1. "failed to unmarshal tilemap: invalid character"
**Cause:** CSV parsing issue when reading from SQL storage

**Solution:** Check `getTilemap()` in `main.go`:
```go
// Should use CSV parser, not raw string split
lines := util.ParseCSVLines(csv)
dataJSON := lines[1][0]  // Properly parsed field
json.Unmarshal([]byte(dataJSON), &tm)
```

**Verify:** Check line 275-301 in `main.go`

#### 2. "tilemap not found: {mapId}"
**Cause:** Map doesn't exist in SQL storage

**Solution:** 
- Run prerequisite steps (tree → minimap)
- Check `tilemap-storage.sql` has the map
- Query SQL directly:
```javascript
await pluginManager.call("sql", "query", 
  "SELECT name FROM tilemap_storage")
```

#### 3. "no rules found in rules map"
**Cause:** Rules map missing required metadata

**Check:**
```javascript
// In browser console
const result = await pluginManager.call("sql", "query", 
  "SELECT data FROM tilemap_storage WHERE name = 'rules'")
console.log(new TextDecoder().decode(result.output))
```

**Verify Properties:**
- Map-level: `rule_Empty`, `rule_NonEmpty`, `rule_Ignore`, `rule_Negate`, `rule_Other`
- Layer 0: `rule_role: "input"`, `rule_target_layer: "#0"`
- Layer 1: `rule_role: "output"`, `rule_target_layer: "#0"`

### Logging & Debugging

**Add Debug Logs:**
```go
// In engine.go or matcher.go
import "fmt"

func (e *AutomapEngine) Apply(...) error {
    fmt.Printf("[DEBUG] Rules count: %d\n", len(rules))
    fmt.Printf("[DEBUG] Input map size: %dx%d\n", width, height)
    // ... more debug output
}
```

**Rebuild Plugin:**
```bash
touch plugins/automap/main.go
make plugins-release
# Reload browser to get new plugin
```

**Check Browser Console:**
- Look for `[Automap]` prefixed messages
- Check for `[Plugin]` logs from plugin manager
- Examine toast notifications

## 📊 Test Data Reference

### Rules Map Structure

**Location:** `cmd/browser/data/tilemap-storage.sql` (line 14)

**Properties:**
```json
{
  "props": {
    "tw": "16",
    "th": "16",
    "rule_Negate": "1",   // Tile 1 = invert match
    "rule_Ignore": "2",   // Tile 2 = always match
    "rule_NonEmpty": "3", // Tile 3 = match any non-empty
    "rule_Empty": "4",    // Tile 4 = match empty
    "rule_Other": "5"     // Tile 5 = match tiles not in rule
  },
  "layers": [
    {
      // Layer 0: Input patterns (39 tiles wide, 9 tall)
      "props": {
        "rule_role": "input",
        "rule_target_layer": "#0"
      },
      "width": 39,
      "data": [0,4,0,0,0,4,0,0,0,4,...]
    },
    {
      // Layer 1: Output patterns (39 tiles wide, 9 tall)
      "props": {
        "rule_role": "output",
        "rule_target_layer": "#0"
      },
      "width": 39,
      "data": [0,0,0,0,0,0,0,0,0,0,...]
    }
  ]
}
```

**Pattern Layout:** Multiple 9x9 pattern regions arranged horizontally

### Input Map (new_map)

**Generated by:** `minimap` plugin from `progression` tree
**Typical Size:** Variable (depends on tree generation parameters)
**Content:** Procedurally generated tilemap from world graph

### Output Map (automap_result)

**Created by:** `automap` plugin
**Initial State:** Empty (or auto-created matching input structure)
**Final State:** Transformed according to rules

## 🚀 Development Workflow

### Making Changes

1. **Edit Source Files:**
   ```bash
   # Make changes to *.go files
   vim plugins/automap/matcher.go
   ```

2. **Rebuild Plugin:**
   ```bash
   touch plugins/automap/main.go
   make plugins-release
   ```

3. **Reload Browser:**
   - Press `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux)
   - Plugin manager will load new WASM file

4. **Test Changes:**
   - Use Pipeline view to test
   - Check console for errors
   - Verify toast notifications

### Adding New Test Data

**Option A: Edit SQL File**
```bash
# Edit tilemap-storage.sql
vim cmd/browser/data/tilemap-storage.sql

# Add new INSERT statement
INSERT INTO tilemap_storage (name, data) VALUES
(
  'test_rules',
  '{"props":{...},"layers":[...]}'
);

# Reload browser to restore database
```

**Option B: Runtime Creation**
```javascript
// In browser console
const testMap = {
  props: { tw: "16", th: "16" },
  layers: [{ width: 3, data: [1,1,0,1,0,0,0,0,0], props: {} }]
}

await pluginManager.call("sql", "exec",
  `INSERT OR REPLACE INTO tilemap_storage (name, data) 
   VALUES ('test_map', '${JSON.stringify(testMap).replace(/'/g, "''")}')`
)
```

## 🎯 Testing Checklist

### Basic Functionality
- [ ] Plugin loads without errors
- [ ] Can parse rules from SQL storage
- [ ] Can load input/output maps
- [ ] Engine executes without crashes
- [ ] Output map is stored correctly

### CSV Parsing
- [ ] Rules map loads correctly from SQL
- [ ] Input map loads correctly from SQL  
- [ ] Output map auto-creates if missing
- [ ] No quote-escaping errors

### Rules Processing
- [ ] Parser identifies input layers
- [ ] Parser identifies output layers
- [ ] Special tiles are recognized
- [ ] Layer selectors work (`#0`, `[name="..."]`)

### Pattern Matching
- [ ] Patterns are normalized to (0,0)
- [ ] Input patterns match correctly
- [ ] Tile shapes are calculated properly
- [ ] Bounds checking works

### Output Application
- [ ] Output tiles are placed correctly
- [ ] Target layers are resolved
- [ ] Map is stored in SQL after transformation

### Pipeline Integration
- [ ] Auto-trigger works (step 1 → 2 → 3)
- [ ] Toast notifications appear
- [ ] Maps reload in viewers
- [ ] Console logs are informative

## 📝 Notes for Future Development

### Performance Optimization
- Consider caching parsed rules between calls
- Optimize pattern matching for large maps
- Profile memory usage for large tilemaps

### Feature Enhancements
- Add support for rotated/flipped pattern matching
- Implement probability-based tile selection
- Support multiple rule files
- Add rule priority/ordering

### Test Coverage
- Add unit tests for all core functions
- Create integration tests for full pipeline
- Add benchmark tests for large maps
- Test edge cases (empty maps, malformed rules)

## 🔗 Related Documentation

- **User Guide:** `README.md` - How to use the plugin
- **Specification:** `SPEC.md` - Metadata format details
- **Main Project:** `../../AGENTS.md` - Project-wide guidelines
- **Tilemap Package:** `../../pkg/tilemap/README.md` - Core data structures

## 💡 Quick Reference

### Test the Current Rules Map
```bash
# 1. Start server
make browser-run

# 2. Open http://localhost:8080
# 3. Navigate to Pipeline view
# 4. Click "Apply Automap" (auto-triggers all steps)
# 5. Check for success toast: "Automap generated: automap_result"
```

### Inspect Rules Map
```javascript
// Browser console
const result = await pluginManager.call("sql", "query",
  "SELECT substr(data, 1, 500) as preview FROM tilemap_storage WHERE name = 'rules'")
console.log(new TextDecoder().decode(result.output))
```

### Manually Trigger Automap
```javascript
// Browser console
const result = await pluginManager.call("automap", "automap", JSON.stringify({
  rulesMapId: "rules",
  inputMapId: "new_map",
  outputMapId: "test_output"
}))
const response = JSON.parse(new TextDecoder().decode(result.output))
console.log(response)
```

---

**Last Updated:** December 13, 2024
**Plugin Version:** v1.0 (CSV parsing fix + auto output creation)
**Test Status:** ✅ Browser pipeline working, ⏳ Unit tests needed
