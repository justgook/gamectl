# OPR Database Structure

This directory contains SQL data files for One Page Rules game systems (Grimdark Future, Age of Fantasy, etc.).

## File Organization

Files are loaded in numerical order:

### Core Schema (00-09)
- `00-schema.sql` - Table definitions for all OPR data
- `01-universes.sql` - Game systems (GF, AoF, etc.)
- `02-special-rules-universal.sql` - Rules shared across all games
- `03-weapons-common.sql` - Common weapons (CCW, Rifle, etc.)

### Grimdark Future (10-19)
- `10-gf-armies.sql` - GF factions
- `11-gf-special-rules.sql` - GF-specific rules
- `12-gf-weapons.sql` - Sci-fi weapons
- `13-gf-units-battle-brothers.sql` - Battle Brothers units (fully detailed)
- `14-gf-units-alien-hives.sql` - Alien Hives units (fully detailed)

### Age of Fantasy (20-29) - Future
- `20-aof-armies.sql`
- `21-aof-special-rules.sql`
- etc.

## Database Schema

### Core Tables

**opr_universes** - Game systems
- `id` - 'grimdark-future', 'age-of-fantasy'
- `name` - Display name
- `version` - Current version

**opr_armies** - Factions/armies
- `id` - Unique identifier (e.g., 'gf-battle-brothers')
- `universe_id` - Links to universe
- `name` - Army name
- `background` - Lore text
- `color_primary` - UI theme color

**opr_units** - Individual unit types
- `id` - Unique identifier
- `army_id` - Links to army
- `name`, `size`, `cost`, `quality`, `defense`
- `unit_type` - 'Infantry', 'Vehicle', 'Hero', 'Monster'

**opr_special_rules** - Abilities
- `id` - Unique identifier
- `name`, `description`
- `category` - 'universal', universe-specific
- `is_stackable` - Can have rating (e.g., Tough(3))

**opr_weapons** - Weapons
- `id` - Unique identifier
- `name`, `range`, `attacks`, `ap`, `special`
- `category` - 'universal', universe-specific

**opr_upgrades** - Unit modifications
- `id` - Unique identifier
- `unit_id` - Links to unit
- `name`, `cost`, `description`
- `upgrade_type` - 'replace-weapon', 'add-weapon', 'add-rule'

### Junction Tables

**opr_unit_weapons** - Unit ↔ Weapon mapping
**opr_unit_special_rules** - Unit ↔ Special Rule mapping

## Adding New Data

### Adding a New Army

1. Create file: `1X-gf-units-army-name.sql` (where X is next number)
2. Follow this pattern:

```sql
-- Clean up
DELETE FROM opr_upgrades WHERE unit_id LIKE 'gf-XX-%';
DELETE FROM opr_unit_weapons WHERE unit_id LIKE 'gf-XX-%';
DELETE FROM opr_unit_special_rules WHERE unit_id LIKE 'gf-XX-%';
DELETE FROM opr_units WHERE army_id = 'gf-army-id';

-- Add army to 10-gf-armies.sql
INSERT INTO opr_armies VALUES ('gf-army-id', 'grimdark-future', 'Army Name', 'Lore...', '#color');

-- Add units
INSERT INTO opr_units VALUES ('gf-XX-unit1', 'gf-army-id', 'Unit Name', 5, 100, 4, 4, 'Infantry', NULL);

-- Add weapons
INSERT INTO opr_unit_weapons VALUES ('gf-XX-unit1', 'ccw', 5, 1);

-- Add special rules
INSERT INTO opr_unit_special_rules VALUES ('gf-XX-unit1', 'fearless', NULL);

-- Add upgrades
INSERT INTO opr_upgrades VALUES ('gf-XX-unit1-upgrade1', 'gf-XX-unit1', 'add-weapon', 'Name', 10, 'Description');
```

3. Update `app.js` to load the new file

### ID Naming Convention

- Universes: `grimdark-future`, `age-of-fantasy`
- Armies: `{universe-prefix}-{army-short-name}` → `gf-battle-brothers`
- Units: `{army-id}-{unit-short-name}` → `gf-bb-infantry`
- Rules (universal): `{rule-name}` → `fearless`
- Rules (universe): `{universe-prefix}-{rule-name}` → `gf-hero`
- Weapons (universal): `{weapon-name}` → `ccw`
- Weapons (universe): `{universe-prefix}-{weapon-name}` → `gf-plasma-rifle`

## Useful Queries

```sql
-- Get all armies in a universe
SELECT * FROM opr_armies WHERE universe_id = 'grimdark-future';

-- Get unit with all details
SELECT u.*, 
  GROUP_CONCAT(DISTINCT sr.name) as rules,
  GROUP_CONCAT(DISTINCT w.name) as weapons
FROM opr_units u
LEFT JOIN opr_unit_special_rules usr ON u.id = usr.unit_id
LEFT JOIN opr_special_rules sr ON usr.special_rule_id = sr.id
LEFT JOIN opr_unit_weapons uw ON u.id = uw.unit_id
LEFT JOIN opr_weapons w ON uw.weapon_id = w.id
WHERE u.id = 'gf-bb-infantry'
GROUP BY u.id;

-- Random unit from army
SELECT * FROM opr_units 
WHERE army_id = 'gf-battle-brothers' 
ORDER BY RANDOM() 
LIMIT 1;
```

## Current Status

**Fully Implemented:**
- Battle Brothers (5 units)
- Alien Hives (5 units)

**Skeleton/Placeholder:**
- Robot Legions (army registered, no units)

**Future:**
- More Grimdark Future armies
- Age of Fantasy system
- Detailed upgrade modeling
