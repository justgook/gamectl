# OPR Database Queries Reference

This document provides example SQL queries for the OPR Unit Builder schema.

## Core Queries for Unit Builder UI

### 1. Get All Data for Unit Editor

When user selects a unit, you need to load all its data to render the configuration form.

#### Base Unit Info
```sql
SELECT 
    u.*,
    bs.shape as base_shape,
    bs.dimensions as base_dimensions
FROM opr_units u
LEFT JOIN opr_base_sizes bs ON u.base_size_id = bs.id
WHERE u.id = 'gf-battle-brothers-veteran-warrior-hero';
```

#### Default Equipment with Full Details
```sql
SELECT 
    e.id,
    e.name,
    e.type,
    e.range,
    e.attacks,
    ue.count,
    GROUP_CONCAT(
        CASE 
            WHEN esr.rating > 0 
            THEN sr.name || '(' || esr.rating || ')'
            ELSE sr.name
        END,
        ', '
    ) as special_rules
FROM opr_unit_equipment ue
JOIN opr_equipment e ON ue.equipment_id = e.id
LEFT JOIN opr_equipment_special_rules esr ON e.id = esr.equipment_id
LEFT JOIN opr_special_rules sr ON esr.special_rule_id = sr.id
WHERE ue.unit_id = 'gf-battle-brothers-veteran-warrior-hero'
GROUP BY e.id, e.name, e.type, e.range, e.attacks, ue.count;
```

#### Equipment That Grants Other Equipment
For items like Combat Shield that grants Bash weapon:
```sql
SELECT 
    eg.parent_equipment_id,
    parent.name as parent_name,
    granted.id as granted_id,
    granted.name as granted_name,
    granted.type as granted_type,
    granted.range as granted_range,
    granted.attacks as granted_attacks,
    eg.count
FROM opr_equipment_grants eg
JOIN opr_equipment parent ON eg.parent_equipment_id = parent.id
JOIN opr_equipment granted ON eg.granted_equipment_id = granted.id
WHERE eg.parent_equipment_id IN (
    SELECT equipment_id 
    FROM opr_unit_equipment 
    WHERE unit_id = 'gf-battle-brothers-veteran-warrior-hero'
);
```

#### Unit Special Rules
```sql
SELECT 
    sr.id,
    sr.name,
    sr.description,
    usr.rating
FROM opr_unit_special_rules usr
JOIN opr_special_rules sr ON usr.special_rule_id = sr.id
WHERE usr.unit_id = 'gf-battle-brothers-veteran-warrior-hero'
ORDER BY sr.name;
```

#### Upgrade Groups
```sql
SELECT 
    ug.id,
    ug.label,
    ug.select_min,
    ug.select_max,
    ug.affects,
    ug.affects_count,
    ug.sort_order,
    GROUP_CONCAT(DISTINCT e_replace.name, ', ') as replaces_equipment_names
FROM opr_upgrade_groups ug
LEFT JOIN opr_upgrade_group_replaces ugr ON ug.id = ugr.group_id
LEFT JOIN opr_equipment e_replace ON ugr.equipment_id = e_replace.id
WHERE ug.unit_id = 'gf-battle-brothers-veteran-warrior-hero'
GROUP BY ug.id
ORDER BY ug.sort_order;
```

#### Upgrade Options for a Group
```sql
SELECT 
    uo.id,
    uo.equipment_id,
    uo.cost,
    uo.overrides_base_size_id,
    uo.sort_order,
    e.name,
    e.type,
    e.range,
    e.attacks,
    bs.shape as new_base_shape,
    bs.dimensions as new_base_dimensions,
    GROUP_CONCAT(
        CASE 
            WHEN esr.rating > 0 
            THEN sr.name || '(' || esr.rating || ')'
            ELSE sr.name
        END,
        ', '
    ) as special_rules
FROM opr_upgrade_options uo
JOIN opr_equipment e ON uo.equipment_id = e.id
LEFT JOIN opr_base_sizes bs ON uo.overrides_base_size_id = bs.id
LEFT JOIN opr_equipment_special_rules esr ON e.id = esr.equipment_id
LEFT JOIN opr_special_rules sr ON esr.special_rule_id = sr.id
WHERE uo.group_id = 'gf-battle-brothers-veteran-warrior-hero-grp-1'
GROUP BY uo.id
ORDER BY uo.sort_order;
```

## Browsing Queries

### List All Universes
```sql
SELECT id, name, version 
FROM opr_universes 
ORDER BY name;
```

### List Armies in a Universe
```sql
SELECT id, name, version 
FROM opr_armies 
WHERE universe_id = 'grimdark-future' 
ORDER BY name;
```

### List Units in an Army
```sql
SELECT 
    id, 
    name, 
    size,
    cost, 
    quality,
    defense,
    unit_type
FROM opr_units 
WHERE army_id = 'gf-battle-brothers' 
ORDER BY cost, name;
```

### Search Units by Name
```sql
SELECT 
    u.id,
    u.name,
    u.cost,
    u.unit_type,
    a.name as army_name
FROM opr_units u
JOIN opr_armies a ON u.army_id = a.id
WHERE u.name LIKE '%Lord%'
ORDER BY u.cost;
```

## Special Rule Lookups

### Get Special Rule by Name (for tooltips)
```sql
SELECT id, name, description 
FROM opr_special_rules 
WHERE name = 'Tough' 
  AND (army_id IS NULL OR army_id = 'gf-battle-brothers')
LIMIT 1;
```

### Get All Special Rules for Army (for caching)
```sql
SELECT id, name, description 
FROM opr_special_rules 
WHERE army_id = 'gf-battle-brothers' OR army_id IS NULL
ORDER BY name;
```

## Equipment Queries

### Find Equipment by Name in Army
```sql
SELECT 
    id, 
    name, 
    type, 
    range, 
    attacks 
FROM opr_equipment 
WHERE army_id = 'gf-battle-brothers' 
  AND name = 'CCW';
```

### Get All Equipment Special Rules
```sql
SELECT 
    e.id,
    e.name,
    sr.name as rule_name,
    sr.description as rule_description,
    esr.rating
FROM opr_equipment e
JOIN opr_equipment_special_rules esr ON e.id = esr.equipment_id
JOIN opr_special_rules sr ON esr.special_rule_id = sr.id
WHERE e.id = 'gf-battle-brothers-heavy-rifle';
```

## Unit Building (for save/load army lists)

### Save Unit Configuration
When user builds a unit, you'll want to save:
1. Base unit ID
2. Selected upgrade option IDs
3. Total cost

This would go into a separate "army list" schema (not covered here, but you mentioned this is the next step).

### Calculate Unit Cost with Upgrades
```sql
-- Base cost
SELECT cost FROM opr_units WHERE id = 'unit-id';

-- Add upgrade costs
SELECT SUM(cost) 
FROM opr_upgrade_options 
WHERE id IN ('opt-1', 'opt-2', 'opt-3');
```

## Performance Indexes

The schema includes these indexes for fast queries:
- `idx_armies_universe` - Fast army filtering by universe
- `idx_units_army` - Fast unit filtering by army
- `idx_equipment_army` - Fast equipment filtering by army
- `idx_special_rules_army` - Fast special rule lookups
- `idx_upgrade_groups_unit` - Fast upgrade group loading
- `idx_upgrade_options_group` - Fast option loading

## Common Patterns

### Load Unit with Everything
For the main unit builder view, you'll typically run these queries in parallel:
1. Base unit info
2. Default equipment
3. Equipment grants (for items with weapons)
4. Unit special rules
5. Upgrade groups
6. For each upgrade group: upgrade options

### Tooltip Data
Cache all special rules on page load for instant tooltips:
```sql
SELECT id, name, description 
FROM opr_special_rules 
WHERE army_id IN (SELECT id FROM opr_armies WHERE universe_id = 'grimdark-future')
   OR army_id IS NULL;
```

### Replacement Logic
When user selects an upgrade:
1. Check `opr_upgrade_group_replaces` to see what equipment it replaces
2. Remove that equipment from the unit's loadout
3. Add the new equipment from `opr_upgrade_options.equipment_id`
4. If `overrides_base_size_id` is set, update the unit's base size

### Cost Calculation
```javascript
// Pseudocode for cost calculation
totalCost = unit.base_cost
for (selectedOptionId of selectedOptions) {
  const option = getUpgradeOption(selectedOptionId)
  totalCost += option.cost
}
```

## Notes

1. **Equipment vs Weapons**: Everything is equipment now. Filter by `type` if you need just weapons or items.

2. **Special Rule Ratings**: Rating of 0 means no rating (e.g., "Fearless"). Rating > 0 means display as "RuleName(rating)" (e.g., "Tough(3)").

3. **Base Size Changes**: Check `overrides_base_size_id` in upgrade options to handle bikes/mounts that change model dimensions.

4. **Equipment Grants**: Items can grant weapons (Combat Shield grants Bash). Always check `opr_equipment_grants` when displaying equipment.

5. **Army Scoping**: Equipment is army-scoped, so "CCW" in Battle Brothers is different from "CCW" in Alien Hives (different IDs).
