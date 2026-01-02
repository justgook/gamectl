-- Common/Universal Weapons
-- Basic weapons that appear across multiple armies and universes

DELETE FROM opr_weapons WHERE category = 'universal';

INSERT INTO opr_weapons (id, name, range, attacks, ap, special, category, universe_id) VALUES
-- Melee Weapons
('ccw', 'CCW', NULL, 'A1', 0, NULL, 'universal', NULL),
('heavy-ccw', 'Heavy CCW', NULL, 'A2', 1, NULL, 'universal', NULL),
('energy-sword', 'Energy Sword', NULL, 'A2', 2, 'Rending', 'universal', NULL),

-- Basic Ranged
('pistol', 'Pistol', 12, 'A1', 0, NULL, 'universal', NULL),
('rifle', 'Rifle', 24, 'A1', 0, NULL, 'universal', NULL),
('heavy-rifle', 'Heavy Rifle', 30, 'A1', 1, NULL, 'universal', NULL),

-- Support Weapons
('flamer', 'Flamer', 12, '6', 0, NULL, 'universal', NULL),
('grenade-launcher', 'Grenade Launcher', 24, '1', 0, 'Blast(3)', 'universal', NULL),
('heavy-machinegun', 'Heavy Machinegun', 36, 'A3', 0, NULL, 'universal', NULL),
('rocket-launcher', 'Rocket Launcher', 48, '1', 3, 'Deadly(3)', 'universal', NULL);
