-- Grimdark Future - Alien Hives Units
-- Sample units for the Alien Hives faction

-- Clean up existing data
DELETE FROM opr_upgrades WHERE unit_id LIKE 'gf-ah-%';
DELETE FROM opr_unit_weapons WHERE unit_id LIKE 'gf-ah-%';
DELETE FROM opr_unit_special_rules WHERE unit_id LIKE 'gf-ah-%';
DELETE FROM opr_units WHERE army_id = 'gf-alien-hives';

-- ============================================================================
-- UNITS
-- ============================================================================

INSERT INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type, notes) VALUES
-- Swarms
('gf-ah-grunts', 'gf-alien-hives', 'Grunt Swarm', 10, 100, 5, 5, 'Infantry', 'Cheap swarm units'),
('gf-ah-warriors', 'gf-alien-hives', 'Warrior Organisms', 6, 120, 4, 4, 'Infantry', 'Standard bio-warriors'),

-- Specialists
('gf-ah-psyker', 'gf-alien-hives', 'Psychic Organism', 1, 95, 4, 5, 'Infantry', 'Psychic support unit'),

-- Monsters
('gf-ah-beast', 'gf-alien-hives', 'Ravager Beast', 1, 150, 4, 8, 'Monster', 'Large assault creature'),

-- Flying
('gf-ah-flyers', 'gf-alien-hives', 'Winged Hunters', 3, 90, 4, 5, 'Infantry', 'Flying assault troops');

-- ============================================================================
-- UNIT WEAPONS (Base Loadouts)
-- ============================================================================

-- Grunts: Claws only
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-grunts', 'ccw', 10, 1);

-- Warriors: Claws + Spike Rifle
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-warriors', 'ccw', 6, 1),
('gf-ah-warriors', 'gf-spike-rifle', 6, 1);

-- Psyker: Light weapons
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-psyker', 'ccw', 1, 1);

-- Beast: Venom Claws
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-beast', 'gf-venom-claws', 1, 1);

-- Flyers: Claws + Spike Rifle
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-flyers', 'ccw', 3, 1),
('gf-ah-flyers', 'gf-spike-rifle', 3, 1);

-- ============================================================================
-- UNIT SPECIAL RULES
-- ============================================================================

-- Grunts: Fast
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-grunts', 'fast', NULL);

-- Warriors: Regeneration
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-warriors', 'regeneration', NULL),
('gf-ah-warriors', 'gf-acid-blood', NULL);

-- Psyker: Psychic
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-psyker', 'gf-psychic', '2');

-- Beast: Tough + Regeneration + Furious
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-beast', 'tough', '6'),
('gf-ah-beast', 'regeneration', NULL),
('gf-ah-beast', 'gf-furious', NULL);

-- Flyers: Flying + Fast
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-flyers', 'flying', NULL),
('gf-ah-flyers', 'fast', NULL);

-- ============================================================================
-- UPGRADES (Simple version)
-- ============================================================================

-- Warriors: Add bio-weapons
INSERT INTO opr_upgrades (id, unit_id, upgrade_type, name, cost, description) VALUES
('gf-ah-war-bio-cannon', 'gf-ah-warriors', 'add-weapon', 'Add Bio-Cannon', 20, 'One model gets Bio-Cannon'),
('gf-ah-war-venom', 'gf-ah-warriors', 'replace-weapon', 'Replace CCW with Venom Claws', 10, 'Upgrade to better melee');

-- Beast: Enhanced abilities
INSERT INTO opr_upgrades (id, unit_id, upgrade_type, name, cost, description) VALUES
('gf-ah-beast-wings', 'gf-ah-beast', 'add-rule', 'Add Wings', 15, 'Gains Flying special rule');
