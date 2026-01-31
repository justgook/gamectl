-- +goose Up
-- Migration: opr_schema
-- OPR Unit Builder Schema v3 (Unified Equipment Design)

-- Game Universes/Systems
CREATE TABLE IF NOT EXISTS opr_universes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT,
    description TEXT
);

-- Armies/Factions
CREATE TABLE IF NOT EXISTS opr_armies (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version TEXT,
    background TEXT,
    color_primary TEXT,
    FOREIGN KEY (universe_id) REFERENCES opr_universes(id)
);

-- Unit Types
CREATE TABLE IF NOT EXISTS opr_unit_types (
    id TEXT PRIMARY KEY
);

INSERT OR IGNORE INTO opr_unit_types (id) VALUES 
    ('infantry'),
    ('cavalry'),
    ('vehicle'),
    ('monster'),
    ('hero'),
    ('beast'),
    ('construct');

-- Base Sizes
CREATE TABLE IF NOT EXISTS opr_base_sizes (
    id TEXT PRIMARY KEY,
    shape TEXT,
    dimensions TEXT NOT NULL
);

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

-- Special Rules
CREATE TABLE IF NOT EXISTS opr_special_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    army_id TEXT,
    FOREIGN KEY (army_id) REFERENCES opr_armies(id)
);

-- Equipment
CREATE TABLE IF NOT EXISTS opr_equipment (
    id TEXT PRIMARY KEY,
    army_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    range INTEGER DEFAULT 0,
    attacks INTEGER DEFAULT 0,
    FOREIGN KEY (army_id) REFERENCES opr_armies(id)
);

-- Equipment special rules
CREATE TABLE IF NOT EXISTS opr_equipment_special_rules (
    equipment_id TEXT,
    special_rule_id TEXT,
    rating INTEGER DEFAULT 0,
    PRIMARY KEY (equipment_id, special_rule_id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules(id)
);

-- Equipment grants
CREATE TABLE IF NOT EXISTS opr_equipment_grants (
    parent_equipment_id TEXT,
    granted_equipment_id TEXT,
    count INTEGER DEFAULT 1,
    PRIMARY KEY (parent_equipment_id, granted_equipment_id),
    FOREIGN KEY (parent_equipment_id) REFERENCES opr_equipment(id),
    FOREIGN KEY (granted_equipment_id) REFERENCES opr_equipment(id)
);

-- Units
CREATE TABLE IF NOT EXISTS opr_units (
    id TEXT PRIMARY KEY,
    army_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 1,
    cost INTEGER NOT NULL,
    quality INTEGER NOT NULL DEFAULT 3,
    defense INTEGER NOT NULL DEFAULT 3,
    unit_type TEXT NOT NULL,
    base_size_id TEXT,
    FOREIGN KEY (army_id) REFERENCES opr_armies(id),
    FOREIGN KEY (unit_type) REFERENCES opr_unit_types(id),
    FOREIGN KEY (base_size_id) REFERENCES opr_base_sizes(id)
);

-- Unit special rules
CREATE TABLE IF NOT EXISTS opr_unit_special_rules (
    unit_id TEXT,
    special_rule_id TEXT,
    rating INTEGER DEFAULT 0,
    PRIMARY KEY (unit_id, special_rule_id),
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (special_rule_id) REFERENCES opr_special_rules(id)
);

-- Unit default equipment
CREATE TABLE IF NOT EXISTS opr_unit_equipment (
    unit_id TEXT,
    equipment_id TEXT,
    count INTEGER DEFAULT 1,
    PRIMARY KEY (unit_id, equipment_id),
    FOREIGN KEY (unit_id) REFERENCES opr_units(id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment(id)
);

-- Upgrade groups
CREATE TABLE IF NOT EXISTS opr_upgrade_groups (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL,
    label TEXT NOT NULL,
    select_min INTEGER DEFAULT 0,
    select_max INTEGER DEFAULT 1,
    affects TEXT,
    affects_count INTEGER,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (unit_id) REFERENCES opr_units(id)
);

-- Upgrade group replaces
CREATE TABLE IF NOT EXISTS opr_upgrade_group_replaces (
    group_id TEXT,
    equipment_id TEXT,
    PRIMARY KEY (group_id, equipment_id),
    FOREIGN KEY (group_id) REFERENCES opr_upgrade_groups(id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment(id)
);

-- Upgrade options
CREATE TABLE IF NOT EXISTS opr_upgrade_options (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    equipment_id TEXT NOT NULL,
    cost INTEGER NOT NULL,
    overrides_base_size_id TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (group_id) REFERENCES opr_upgrade_groups(id),
    FOREIGN KEY (equipment_id) REFERENCES opr_equipment(id),
    FOREIGN KEY (overrides_base_size_id) REFERENCES opr_base_sizes(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_armies_universe ON opr_armies(universe_id);
CREATE INDEX IF NOT EXISTS idx_units_army ON opr_units(army_id);
CREATE INDEX IF NOT EXISTS idx_equipment_army ON opr_equipment(army_id);
CREATE INDEX IF NOT EXISTS idx_special_rules_army ON opr_special_rules(army_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_groups_unit ON opr_upgrade_groups(unit_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_options_group ON opr_upgrade_options(group_id);
