-- ============================================================================
-- OPR Unit Builder Schema v3 (Unified Equipment Design)
-- ============================================================================
-- Design principles:
-- 1. Unified equipment table (weapons, items, mounts all in one)
-- 2. Equipment is army-scoped (same name can exist per army)
-- 3. Upgrade groups at unit level with replacement targets
-- 4. Base size changes handled at upgrade option level
-- 5. All IDs generated via slugify(army_id-name) for consistency
-- ============================================================================

-- ============================================================================
-- META: Game Universes/Systems
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_universes (
    id TEXT PRIMARY KEY,              -- 'grimdark-future', 'age-of-fantasy'
    name TEXT NOT NULL,               -- 'Grimdark Future'
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
    version TEXT,                     -- '3.5.1' (army book version)
    background TEXT,                  -- Lore/description
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- ============================================================================
-- UNIT TYPES
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_unit_types (
    id TEXT PRIMARY KEY              -- 'infantry', 'vehicle', 'hero', 'monster'
);

-- Insert common unit types
INSERT OR IGNORE INTO opr_unit_types (id) VALUES 
    ('infantry'),
    ('cavalry'),
    ('vehicle'),
    ('monster'),
    ('hero'),
    ('beast'),
    ('construct');

-- ============================================================================
-- BASE SIZES (for battlefield placement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_base_sizes (
    id TEXT PRIMARY KEY,              -- '25-round', '60x35-oval', 'bike-base'
    shape TEXT,                       -- 'round', 'square', 'oval'
    dimensions TEXT NOT NULL          -- '25', '25x25', '60x35' (in mm)
);

-- Insert common base sizes
INSERT OR IGNORE INTO opr_base_sizes (id, shape, dimensions) VALUES
    ('25-round', 'round', '25'),
    ('32-round', 'round', '32'),
    ('40-round', 'round', '40'),
    ('50-round', 'round', '50'),
    ('60-round', 'round', '60'),
    ('25x25-square', 'square', '25x25'),
    ('40x40-square', 'square', '40x40'),
    ('50x50-square', 'square', '50x50'),
    ('60x35-oval', 'oval', '60x35'),
    ('90x52-oval', 'oval', '90x52'),
    ('105x70-oval', 'oval', '105x70'),
    ('120x92-oval', 'oval', '120x92'),
    ('170x105-oval', 'oval', '170x105');

-- ============================================================================
-- SPECIAL RULES (Abilities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_special_rules (
    id TEXT PRIMARY KEY,              -- 'gf-ah-tough', 'universal-fearless'
    name TEXT NOT NULL,               -- 'Tough', 'Fearless'
    description TEXT,                 -- Rule description
    army_id TEXT,                     -- NULL for universal rules, or specific army
    FOREIGN KEY (army_id) REFERENCES opr_armies(id)
);

-- ============================================================================
-- EQUIPMENT (unified: weapons, items, mounts, bikes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_equipment (
    id TEXT PRIMARY KEY,              -- 'gf-ah-razor-claws'
    army_id TEXT NOT NULL,            -- Army-scoped
    name TEXT NOT NULL,               -- 'Razor Claws'
    type TEXT,                        -- 'weapon', 'item', 'mount' (optional classification)
    
    -- Weapon properties (NULL if not a weapon)
    range INTEGER DEFAULT 0,          -- Range in inches, 0 for melee
    attacks INTEGER DEFAULT 0,        -- Number of attacks
    
    FOREIGN KEY (army_id) REFERENCES opr_armies(id)
);

-- Equipment special rules (e.g., Heavy Rifle has AP(1), Bike has Fast, Tough(3))
CREATE TABLE IF NOT EXISTS opr_equipment_special_rules (
    equipment_id TEXT,
    special_rule_id TEXT,
    rating INTEGER DEFAULT 0,         -- For 'AP(1)' store 1, for 'Rending' store 0
    PRIMARY KEY (equipment_id, special_rule_id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules(id)
);

-- Equipment that grants other equipment (e.g., Combat Shield grants Bash weapon)
CREATE TABLE IF NOT EXISTS opr_equipment_grants (
    parent_equipment_id TEXT,         -- 'combat-shield'
    granted_equipment_id TEXT,        -- 'bash'
    count INTEGER DEFAULT 1,
    PRIMARY KEY (parent_equipment_id, granted_equipment_id),
    FOREIGN KEY (parent_equipment_id) REFERENCES opr_equipment(id),
    FOREIGN KEY (granted_equipment_id) REFERENCES opr_equipment(id)
);

-- ============================================================================
-- UNITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_units (
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord'
    army_id TEXT NOT NULL,
    name TEXT NOT NULL,               -- 'Hive Lord'
    size INTEGER NOT NULL DEFAULT 1,  -- Number of models
    cost INTEGER NOT NULL,            -- Base points cost
    quality INTEGER NOT NULL DEFAULT 3,
    defense INTEGER NOT NULL DEFAULT 3,
    unit_type TEXT NOT NULL,
    base_size_id TEXT,                -- Default base size
    FOREIGN KEY (army_id) REFERENCES opr_armies(id),
    FOREIGN KEY (unit_type) REFERENCES opr_unit_types(id),
    FOREIGN KEY (base_size_id) REFERENCES opr_base_sizes(id)
);

-- Unit special rules (abilities at unit level)
CREATE TABLE IF NOT EXISTS opr_unit_special_rules (
    unit_id TEXT,
    special_rule_id TEXT,
    rating INTEGER DEFAULT 0,         -- For 'Tough(3)' store 3
    PRIMARY KEY (unit_id, special_rule_id),
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules(id)
);

-- Unit default equipment
CREATE TABLE IF NOT EXISTS opr_unit_equipment (
    unit_id TEXT,
    equipment_id TEXT,
    count INTEGER DEFAULT 1,          -- How many models have this equipment
    PRIMARY KEY (unit_id, equipment_id),
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment(id)
);

-- ============================================================================
-- UPGRADE GROUPS (organize upgrade choices)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_upgrade_groups (
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord-weapons-1'
    unit_id TEXT NOT NULL,
    label TEXT NOT NULL,              -- "Replace Combat Shield and CCW"
    select_min INTEGER DEFAULT 0,     -- Minimum selections required
    select_max INTEGER DEFAULT 1,     -- Maximum selections allowed (NULL = unlimited)
    affects TEXT,                     -- 'one-model', 'all-models', 'any-model', 'up-to-X'
    affects_count INTEGER,            -- For 'up-to-X' mode
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (unit_id) REFERENCES opr_units(id)
);

-- What equipment this group replaces (many-to-many: group can replace multiple items)
CREATE TABLE IF NOT EXISTS opr_upgrade_group_replaces (
    group_id TEXT,
    equipment_id TEXT,
    PRIMARY KEY (group_id, equipment_id),
    FOREIGN KEY (group_id) REFERENCES opr_upgrade_groups(id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment(id)
);

-- Options within a group (just equipment + cost)
CREATE TABLE IF NOT EXISTS opr_upgrade_options (
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord-opt-1'
    group_id TEXT NOT NULL,
    equipment_id TEXT NOT NULL,
    cost INTEGER NOT NULL,            -- Cost for this specific unit
    overrides_base_size_id TEXT,      -- If not NULL, changes model base size (bikes, mounts)
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (group_id) REFERENCES opr_upgrade_groups(id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment(id),
    FOREIGN KEY (overrides_base_size_id) REFERENCES opr_base_sizes(id)
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_armies_universe ON opr_armies(universe_id);
CREATE INDEX IF NOT EXISTS idx_units_army ON opr_units(army_id);
CREATE INDEX IF NOT EXISTS idx_equipment_army ON opr_equipment(army_id);
CREATE INDEX IF NOT EXISTS idx_special_rules_army ON opr_special_rules(army_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_groups_unit ON opr_upgrade_groups(unit_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_options_group ON opr_upgrade_options(group_id);
