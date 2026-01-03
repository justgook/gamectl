-- OPR (One Page Rules) Database Schema v2
-- Supports multiple game universes (Grimdark Future, Age of Fantasy, etc.)
-- Fully normalized structure for armies, units, weapons, special rules, and upgrades

-- ============================================================================
-- META: Game Universes/Systems
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_universes (
    id TEXT PRIMARY KEY,              -- 'grimdark-future', 'age-of-fantasy'
    name TEXT NOT NULL,               -- 'Grimdark Future'
    short_name TEXT,                  -- 'GF'
    version TEXT,                     -- 'v3.5.1'
    description TEXT
);

-- ============================================================================
-- ARMIES/FACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_armies (
    id TEXT PRIMARY KEY,              -- 'gf-alien-hives'
    universe_id TEXT NOT NULL,        -- 'grimdark-future'
    name TEXT NOT NULL,               -- 'Alien Hives'
    version TEXT,                     -- 'v3.5.1' (army book version)
    background TEXT,                  -- Lore/description
    color_primary TEXT,               -- Hex color for UI theming
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- UNITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_units (
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord'
    army_id TEXT NOT NULL,
    name TEXT NOT NULL,               -- 'Hive Lord'
    size INTEGER,                     -- Number of models (e.g., 1)
    cost INTEGER NOT NULL,            -- Base points cost
    quality INTEGER,                  -- Quality stat (e.g., 3 for 3+)
    defense INTEGER,                  -- Defense stat (e.g., 2 for 2+)
    tough INTEGER,                    -- Toughness value (NULL if not tough)
    unit_type TEXT,                   -- 'Infantry', 'Vehicle', 'Hero', 'Monster'
    notes TEXT,                       -- Additional information
    FOREIGN KEY (army_id) REFERENCES opr_armies(id)
);

-- ============================================================================
-- SPECIAL RULES (Abilities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_special_rules (
    id TEXT PRIMARY KEY,              -- 'tough', 'fearless', 'hive-bond', 'blast'
    name TEXT NOT NULL,               -- 'Tough', 'Fearless', 'Hive Bond', 'Blast'
    description TEXT,                 -- Rule description
    category TEXT,                    -- 'universal', 'army-wide', 'weapon-special'
    is_stackable BOOLEAN DEFAULT 0,   -- Can have rating like Tough(3) or Blast(3)?
    universe_id TEXT,                 -- NULL for universal rules, or specific universe
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- UNIT ← → SPECIAL RULES (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_unit_special_rules (
    unit_id TEXT,
    special_rule_id TEXT,
    rating TEXT,                      -- For 'Tough(3)' store '3', for 'Fearless' store NULL
    PRIMARY KEY (unit_id, special_rule_id),
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules(id)
);

-- ============================================================================
-- WEAPONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_weapons (
    id TEXT PRIMARY KEY,              -- 'razor-claws', 'shredder-cannon'
    name TEXT NOT NULL,               -- 'Razor Claws', 'Shredder Cannon'
    range INTEGER,                    -- Range in inches, NULL for melee
    attacks TEXT,                     -- 'A1', 'A2', 'A3', etc.
    ap INTEGER DEFAULT 0,             -- Armor Penetration
    category TEXT,                    -- 'universal', 'grimdark-future', 'alien-hives'
    universe_id TEXT,                 -- NULL for universal, or specific universe
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- WEAPON ← → SPECIAL RULES (Many-to-Many)
-- Normalized junction table for weapon special rules like "Rending", "Blast(3)"
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_weapon_special_rules (
    weapon_id TEXT,
    special_rule_id TEXT,             -- References opr_special_rules
    rating TEXT,                      -- For 'Blast(3)' store '3', for 'Rending' store NULL
    PRIMARY KEY (weapon_id, special_rule_id),
    FOREIGN KEY (weapon_id) REFERENCES opr_weapons(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules(id)
);

-- ============================================================================
-- UNIT ← → WEAPONS (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_unit_weapons (
    unit_id TEXT,
    weapon_id TEXT,
    count INTEGER DEFAULT 1,          -- How many models/weapons equipped
    is_default BOOLEAN DEFAULT 1,     -- Part of base loadout
    PRIMARY KEY (unit_id, weapon_id, is_default),
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (weapon_id) REFERENCES opr_weapons(id)
);

-- ============================================================================
-- UPGRADE GROUPS
-- Represents grouped upgrade choices like "Upgrade with one" or "Replace X"
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_upgrade_groups (
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord-upgrade-1'
    unit_id TEXT NOT NULL,
    label TEXT NOT NULL,              -- 'Upgrade with one', 'Replace Shredder Cannon'
    selection_type TEXT NOT NULL,     -- 'pick-one', 'pick-any', 'replace-weapon'
    min_selections INTEGER DEFAULT 0, -- Minimum required selections
    max_selections INTEGER DEFAULT 1, -- Maximum allowed selections
    applies_to TEXT,                  -- 'one-model', 'all-models', 'any-model', 'up-to-X-models'
    applies_count INTEGER,            -- NULL or number for "up to X models"
    sort_order INTEGER DEFAULT 0,     -- Display order
    FOREIGN KEY (unit_id) REFERENCES opr_units(id)
);

-- ============================================================================
-- UPGRADES (Equipment/Ability modifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_upgrades (
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord-pheromone-host'
    unit_id TEXT NOT NULL,
    group_id TEXT,                    -- Links to upgrade group (NULL if standalone)
    upgrade_type TEXT NOT NULL,       -- 'add-rule', 'replace-weapon', 'add-weapon', 'replace-attacks'
    name TEXT NOT NULL,               -- 'Pheromone Host (Hive Bond Boost Aura)'
    cost INTEGER NOT NULL,            -- Points cost (can be negative)
    description TEXT,                 -- Full description text
    
    -- What this upgrade affects (one of these will be set)
    replaces_weapon_id TEXT,          -- Weapon being replaced
    adds_weapon_id TEXT,              -- Weapon being added
    adds_special_rule_id TEXT,        -- Special rule being added
    adds_special_rule_rating TEXT,    -- Rating for the special rule (if stackable)
    modifies_stat TEXT,               -- 'quality', 'defense', 'attacks', etc.
    modifies_value TEXT,              -- New value or modifier
    
    sort_order INTEGER DEFAULT 0,     -- Display order within group
    
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (group_id) REFERENCES opr_upgrade_groups(id),
    FOREIGN KEY (replaces_weapon_id) REFERENCES opr_weapons(id),
    FOREIGN KEY (adds_weapon_id) REFERENCES opr_weapons(id),
    FOREIGN KEY (adds_special_rule_id) REFERENCES opr_special_rules(id)
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_armies_universe ON opr_armies(universe_id);
CREATE INDEX IF NOT EXISTS idx_units_army ON opr_units(army_id);
CREATE INDEX IF NOT EXISTS idx_unit_special_rules_unit ON opr_unit_special_rules(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_weapons_unit ON opr_unit_weapons(unit_id);
CREATE INDEX IF NOT EXISTS idx_weapon_special_rules_weapon ON opr_weapon_special_rules(weapon_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_groups_unit ON opr_upgrade_groups(unit_id);
CREATE INDEX IF NOT EXISTS idx_upgrades_unit ON opr_upgrades(unit_id);
CREATE INDEX IF NOT EXISTS idx_upgrades_group ON opr_upgrades(group_id);
