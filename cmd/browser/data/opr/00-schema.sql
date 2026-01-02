-- OPR (One Page Rules) Database Schema
-- Supports multiple game universes (Grimdark Future, Age of Fantasy, etc.)
-- Normalized relational structure for armies, units, weapons, special rules, and upgrades

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
    id TEXT PRIMARY KEY,              -- 'gf-battle-brothers'
    universe_id TEXT NOT NULL,        -- 'grimdark-future'
    name TEXT NOT NULL,               -- 'Battle Brothers'
    background TEXT,                  -- Lore/description
    color_primary TEXT,               -- Hex color for UI theming
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- UNITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_units (
    id TEXT PRIMARY KEY,              -- 'gf-bb-infantry'
    army_id TEXT NOT NULL,
    name TEXT NOT NULL,               -- 'Infantry Squad'
    size INTEGER,                     -- Number of models (e.g., 5)
    cost INTEGER NOT NULL,            -- Points cost
    quality INTEGER,                  -- Quality stat (e.g., 4 for 4+)
    defense INTEGER,                  -- Defense stat (e.g., 4 for 4+)
    unit_type TEXT,                   -- 'Infantry', 'Vehicle', 'Hero', 'Monster'
    notes TEXT,                       -- Additional information
    FOREIGN KEY (army_id) REFERENCES opr_armies(id)
);

-- ============================================================================
-- SPECIAL RULES (Abilities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_special_rules (
    id TEXT PRIMARY KEY,              -- 'tough', 'fearless', 'gf-space-marine-tactics'
    name TEXT NOT NULL,               -- 'Tough'
    description TEXT,                 -- Rule description
    category TEXT,                    -- 'universal', 'grimdark-future', 'age-of-fantasy'
    is_stackable BOOLEAN DEFAULT 0,   -- Can have rating like Tough(3)?
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
    id TEXT PRIMARY KEY,              -- 'ccw', 'gf-plasma-rifle'
    name TEXT NOT NULL,               -- 'CCW', 'Plasma Rifle'
    range INTEGER,                    -- Range in inches, NULL for melee
    attacks TEXT,                     -- 'A1', '2', 'A2' (can be formula)
    ap INTEGER DEFAULT 0,             -- Armor Penetration
    special TEXT,                     -- 'Rending,Blast(3)' (comma-separated)
    category TEXT,                    -- 'universal', 'grimdark-future', etc.
    universe_id TEXT,                 -- NULL for universal, or specific universe
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- UNIT ← → WEAPONS (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_unit_weapons (
    unit_id TEXT,
    weapon_id TEXT,
    count INTEGER DEFAULT 1,          -- How many models equipped
    is_default BOOLEAN DEFAULT 1,     -- Part of base loadout
    PRIMARY KEY (unit_id, weapon_id, is_default),
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (weapon_id) REFERENCES opr_weapons(id)
);

-- ============================================================================
-- UPGRADES (Equipment/Ability modifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_upgrades (
    id TEXT PRIMARY KEY,              -- 'gf-bb-inf-plasma-upgrade'
    unit_id TEXT NOT NULL,
    upgrade_type TEXT,                -- 'replace-weapon', 'add-weapon', 'add-rule', 'special'
    name TEXT NOT NULL,               -- 'Replace 1x Rifle with Plasma Rifle'
    cost INTEGER NOT NULL,            -- Points cost (can be negative)
    description TEXT,
    FOREIGN KEY (unit_id) REFERENCES opr_units(id)
);
