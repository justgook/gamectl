-- Grimdark Future - Battle Brothers Units
-- Sample units with weapons, special rules, and upgrades

-- Clean up existing data
DELETE FROM opr_upgrades WHERE unit_id LIKE 'gf-bb-%';
DELETE FROM opr_unit_weapons WHERE unit_id LIKE 'gf-bb-%';
DELETE FROM opr_unit_special_rules WHERE unit_id LIKE 'gf-bb-%';
DELETE FROM opr_units WHERE army_id = 'gf-battle-brothers';

-- ============================================================================
-- UNITS
-- ============================================================================

INSERT INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type, notes) VALUES
-- Core Infantry
('gf-bb-infantry', 'gf-battle-brothers', 'Infantry', 5, 115, 4, 4, 'Infantry', 'Basic troops'),
('gf-bb-veterans', 'gf-battle-brothers', 'Veteran Infantry', 5, 140, 3, 3, 'Infantry', 'Elite troops with improved stats'),

-- Fast Attack
('gf-bb-bikes', 'gf-battle-brothers', 'Assault Bikes', 3, 105, 4, 4, 'Cavalry', 'Fast moving bike squad'),

-- Heavy Support
('gf-bb-tank', 'gf-battle-brothers', 'Battle Tank', 1, 170, 4, 10, 'Vehicle', 'Heavy armored vehicle'),

-- Heroes
('gf-bb-captain', 'gf-battle-brothers', 'Captain', 1, 80, 3, 4, 'Hero', 'Army commander');

-- ============================================================================
-- UNIT WEAPONS (Base Loadouts)
-- ============================================================================

-- Infantry: CCW + Rifle (all 5 models)
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-bb-infantry', 'ccw', 5, 1),
('gf-bb-infantry', 'rifle', 5, 1);

-- Veterans: CCW + Storm Rifle (all 5 models)
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-bb-veterans', 'ccw', 5, 1),
('gf-bb-veterans', 'gf-storm-rifle', 5, 1);

-- Bikes: CCW + Rifle (all 3 models)
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-bb-bikes', 'ccw', 3, 1),
('gf-bb-bikes', 'rifle', 3, 1);

-- Tank: Heavy Plasma
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-bb-tank', 'gf-heavy-plasma', 1, 1);

-- Captain: Energy Sword + Plasma Rifle
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-bb-captain', 'energy-sword', 1, 1),
('gf-bb-captain', 'gf-plasma-rifle', 1, 1);

-- ============================================================================
-- UNIT SPECIAL RULES
-- ============================================================================

-- Infantry: Fearless
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-bb-infantry', 'fearless', NULL);

-- Veterans: Fearless + Tough
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-bb-veterans', 'fearless', NULL),
('gf-bb-veterans', 'tough', '3');

-- Bikes: Fearless + Fast
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-bb-bikes', 'fearless', NULL),
('gf-bb-bikes', 'fast', NULL),
('gf-bb-bikes', 'gf-impact', '1');

-- Tank: Tough
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-bb-tank', 'tough', '12');

-- Captain: Hero + Fearless + Tough
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-bb-captain', 'gf-hero', NULL),
('gf-bb-captain', 'fearless', NULL),
('gf-bb-captain', 'tough', '3');

-- ============================================================================
-- UPGRADES (Simple version)
-- ============================================================================

-- Infantry: Upgrade 1 model to Plasma Rifle
INSERT INTO opr_upgrades (id, unit_id, upgrade_type, name, cost, description) VALUES
('gf-bb-inf-plasma', 'gf-bb-infantry', 'replace-weapon', 'Replace 1x Rifle with Plasma Rifle', 10, 'One model gets Plasma Rifle'),
('gf-bb-inf-flamer', 'gf-bb-infantry', 'replace-weapon', 'Replace 1x Rifle with Flamer', 5, 'One model gets Flamer'),
('gf-bb-inf-rocket', 'gf-bb-infantry', 'add-weapon', 'Add Rocket Launcher', 15, 'One model gets Rocket Launcher');

-- Veterans: Special weapon options
INSERT INTO opr_upgrades (id, unit_id, upgrade_type, name, cost, description) VALUES
('gf-bb-vet-melta', 'gf-bb-veterans', 'replace-weapon', 'Replace 1x Storm Rifle with Melta Gun', 15, 'One model gets Melta Gun'),
('gf-bb-vet-power-fist', 'gf-bb-veterans', 'replace-weapon', 'Replace 1x CCW with Power Fist', 10, 'One model gets Power Fist');

-- Tank: Weapon swaps
INSERT INTO opr_upgrades (id, unit_id, upgrade_type, name, cost, description) VALUES
('gf-bb-tank-lascannon', 'gf-bb-tank', 'replace-weapon', 'Replace Heavy Plasma with Lascannon', 5, 'Swap to anti-armor weapon');

-- Captain: Equipment
INSERT INTO opr_upgrades (id, unit_id, upgrade_type, name, cost, description) VALUES
('gf-bb-cap-power-fist', 'gf-bb-captain', 'replace-weapon', 'Replace Energy Sword with Power Fist', 5, 'More powerful melee weapon');
