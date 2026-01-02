-- Universal Special Rules
-- These rules are shared across all OPR game systems

DELETE FROM opr_special_rules WHERE category = 'universal';

INSERT INTO opr_special_rules (id, name, description, category, is_stackable, universe_id) VALUES
-- Movement & Positioning
('fearless', 'Fearless', 'Gets +1 to morale tests', 'universal', 0, NULL),
('fast', 'Fast', 'The unit moves +2" when using Advance and Sprint actions', 'universal', 0, NULL),
('slow', 'Slow', 'The unit moves -2" when using Advance and Sprint actions', 'universal', 0, NULL),
('flying', 'Flying', 'May move over obstacles and other units, and ignores terrain effects', 'universal', 0, NULL),
('strider', 'Strider', 'The unit ignores the effects of difficult terrain', 'universal', 0, NULL),
('ambush', 'Ambush', 'This unit may be kept in reserve instead of deploying', 'universal', 0, NULL),

-- Combat & Defense
('tough', 'Tough', 'The unit rolls one extra defense die', 'universal', 1, NULL),
('deadly', 'Deadly', 'Rolls of a natural 6 when attacking count as 2 hits instead of 1', 'universal', 1, NULL),
('rending', 'Rending', 'Unmodified rolls of 6 to hit count as having AP(4)', 'universal', 0, NULL),
('blast', 'Blast', 'Attacks get +X attacks when shooting at units with 3+ models', 'universal', 1, NULL),
('ap', 'AP', 'Targets get -X to defense rolls', 'universal', 1, NULL),

-- Tactical
('stealth', 'Stealth', 'Enemies get -1 to hit rolls when shooting at this unit from over 12" away', 'universal', 0, NULL),
('scout', 'Scout', 'May deploy up to 12" forward after both armies have finished deploying', 'universal', 0, NULL),
('regeneration', 'Regeneration', 'Once per activation, before taking a morale test, roll one die. On a 4+ heal one wound', 'universal', 0, NULL),
('relentless', 'Relentless', 'May shoot even after using the Sprint action', 'universal', 0, NULL);
