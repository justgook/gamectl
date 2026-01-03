# OPR Unit Builder Database

This directory contains the schema and data for the One Page Rules (OPR) unit builder system.

## Quick Start

### 1. Initialize the Database

The schema is in `00-schema.sql` and should be loaded first:

```sql
-- Load the schema
.read cmd/browser/data/opr/00-schema.sql
```

### 2. Import an Army

Download an army from the OPR API and convert it to SQL:

```bash
# Download army JSON
curl -o battle-brothers.json \
  "https://army-forge.onepagerules.com/api/army-books/78qp9l5alslt6yj8?gameSystem=2&simpleMode=false"

# Convert to SQL
cd tools/opr-import
go build -o opr-import
./opr-import \
  -input battle-brothers.json \
  -universe grimdark-future \
  -army gf-battle-brothers \
  -output ../../cmd/browser/data/opr/10-gf-battle-brothers.sql

# Load into database
sqlite3 your-database.db < cmd/browser/data/opr/10-gf-battle-brothers.sql
```

## Schema Overview

### Core Design Principles

1. **Unified Equipment** - Weapons, items, and mounts are all stored in `opr_equipment`
2. **Army-Scoped** - Equipment is scoped to armies (prevents ID conflicts)
3. **Normalized Rules** - Special rules stored once, referenced by units and equipment
4. **Flexible Upgrades** - Upgrade groups with replacement targets and options

### Key Tables

#### Meta Tables
- `opr_universes` - Game systems (Grimdark Future, Age of Fantasy)
- `opr_armies` - Factions/armies within a universe
- `opr_unit_types` - Infantry, Vehicle, Hero, etc.
- `opr_base_sizes` - Miniature base dimensions

#### Game Content
- `opr_special_rules` - Abilities and weapon properties
- `opr_equipment` - Unified table for weapons, items, mounts
- `opr_equipment_special_rules` - Equipment properties (AP, Blast, etc.)
- `opr_equipment_grants` - Items that include weapons (Shield → Bash)

#### Units
- `opr_units` - Unit base stats
- `opr_unit_special_rules` - Unit abilities
- `opr_unit_equipment` - Default loadout

#### Upgrades
- `opr_upgrade_groups` - Upgrade sections (e.g., "Replace CCW")
- `opr_upgrade_group_replaces` - What equipment the group replaces
- `opr_upgrade_options` - Individual upgrade choices
  - Stores equipment ID
  - Cost per unit
  - Optional base size override

### Data Flow

```
API JSON → Import Tool → SQL Inserts → SQLite Database → Unit Builder UI
```

## ID Generation

All IDs are generated via slugification for consistency:

- **Universe**: Manual (e.g., `grimdark-future`)
- **Army**: Manual (e.g., `gf-battle-brothers`)  
- **Equipment**: `{army-id}-{equipment-name}` (e.g., `gf-battle-brothers-ccw`)
- **Unit**: `{army-id}-{unit-name}` (e.g., `gf-battle-brothers-veteran-warrior`)
- **Special Rule**: `{army-id}-{rule-name}` or `universal-{rule-name}`
- **Upgrade Group**: `{unit-id}-grp-{number}` (e.g., `gf-battle-brothers-veteran-warrior-grp-1`)
- **Upgrade Option**: `{group-id}-opt-{number}`

## Common Use Cases

### Building a Unit Configuration Form

See `QUERIES.md` for detailed SQL examples. Basic flow:

1. Load unit base stats
2. Load default equipment with special rules
3. Load equipment grants (items → weapons)
4. Load unit special rules
5. Load upgrade groups
6. For each group, load upgrade options

### Calculating Total Cost

```sql
-- Base cost
SELECT cost FROM opr_units WHERE id = ?;

-- Add upgrade costs
SELECT SUM(cost) FROM opr_upgrade_options WHERE id IN (...);
```

### Handling Equipment Replacement

When user selects an upgrade:
1. Check `opr_upgrade_group_replaces` for replaced equipment
2. Remove that equipment from unit's loadout
3. Add new equipment from `opr_upgrade_options.equipment_id`
4. Update base size if `overrides_base_size_id` is set

### Special Rule Tooltips

Cache all special rules on page load:

```sql
SELECT id, name, description 
FROM opr_special_rules 
WHERE army_id = ? OR army_id IS NULL;
```

Then lookup by ID or name for instant tooltips.

## File Organization

Files are loaded in numerical order:

### Core Schema (00-09)
- `00-schema.sql` - **NEW v3 schema** - Table definitions (load first)
- `00-schema2.sql` - Old schema v2 (deprecated)
- Legacy data files (01-03, 10-14, 20) - **Not compatible with v3**

### Grimdark Future (10-19)
- `10-gf-{army}.sql` - Generated army data using import tool

### Age of Fantasy (20-29)
- `20-aof-{army}.sql` - Generated army data using import tool

### Documentation
- `README.md` - This file
- `QUERIES.md` - SQL query examples for UI development

## Finding Army Book IDs

1. Go to https://army-forge.onepagerules.com
2. Select game system and army
3. Check network tab for API call to `/api/army-books/{id}`
4. Use format: `https://army-forge.onepagerules.com/api/army-books/{id}?gameSystem={1|2}&simpleMode=false`
   - `gameSystem=1` = Age of Fantasy
   - `gameSystem=2` = Grimdark Future

## Tools

### Import Tool

Location: `tools/opr-import/`

```bash
cd tools/opr-import
go build -o opr-import

./opr-import \
  -input <json-file> \
  -universe <universe-id> \
  -army <army-id> \
  -output <sql-file>
```

See `tools/opr-import/README.md` for full documentation.

## View Component

The unit builder UI component is at:
- `cmd/browser/views/view-opr-unit-builder.js`

**Note**: This component currently uses the old schema and needs updating to work with v3.

## Future Enhancements

### Saved Army Lists

Next step is creating a schema for saved unit configurations:

```sql
CREATE TABLE opr_army_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    army_id TEXT NOT NULL,
    points_limit INTEGER,
    created_at INTEGER
);

CREATE TABLE opr_army_list_units (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    selected_upgrades TEXT, -- JSON array of upgrade option IDs
    total_cost INTEGER NOT NULL
);
```

### Battlefield Placement

Integration with your existing minimap/tilemap systems for unit placement.

## Schema Migration

### Changes from v1/v2 to v3

**What Changed:**

1. **Unified Equipment** - Combined `opr_weapons` and items into `opr_equipment`
2. **Removed**: `opr_slots` - Upgrade system is simpler without slot abstraction
3. **Added**: `opr_equipment_grants` - For items that contain weapons
4. **Added**: `opr_base_sizes` - Battlefield placement support
5. **Simplified Upgrades** - Groups + Options instead of complex package hierarchy
6. **Army-Scoped Equipment** - Equipment belongs to armies, not universes

**Migration Path:**

Old data files (01-14, 20) are **not compatible** with v3. To migrate:
1. Download fresh JSON from OPR API
2. Use the import tool to generate new SQL files
3. Load into a fresh database with v3 schema

## Contributing

When adding new armies:
1. Download JSON from OPR API
2. Use import tool to generate SQL
3. Name file as `{number}-{universe}-{army}.sql`
4. Test in SQLite before committing
5. Update this README with army count

## Current Status

**Schema**: v3 (unified equipment design)

**Armies**: Import any army using the tool

**UI**: view-opr-unit-builder.js needs update for v3 schema

## Resources

- **Queries**: See `QUERIES.md` for SQL examples
- **Import Tool**: See `tools/opr-import/README.md`
- **Schema**: See comments in `00-schema.sql`
- **OPR Official**: https://onepagerules.com
- **Army Forge**: https://army-forge.onepagerules.com

## Questions?

Check:
1. `QUERIES.md` - SQL query examples
2. `tools/opr-import/README.md` - Import tool docs
3. Schema comments in `00-schema.sql`
4. OPR Discord/Forums for game rules questions

## License

OPR game data is © One Page Rules. This schema and tooling are for personal use with OPR rules.
