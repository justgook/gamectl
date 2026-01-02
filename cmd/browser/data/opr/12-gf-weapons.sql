-- Grimdark Future - Weapons
-- Sci-fi weapons specific to Grimdark Future

DELETE FROM opr_weapons WHERE universe_id = 'grimdark-future';

INSERT INTO opr_weapons (id, name, range, attacks, ap, special, category, universe_id) VALUES
-- Battle Brothers Weapons
('gf-plasma-rifle', 'Plasma Rifle', 24, 'A1', 1, 'Rending', 'grimdark-future', 'grimdark-future'),
('gf-melta-gun', 'Melta Gun', 12, 'A1', 4, 'Deadly(6)', 'grimdark-future', 'grimdark-future'),
('gf-lascannon', 'Lascannon', 48, 'A1', 4, 'Deadly(3)', 'grimdark-future', 'grimdark-future'),
('gf-power-fist', 'Power Fist', NULL, 'A3', 2, 'Deadly(3)', 'grimdark-future', 'grimdark-future'),
('gf-storm-rifle', 'Storm Rifle', 18, 'A2', 0, NULL, 'grimdark-future', 'grimdark-future'),

-- Alien Hives Weapons
('gf-bio-cannon', 'Bio-Cannon', 24, 'A3', 0, 'Poison', 'grimdark-future', 'grimdark-future'),
('gf-venom-claws', 'Venom Claws', NULL, 'A3', 0, 'Poison,Rending', 'grimdark-future', 'grimdark-future'),
('gf-spike-rifle', 'Spike Rifle', 18, 'A1', 0, 'Poison', 'grimdark-future', 'grimdark-future'),
('gf-acid-spray', 'Acid Spray', 12, '6', 1, NULL, 'grimdark-future', 'grimdark-future'),

-- Robot Legions Weapons
('gf-gauss-rifle', 'Gauss Rifle', 24, 'A1', 1, NULL, 'grimdark-future', 'grimdark-future'),
('gf-tesla-carbine', 'Tesla Carbine', 18, 'A2', 0, NULL, 'grimdark-future', 'grimdark-future'),
('gf-particle-whip', 'Particle Whip', 36, 'A3', 2, 'Blast(3)', 'grimdark-future', 'grimdark-future'),
('gf-phase-blade', 'Phase Blade', NULL, 'A2', 3, NULL, 'grimdark-future', 'grimdark-future'),

-- Heavy Weapons
('gf-heavy-plasma', 'Heavy Plasma Cannon', 36, 'A3', 2, 'Blast(3)', 'grimdark-future', 'grimdark-future'),
('gf-missile-pod', 'Missile Pod', 48, '2', 2, 'Deadly(3)', 'grimdark-future', 'grimdark-future');
