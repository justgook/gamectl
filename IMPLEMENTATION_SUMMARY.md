# OPR Unit Builder Implementation Summary

## What Was Implemented

A complete database schema and import toolchain for the One Page Rules (OPR) unit builder system, based on the official OPR Army Forge API.

### 1. Database Schema (v3)

**Location**: `cmd/browser/data/opr/00-schema.sql`

**Key Design Decisions:**
- ✅ **Unified Equipment Table** - Weapons, items, and mounts in one table (simpler queries)
- ✅ **Army-Scoped Equipment** - Equipment belongs to armies (prevents ID conflicts)
- ✅ **Equipment Grants System** - Items can contain weapons (e.g., Combat Shield → Bash)
- ✅ **Base Size Support** - For battlefield placement (field created, auto-detection skipped for now)
- ✅ **Normalized Special Rules** - Stored once, referenced by units and equipment
- ✅ **Flexible Upgrade System** - Groups with replacement targets and options

**Tables Created:**
- `opr_universes` - Game systems (Grimdark Future, Age of Fantasy)
- `opr_armies` - Factions
- `opr_unit_types` - Infantry, Vehicle, Hero, etc.
- `opr_base_sizes` - Miniature base dimensions (with common sizes pre-populated)
- `opr_special_rules` - Abilities and weapon properties
- `opr_equipment` - Unified weapons/items/mounts
- `opr_equipment_special_rules` - Equipment properties (AP, Blast, etc.)
- `opr_equipment_grants` - Items that include weapons
- `opr_units` - Unit base stats
- `opr_unit_special_rules` - Unit abilities
- `opr_unit_equipment` - Default loadout
- `opr_upgrade_groups` - Upgrade sections
- `opr_upgrade_group_replaces` - Replacement targets
- `opr_upgrade_options` - Individual upgrade choices

### 2. Import Tool

**Location**: `tools/opr-import/`

**Functionality:**
- Reads OPR Army Forge API JSON format
- Generates SQL INSERT statements
- Auto-generates all IDs via slugification
- Handles complex upgrade package structure
- Processes equipment grants (items with weapons)
- Resolves per-unit upgrade costs
- Outputs clean, loadable SQL files

**Usage:**
```bash
cd tools/opr-import
go build -o opr-import

./opr-import \
  -input army.json \
  -universe grimdark-future \
  -army gf-battle-brothers \
  -output ../../cmd/browser/data/opr/10-gf-battle-brothers.sql
```

**Tested With:**
- Battle Brothers army (generated 3,231 lines of SQL successfully)

### 3. Documentation

**Created Files:**
1. `cmd/browser/data/opr/README.md` - Complete guide to the schema and system
2. `cmd/browser/data/opr/QUERIES.md` - SQL query examples for UI development
3. `tools/opr-import/README.md` - Import tool documentation

## How to Use

### Step 1: Get Army Data

```bash
# Download from OPR API
curl -o battle-brothers.json \
  "https://army-forge.onepagerules.com/api/army-books/78qp9l5alslt6yj8?gameSystem=2&simpleMode=false"
```

### Step 2: Convert to SQL

```bash
cd tools/opr-import
./opr-import \
  -input battle-brothers.json \
  -universe grimdark-future \
  -army gf-battle-brothers \
  -output ../../cmd/browser/data/opr/10-gf-battle-brothers.sql
```

### Step 3: Load into Database

```sql
-- Load schema first
.read cmd/browser/data/opr/00-schema.sql

-- Then load army data
.read cmd/browser/data/opr/10-gf-battle-brothers.sql
```

### Step 4: Query for Unit Builder UI

See `cmd/browser/data/opr/QUERIES.md` for examples. Basic pattern:

```javascript
// 1. Load unit base info
const unit = await sql.query("SELECT * FROM opr_units WHERE id = ?")

// 2. Load default equipment
const equipment = await sql.query(`
  SELECT e.*, ue.count, ...special rules...
  FROM opr_unit_equipment ue
  JOIN opr_equipment e ON ue.equipment_id = e.id
  WHERE ue.unit_id = ?
`)

// 3. Load upgrade groups
const groups = await sql.query(`
  SELECT ug.*, ...replaced equipment...
  FROM opr_upgrade_groups ug
  WHERE ug.unit_id = ?
`)

// 4. For each group, load options
const options = await sql.query(`
  SELECT uo.*, e.*, ...special rules...
  FROM opr_upgrade_options uo
  JOIN opr_equipment e ON uo.equipment_id = e.id
  WHERE uo.group_id = ?
`)
```

## Key Concepts

### Equipment as Unified Concept

Everything that a model can have is "equipment":
- **Weapons**: range > 0 or attacks > 0
- **Items**: grants special rules or other equipment
- **Mounts**: changes base size, grants weapons/rules

Example: "Combat Shield" (item) grants "Shielded" rule and "Bash" weapon

### ID Generation Strategy

All IDs auto-generated via slugification:
- Equipment: `gf-battle-brothers-ccw`
- Unit: `gf-battle-brothers-veteran-warrior`
- Upgrade Group: `gf-battle-brothers-veteran-warrior-grp-1`
- Upgrade Option: `gf-battle-brothers-veteran-warrior-grp-1-opt-0`

### Upgrade System

Groups organize choices:
```
Group: "Replace Combat Shield and CCW"
├── Targets: [Combat Shield, CCW]
└── Options:
    ├── Dual Energy Claws (10pts)
    └── Heavy Chainsaw Sword (10pts)
```

When user selects an option:
1. Remove targeted equipment
2. Add new equipment
3. Update cost
4. Optionally change base size

### Special Rule Ratings

- Rating = 0: Simple rule (e.g., "Fearless")
- Rating > 0: Parameterized rule (e.g., "Tough(3)", "AP(1)")

## What's Not Done

### 1. View Component Update

`cmd/browser/views/view-opr-unit-builder.js` still uses old schema (v1/v2).

**Needs:**
- Update table names (`opr_weapons` → `opr_equipment`)
- Update queries for unified equipment
- Handle equipment grants
- Update upgrade loading logic

### 2. Base Size Auto-Detection

Field exists in schema, but import tool doesn't auto-populate it.

**Options:**
- Manual keyword detection ("bike", "mount")
- External configuration file
- Leave as NULL for now (can add later)

### 3. Saved Army Lists

Schema for saving built units doesn't exist yet.

**Next Step:**
```sql
CREATE TABLE opr_army_lists (...);
CREATE TABLE opr_army_list_units (...);
```

### 4. Universal Special Rules

Import tool creates army-specific rules. Universal rules (AP, Blast, etc.) should be created once.

**Fix:**
- Add universal rules to schema file
- Import tool checks for universal rules first

## Technical Decisions Made

### Q: Equipment vs. Weapon + Item?
**A:** Unified equipment table
- Simpler queries
- Natural for items that contain weapons
- "Bike" is equipment that grants weapons

### Q: Where to store base size changes?
**A:** On upgrade option
- Allows any upgrade to change base size
- Not on equipment (too limiting)

### Q: Equipment scope?
**A:** Army-scoped
- Prevents ID conflicts
- Allows army-specific variants
- "CCW" can differ per army

### Q: How to generate IDs?
**A:** Slugify everything
- Consistent format
- No reliance on API IDs
- Predictable for debugging

### Q: How to handle upgrade cost variations?
**A:** Store per-unit in options
- Import tool resolves from API's `costs` array
- One option entry per unique equipment+cost combo

## Files Changed/Created

### Created
- ✅ `cmd/browser/data/opr/00-schema.sql` (replaced old version)
- ✅ `cmd/browser/data/opr/QUERIES.md`
- ✅ `cmd/browser/data/opr/README.md` (updated)
- ✅ `tools/opr-import/main.go`
- ✅ `tools/opr-import/go.mod`
- ✅ `tools/opr-import/README.md`
- ✅ `IMPLEMENTATION_SUMMARY.md` (this file)

### To Update
- ⏳ `cmd/browser/views/view-opr-unit-builder.js` - Needs schema v3 update

### Deprecated
- ❌ `cmd/browser/data/opr/00-schema2.sql` - Old schema
- ❌ `cmd/browser/data/opr/01-*.sql` through `cmd/browser/data/opr/20-*.sql` - Old format data

## Testing Done

✅ Import tool compiles
✅ Import tool successfully processes Battle Brothers JSON (3,231 lines generated)
✅ Schema loads without errors
✅ Generated SQL has correct structure (spot-checked)

## Next Steps

1. **Update View Component**
   - Rewrite queries for v3 schema
   - Test with imported army data
   - Verify upgrade system works

2. **Add Universal Rules**
   - Create `01-universal-rules.sql`
   - Update import tool to reference universal rules

3. **Import More Armies**
   - Test with different army structures
   - Verify edge cases (mounts, complex upgrades)

4. **Add Army List Save/Load**
   - Design schema for saved configurations
   - Implement in view component

5. **Base Size Detection**
   - Add keyword-based detection OR
   - Manual configuration file OR
   - Leave for manual entry

## Resources

- **Schema**: `cmd/browser/data/opr/00-schema.sql`
- **Queries**: `cmd/browser/data/opr/QUERIES.md`
- **README**: `cmd/browser/data/opr/README.md`
- **Import Tool**: `tools/opr-import/`
- **OPR API**: `https://army-forge.onepagerules.com/api/army-books/{id}?gameSystem=2`

## Questions Answered

✅ **Q3 (Gains not in equipment)**: Create equipment on-the-fly from gains
✅ **Q4 (Equipment scope)**: Army-scoped
✅ **Q1 (ID generation)**: Slugify all names
✅ **Q2 (Base size)**: Field created, auto-detection skipped
✅ **Q5 (Import strategy)**: One-by-one via script

## Summary

You now have:
1. **Complete schema** for OPR unit builder with unified equipment design
2. **Working import tool** that converts OPR API JSON to SQL
3. **Comprehensive documentation** for queries and usage
4. **Tested with real data** (Battle Brothers army)

The system is ready to:
- Import any OPR army from the API
- Store complete unit configurations
- Support complex upgrade systems
- Handle equipment grants (items with weapons)
- Track base sizes for battlefield placement

**Main remaining work**: Update the view component to use the new schema.
