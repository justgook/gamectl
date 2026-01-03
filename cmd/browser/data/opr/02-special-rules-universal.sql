-- Universal Special Rules
-- Rules that are shared across all OPR game systems

DELETE FROM opr_special_rules WHERE category = 'universal';

INSERT INTO opr_special_rules (id, name, description, category, is_stackable, universe_id) VALUES
-- Core Universal Rules
('fearless', 'Fearless', 'Gets +1 to morale test rolls', 'universal', 0, NULL),
('tough', 'Tough', 'Model has this many wounds', 'universal', 1, NULL),
('fast', 'Fast', 'Moves +2" when using Advance and +4" when using Rush/Charge', 'universal', 0, NULL),
('slow', 'Slow', 'Moves -2" when using Advance and -4" when using Rush/Charge', 'universal', 0, NULL),
('flying', 'Flying', 'May move over anything, but must end activation on walkable terrain', 'universal', 0, NULL),
('hero', 'Hero', 'May be deployed attached to a unit', 'universal', 0, NULL),
('ambush', 'Ambush', 'May be kept off-table and deployed later', 'universal', 0, NULL),
('scout', 'Scout', 'May move by up to 12" before the game starts', 'universal', 0, NULL),
('stealth', 'Stealth', 'Enemies get -1 to hit when shooting at this unit', 'universal', 0, NULL),
('strider', 'Strider', 'Ignores slow and dangerous terrain', 'universal', 0, NULL),
('regeneration', 'Regeneration', 'When taking a wound, roll one die. On a 5+ it is ignored', 'universal', 0, NULL),
('relentless', 'Relentless', 'May shoot and move in the same activation', 'universal', 0, NULL),
('artillery', 'Artillery', 'May not move and shoot, but ignores cover when shooting', 'universal', 0, NULL),
('no-retreat', 'No Retreat', 'When a unit where most models have this rule fails a morale test that causes it to be Shaken or Routed, the test counts as passed instead. Then, roll as many dice as the number of wounds it would take to fully destroy it, and for each result of 1-3 the unit takes one wound, which cant be ignored', 'universal', 0, NULL),
('transport', 'Transport', 'May carry units inside', 'universal', 1, NULL),
('fear', 'Fear', 'Enemies get -X to morale test rolls when in melee with this model', 'universal', 1, NULL),
('aircra', 'Aircraft', 'Special movement and combat rules for aircraft', 'universal', 0, NULL),
('caster', 'Caster', 'May cast X spells per activation', 'universal', 1, NULL),
('resistance', 'Resistance', 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored. If the wounds were from a spell, then they are ignored on a 2+ instead', 'universal', 0, NULL),
('infiltrate', 'Infiltrate', 'Counts as having Ambush, but may be deployed up to 1" away from enemy units', 'universal', 0, NULL),

-- Weapon Special Rules (normalized for junction table)
('rending', 'Rending', 'On unmodified results of 6 to hit that arent blocked, this weapon deals 2 wounds instead of 1', 'weapon-special', 0, NULL),
('blast', 'Blast', 'Hits all models in the target unit up to X models', 'weapon-special', 1, NULL),
('deadly', 'Deadly', 'When rolling for wounds, AP gets +X on unmodified results of 6 to hit', 'weapon-special', 1, NULL),
('ap', 'AP', 'Targets get -X to defense rolls', 'weapon-special', 1, NULL),
('bane', 'Bane', 'Wounds are only ignored on unmodified rolls of 6', 'weapon-special', 0, NULL),
('reliable', 'Reliable', 'May re-roll hit results of 1', 'weapon-special', 0, NULL),
('indirect', 'Indirect', 'May shoot at targets that are not in line of sight', 'weapon-special', 0, NULL),
('shred', 'Shred', 'On unmodified results of 1 to block hits, this weapon deals 1 extra wound', 'weapon-special', 0, NULL),
('rupture', 'Rupture', 'Ignores Regeneration, and on unmodified results of 6 to hit that arent blocked, this weapon deals 1 extra wound', 'weapon-special', 0, NULL),
('unstoppable', 'Unstoppable', 'When attacking, count enemy cover as being one step worse', 'weapon-special', 0, NULL),
('takedown', 'Takedown', 'Ignores the Tough rule on unmodified rolls of 6', 'weapon-special', 0, NULL),
('strafing', 'Strafing', 'Once per activation, when this model moves through enemy units, pick one of them and attack it with this weapon as if it was shooting', 'weapon-special', 0, NULL),
('precise', 'Precise', 'Gets +1 to hit when attacking', 'weapon-special', 0, NULL),
('furious', 'Furious', 'Gets +1 attack when charging', 'weapon-special', 0, NULL);
