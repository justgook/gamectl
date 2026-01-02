-- Grimdark Future - Specific Special Rules
-- Rules unique to the Grimdark Future universe

DELETE FROM opr_special_rules WHERE universe_id = 'grimdark-future';

INSERT INTO opr_special_rules (id, name, description, category, is_stackable, universe_id) VALUES
-- Battle Brothers
('gf-impact', 'Impact', 'Attacks get AP(+1) when charging', 'grimdark-future', 1, 'grimdark-future'),
('gf-furious', 'Furious', 'Gets +1 attack when charging', 'grimdark-future', 0, 'grimdark-future'),
('gf-hero', 'Hero', 'May be deployed attached to a unit', 'grimdark-future', 0, 'grimdark-future'),

-- Alien Hives
('gf-poison', 'Poison', 'Attacks always wound on 4+, regardless of defense', 'grimdark-future', 0, 'grimdark-future'),
('gf-acid-blood', 'Acid Blood', 'When killed in melee, attacker takes 1 hit', 'grimdark-future', 0, 'grimdark-future'),
('gf-psychic', 'Psychic', 'May use psychic powers once per activation', 'grimdark-future', 1, 'grimdark-future'),

-- Robot Legions
('gf-repair', 'Repair', 'May heal wounds on nearby friendly units', 'grimdark-future', 1, 'grimdark-future'),
('gf-destroyer', 'Destroyer', 'Ranged attacks get AP(+1)', 'grimdark-future', 0, 'grimdark-future'),
('gf-quantum-shielding', 'Quantum Shielding', 'First wound each round is ignored', 'grimdark-future', 0, 'grimdark-future'),

-- Universal GF Rules
('gf-transport', 'Transport', 'May carry units inside', 'grimdark-future', 1, 'grimdark-future'),
('gf-walker', 'Walker', 'Moves like infantry but counts as vehicle', 'grimdark-future', 0, 'grimdark-future');
