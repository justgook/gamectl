-- ============================================================================
-- META: Game Universes/Systems
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_universes2 (
    id TEXT PRIMARY KEY,              -- 'grimdark-future', 'age-of-fantasy'
    name TEXT NOT NULL,               -- 'Grimdark Future'
    short_name TEXT,                  -- 'GF' -- TODO: remove
    version TEXT,                     -- 'v3.5.1'
    description TEXT
);

-- ============================================================================
-- ARMIES/FACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_armies2 (
    id TEXT PRIMARY KEY,              -- 'gf-alien-hives'
    universe_id TEXT NOT NULL,        -- 'grimdark-future'
    name TEXT NOT NULL,               -- 'Alien Hives'
    version TEXT,                     -- '3.5.1' (army book version)
    background TEXT,                  -- Lore/description
    color_primary TEXT,               -- Hex color for UI theming
    FOREIGN KEY (universe_id) REFERENCES opr_universes2(id)
);

-- ============================================================================
-- UNITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_units2 (
  -- TODO: add base size (the size of miniature base 2 values width/height dimensions in mm)
    id TEXT PRIMARY KEY,              -- 'gf-ah-hive-lord' --
    army_id TEXT NOT NULL,
    name TEXT NOT NULL,               -- 'Hive Lord'
    size INTEGER NOT NULL DEFAULT 1 CHECK (size > 0), -- Number of models (e.g., 1) 
    cost INTEGER NOT NULL,            -- Base points cost
    quality INTEGER NOT NULL DEFAULT 3,              -- Quality stat (e.g., 3 for 3+)
    defense INTEGER NOT NULL DEFAULT 3,                  -- Defense stat (e.g., 2 for 2+) 
    tough INTEGER NOT NULL DEFAULT 0,                    -- Toughness value (0 if not tough)
    unit_type TEXT NOT NULL,
    FOREIGN KEY (army_id) REFERENCES opr_armies2(id)
    FOREIGN KEY (unit_type) REFERENCES opr_unit_type2(id)
);

CREATE TABLE IF NOT EXISTS opr_unit_type2 (
    id TEXT PRIMARY KEY,              -- 'Infantry', 'Vehicle', 'Hero', 'Monster'
)
-- ============================================================================
-- SLOTS names for equipment
-- ============================================================================
CREATE TABLE IF NOT EXISTS opr_slots2 (
    id TEXT PRIMARY KEY,              -- 'left-hand', 'right-hand', 'bike-gun'
    name TEXT NOT NULL,               -- 'Left Hand'
)

-- -- ============================================================================
-- -- UNIT ← → SLOTS (Many-to-Many)
-- -- ============================================================================
--
-- CREATE TABLE IF NOT EXISTS opr_unit_slots (
--     unit_id TEXT, 
--     slot_id TEXT, 
--     PRIMARY KEY (unit_id, slot_id),
--     FOREIGN KEY (unit_id) REFERENCES opr_units2(id),
--     FOREIGN KEY (slot_id) REFERENCES opr_slots2(id)
-- );

-- ============================================================================
-- SPECIAL RULES (Abilities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_special_rules2 (
    id TEXT PRIMARY KEY,              -- 'tough', 'fearless', 'hive-bond', 'blast' 
    name TEXT NOT NULL,               -- 'Tough', 'Fearless', 'Hive Bond', 'Blast'
    description TEXT,                 -- Rule description
    universe_id TEXT,                 -- NULL for universal rules, or specific universe
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);


-- ============================================================================
-- UNIT ← → SPECIAL RULES (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_unit_special_rules2 (
    unit_id TEXT, 
    special_rule_id TEXT, 
    rating INTEGER NOT NULL DEFAULT 0, -- For 'Tough(3)' store '3', for 'Fearless' store 0
    PRIMARY KEY (unit_id, special_rule_id),
    FOREIGN KEY (unit_id) REFERENCES opr_units2(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules2(id)
);

-- ============================================================================
-- EQUIPMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_equipment2 (
    id TEXT PRIMARY KEY,                -- 'razor-claws', 'shredder-cannon'
    name TEXT NOT NULL,                 -- 'Razor Claws', 'Shredder Cannon'
    range INTEGER NOT NULL DEFAULT 0,   -- Range in inches, 0 for melee
    attacks INTEGER NOT NULL DEFAULT 0, -- 'A1', 'A2', 'A3', etc. 0 - not a weapon
    ap INTEGER DEFAULT 0,               -- Armor Penetration
    universe_id TEXT,                   -- NULL for universal, or specific universe
    FOREIGN KEY (universe_id) REFERENCES opr_universes2(id)
);
-- ============================================================================
-- EQUIPMENT ← → SPECIAL RULES (Many-to-Many)
-- Normalized junction table for equipment special rules like "Rending", "Blast(3)"
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_equipment_special_rules2 (
    equipment_id TEXT, 
    special_rule_id TEXT,             -- References opr_special_rules
    rating TEXT,                      -- For 'Blast(3)' store '3', for 'Rending' store NULL -- TODO change with int not null default 0
    PRIMARY KEY (equipment_id, special_rule_id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment2(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules2(id)
);

-- ============================================================================
-- UNIT ← → EQUIPMENT (Many-to-Many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS opr_unit_equipments2 (
    unit_id TEXT, 
    equipment_id TEXT, 
    slot_id TEXT, 
    is_default BOOLEAN DEFAULT 1,     -- Part of base loadout
    cost INTEGER NOT NULL,

    FOREIGN KEY (unit_id) REFERENCES opr_units2(id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment2(id),
    FOREIGN KEY (slot_id) REFERENCES opr_slots2(id),
    PRIMARY KEY (unit_id, equipment_id, slot_id),

)
