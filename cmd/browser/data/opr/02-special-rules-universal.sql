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
('rending', 'Rending', 'Ignores Regeneration, and on unmodified results of 6 to hit, those hits get AP(+4)', 'weapon-special', 0, NULL),
('blast', 'Blast', 'Ignores cover, and after resolving other special rules, each hit is multiplied by X, where X is up to as many hits as models in the target unit', 'weapon-special', 1, NULL),
('deadly', 'Deadly', 'Assign each wound to one model, and multiply it by X. Hits from Deadly must be resolved first, and these wounds dont carry over to other models if the original target is killed', 'weapon-special', 1, NULL),
('ap', 'AP', 'Targets get -X to Defense rolls when blocking hits from this weapon', 'weapon-special', 1, NULL),
('bane', 'Bane', 'Ignores Regeneration, and when attacking the target must re-roll unmodified Defense results of 6', 'weapon-special', 0, NULL),
('reliable', 'Reliable', 'Attacks at Quality 2+', 'weapon-special', 0, NULL),
('indirect', 'Indirect', 'Gets -1 to hit rolls when shooting after moving. May target enemies that are not in line of sight as if in line of sight, and ignores cover from sight obstructions', 'weapon-special', 0, NULL),
('shred', 'Shred', 'On unmodified results of 1 to block hits, this weapon deals 1 extra wound', 'weapon-special', 0, NULL),
('rupture', 'Rupture', 'Ignores Regeneration, and on unmodified results of 6 to hit that arent blocked, this weapon deals 1 extra wound', 'weapon-special', 0, NULL),
('unstoppable', 'Unstoppable', 'Ignores Regeneration, and ignores all negative modifiers to this weapon', 'weapon-special', 0, NULL),
('takedown', 'Takedown', 'This model may pick any model in the target unit as its individual target, which is resolved as if it was a unit of [1]. Takedown attacks must be resolved before other weapons', 'weapon-special', 0, NULL),
('strafing', 'Strafing', 'Once per activation, when this model moves through enemy units, pick one of them and attack it with this weapon as if it was shooting. This weapon may only be used in this way', 'weapon-special', 0, NULL),
('precise', 'Precise', 'Gets +1 to hit when attacking', 'weapon-special', 0, NULL),
('furious', 'Furious', 'When charging, unmodified results of 6 to hit in melee deal 1 extra hit (only the original hit counts as a 6 for special rules)', 'weapon-special', 0, NULL),
('relentless-weapon', 'Relentless', 'When this model shoots at enemies over 9" away, unmodified results of 6 to hit deal 1 extra hit (only the original hit counts as a 6 for special rules)', 'weapon-special', 0, NULL);
