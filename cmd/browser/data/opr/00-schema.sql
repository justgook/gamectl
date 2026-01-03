-- OPR (One Page Rules) Database Schema v2
-- Supports multiple game universes (Grimdark Future, Age of Fantasy, etc.)
-- Fully normalized structure for armies, units, weapons, special rules, and upgrades

-- ============================================================================
-- META: Game Universes/Systems
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_universes (
    id TEXT PRIMARY KEY,              -- 'grimdark-future', 'age-of-fantasy' -- TODO: update to VARCHAR
    name TEXT NOT NULL,               -- 'Grimdark Future'
    short_name TEXT,                  -- 'GF' -- TODO: remove
    version TEXT,                     -- 'v3.5.1'
    description TEXT
);

-- ============================================================================
-- ARMIES/FACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_armies (
    id TEXT PRIMARY KEY,              -- 'gf-alien-hives' -- TODO: update to VARCHAR
    universe_id TEXT NOT NULL,        -- 'grimdark-future' -- TODO: update to VARCHAR
    name TEXT NOT NULL,               -- 'Alien Hives'
    version TEXT,                     -- 'v3.5.1' (army book version) -- TODO: update to VARCHAR
    background TEXT,                  -- Lore/description
    color_primary TEXT,               -- Hex color for UI theming -- TODO: update to VARCHAR
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- UNITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_units (
  -- TODO: add base size (the size of miniature base 2 values width/height dimensions in mm)
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord' -- TODO: update to VARCHAR
    army_id TEXT NOT NULL,            -- TODO: update to VARCHAR
    name TEXT NOT NULL,               -- 'Hive Lord'
    size INTEGER,                     -- Number of models (e.g., 1) -- TODO: make `NOT NULL`
    cost INTEGER NOT NULL,            -- Base points cost
    quality INTEGER,                  -- Quality stat (e.g., 3 for 3+)  -- TODO: make `NOT NULL`
    defense INTEGER,                  -- Defense stat (e.g., 2 for 2+) -- TODO: make `NOT NULL`
    tough INTEGER,                    -- Toughness value (NULL if not tough)
    unit_type TEXT,                   -- 'Infantry', 'Vehicle', 'Hero', 'Monster' -- TODO: make VARCHAR and FOREIGN KEY to opr_unit_type
    notes TEXT,                       -- Additional information -- TODO: remove
    FOREIGN KEY (army_id) REFERENCES opr_armies(id)
);

-- ============================================================================
-- SPECIAL RULES (Abilities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_special_rules (
    id TEXT PRIMARY KEY,              -- 'tough', 'fearless', 'hive-bond', 'blast' -- TODO: update to VARCHAR
    name TEXT NOT NULL,               -- 'Tough', 'Fearless', 'Hive Bond', 'Blast'
    description TEXT,                 -- Rule description
    category TEXT,                    -- 'universal', 'army-wide', 'weapon-special' -- TODO: make VARCHAR and FOREIGN KEY to opr_special_rule_categories
    is_stackable BOOLEAN DEFAULT 0,   -- Can have rating like Tough(3) or Blast(3)? -- TODO: remove, it is denormalization
    universe_id TEXT,                 -- NULL for universal rules, or specific universe --TODO convert to VARCHAR
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- UNIT ← → SPECIAL RULES (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_unit_special_rules (
    unit_id TEXT, --TODO convert to VARCHAR
    special_rule_id TEXT, --TODO convert to VARCHAR
    rating TEXT,                      -- For 'Tough(3)' store '3', for 'Fearless' store NULL --TODO convert to VARCHAR
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
    range INTEGER,                    -- Range in inches, NULL for melee --TODO add not null, and melee is 0
    attacks TEXT,                     -- 'A1', 'A2', 'A3', etc. -- TODO convert to int not null
    ap INTEGER DEFAULT 0,             -- Armor Penetration
    category TEXT,                    -- 'universal', 'grimdark-future', 'alien-hives' -- TODO: remove
    universe_id TEXT,                 -- NULL for universal, or specific universe
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- WEAPON ← → SPECIAL RULES (Many-to-Many)
-- Normalized junction table for weapon special rules like "Rending", "Blast(3)"
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_weapon_special_rules (
    weapon_id TEXT, --TODO convert to VARCHAR
    special_rule_id TEXT,             -- References opr_special_rules
    rating TEXT,                      -- For 'Blast(3)' store '3', for 'Rending' store NULL -- TODO change with int not null default 0
    PRIMARY KEY (weapon_id, special_rule_id),
    FOREIGN KEY (weapon_id) REFERENCES opr_weapons(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules(id)
);

-- ============================================================================
-- UNIT ← → WEAPONS (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_unit_weapons (
    unit_id TEXT, --TODO convert to VARCHAR
    weapon_id TEXT,--TODO convert to VARCHAR
    count INTEGER DEFAULT 1,          -- How many models/weapons equipped
    is_default BOOLEAN DEFAULT 1,     -- Part of base loadout -- TODO move to opr_upgrades
    -- TODO add `slot` each model can have multiple slots for weapons, that can be replaced, as example "claw1" and "claw2"
    PRIMARY KEY (unit_id, weapon_id, is_default),
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (weapon_id) REFERENCES opr_weapons(id)
);

-- ============================================================================
-- UPGRADE GROUPS
-- Represents grouped upgrade choices like "Upgrade with one" or "Replace X"
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_upgrade_groups (
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord-upgrade-1' --TODO convert to VARCHAR, use it as `slot` idenfier of model
    unit_id TEXT NOT NULL,--TODO convert to VARCHAR
    label TEXT NOT NULL,              -- 'Upgrade with one', 'Replace Shredder Cannon' -- TODO remove - as that text should be created on ui based on upgrade group data
    selection_type TEXT NOT NULL,     -- 'pick-one', 'pick-any', 'replace-weapon' --TODO: remove
    min_selections INTEGER DEFAULT 0, -- Minimum required selections -- TODO: remove
    max_selections INTEGER DEFAULT 1, -- Maximum allowed selections -- TODO: update logic - is set to 0 - means apply to all and prce is per all, if set to other value - price is per 1 upgrade
    applies_to TEXT,                  -- 'one-model', 'all-models', 'any-model', 'up-to-X-models'-- TODO we don't need this one, as we already know count of models in unit and can just set `applies_count` to maximum if it applies to all
    applies_count INTEGER,            -- NULL or number for "up to X models" -- TODO: remove, is handled by max_selection
    sort_order INTEGER DEFAULT 0,     -- Display order
    FOREIGN KEY (unit_id) REFERENCES opr_units(id)
);

-- ============================================================================
-- UPGRADES (Equipment/Ability modifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_upgrades (
  --TODO add     is_default BOOLEAN DEFAULT 1,     -- Part of base loadout

    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord-pheromone-host' --TODO convert to VARCHAR,
    unit_id TEXT NOT NULL, --TODO convert to VARCHAR,
    group_id TEXT,                    -- Links to upgrade group (NULL if standalone) --TODO convert to VARCHAR,
    upgrade_type TEXT NOT NULL,       -- 'add-rule', 'replace-weapon', 'add-weapon', 'replace-attacks' --TODO remove, as all is already based on slots
    name TEXT NOT NULL,               -- 'Pheromone Host (Hive Bond Boost Aura)' -- TODO: no need for brackets and content inside them - that will be done on UI side
    cost INTEGER NOT NULL,            -- Points cost (can be negative)
    description TEXT,                 -- Full description text --TODO: remove
    
    -- What this upgrade affects (one of these will be set)
    replaces_weapon_id TEXT,          -- Weapon being replaced --TODO: Remove - slot based system do not need that
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
