-- Grimdark Future Armies/Factions
-- Sample armies for testing and initial setup

DELETE FROM opr_armies WHERE universe_id = 'grimdark-future';

INSERT INTO opr_armies (id, universe_id, name, background, color_primary) VALUES
('gf-battle-brothers', 'grimdark-future', 'Battle Brothers', 
 'Elite super-soldiers created through genetic engineering and rigorous training. They are humanity''s finest warriors, clad in powered armor and wielding the most advanced weapons.', 
 '#1E3A8A'),

('gf-alien-hives', 'grimdark-future', 'Alien Hives',
 'Endless swarms of bio-engineered organisms driven by a single hive mind. They evolve rapidly to consume all biomass in their path, adapting to overcome any threat.',
 '#7C2D12'),

('gf-robot-legions', 'grimdark-future', 'Robot Legions',
 'Ancient mechanical warriors awakened from eons of slumber. These emotionless automatons seek to reclaim the galaxy they once ruled with cold, calculated precision.',
 '#44403C');
