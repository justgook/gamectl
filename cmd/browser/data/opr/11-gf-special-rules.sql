-- Grimdark Future - Specific Special Rules
-- Rules unique to the Grimdark Future universe, extracted from v3.5.1

DELETE FROM opr_special_rules WHERE universe_id = 'grimdark-future';

INSERT INTO opr_special_rules (id, name, description, category, is_stackable, universe_id) VALUES
-- Alien Hives Army-Wide Rule
('hive-bond', 'Hive Bond', 'Units where all models have this rule get +1 to morale test rolls', 'army-wide', 0, 'grimdark-future'),

-- Alien Hives Special Rules
('agile', 'Agile', 'Moves +1" when using Advance, and +2" when using Rush/Charge', 'grimdark-future', 0, 'grimdark-future'),
('breath-attack', 'Breath Attack', 'Once per activation, before attacking, roll one die. On a 2+ one enemy unit within 6" in line of sight takes 1 hit with Blast(3) and AP(1)', 'grimdark-future', 0, 'grimdark-future'),
('caster-group', 'Caster Group', 'Pick one model with this rule in this unit to have Caster(X), where X is the total number of models with this rule in this unit. If the model is killed, pick another to be the new caster, and transfer all spell tokens to it. The caster loses all unspent spell tokens at the end of the round', 'grimdark-future', 0, 'grimdark-future'),
('hit-and-run-fighter', 'Hit & Run Fighter', 'Once per round, units where all models have this rule may move by up to 3" after being in melee', 'grimdark-future', 0, 'grimdark-future'),
('hive-bond-boost', 'Hive Bond Boost', 'If all models in this unit have Hive Bond, they get +2 to morale test rolls from Hive Bond (instead of only +1)', 'grimdark-future', 0, 'grimdark-future'),
('increased-shooting-range', 'Increased Shooting Range', 'This model gets +6" range when shooting', 'grimdark-future', 0, 'grimdark-future'),
('piercing-growth', 'Piercing Growth', 'Place one marker on this unit at the beginning of each round, starting on the round after which it deployed (counting start of game deployment as deploying on the first round). For each marker models with this rule in it get AP(+1) (up to a max. of +2). If this unit is ever Shaken, it loses all its markers', 'grimdark-future', 0, 'grimdark-future'),
('predator-fighter', 'Predator Fighter', 'For each unmodified roll of 6 to hit in melee, this model may roll +1 attack with that weapon. This rule doesnt apply to newly generated attacks', 'grimdark-future', 0, 'grimdark-future'),
('rapid-charge', 'Rapid Charge', 'This model moves +4" when using Charge actions', 'grimdark-future', 0, 'grimdark-future'),
('ravage', 'Ravage', 'When its this models turn to attack in melee, roll X dice. For each 6+ the target takes one wound', 'grimdark-future', 1, 'grimdark-future'),
('regenerative-strength', 'Regenerative Strength', 'Place one marker on this model when it ignores a wound. When in melee, pick one of its weapons to get +X attacks, where X is the number of markers on it', 'grimdark-future', 0, 'grimdark-future'),
('self-destruct', 'Self-Destruct', 'If this model is killed in melee, the attacking unit takes X hits. If this model survives melee, after both sides have finished attacking, it is immediately killed, and the enemy unit takes X hits', 'grimdark-future', 1, 'grimdark-future'),
('shielded', 'Shielded', 'Units where all models have this rule get +1 to defense rolls against hits that are not from spells', 'grimdark-future', 0, 'grimdark-future'),
('spawn', 'Spawn', 'Once per game, when this model is activated, you may place a new unit of X fully within 6" of it', 'grimdark-future', 0, 'grimdark-future'),
('spell-conduit', 'Spell Conduit', 'Casters within 12" that are from other friendly units may cast spells as if they were in this models position, and get +1 to casting rolls when doing so', 'grimdark-future', 0, 'grimdark-future'),
('stealth-buff', 'Stealth Buff', 'Once per activation, before attacking, pick one friendly unit within 12", which gets Stealth once (next time the effect would apply)', 'grimdark-future', 0, 'grimdark-future'),
('surprise-attack', 'Surprise Attack', 'Counts as having Infiltrate. Once deployed via this rule, roll X dice, for each 4+ one enemy unit within 3" takes 2 hits with AP(1)', 'grimdark-future', 1, 'grimdark-future'),
('takedown-strike', 'Takedown Strike', 'Once per game, when its this models turn to attack in melee, you may pick one model in the unit as its target, and make one attack at Quality 2+ with AP(2) and Deadly(3), which is resolved as if its a unit of 1', 'grimdark-future', 0, 'grimdark-future'),
('unpredictable', 'Unpredictable', 'When attacking, roll one die and apply one effect to all models with this rule: on a 1-3 they get AP(+1), and on a 4-6 they get +1 to hit rolls instead', 'grimdark-future', 0, 'grimdark-future'),
('unpredictable-fighter', 'Unpredictable Fighter', 'When in melee, roll one die and apply one effect to all models with this rule: on a 1-3 they get AP(+1), and on a 4-6 they get +1 to hit rolls instead', 'grimdark-future', 0, 'grimdark-future'),
('unpredictable-fighter-mark', 'Unpredictable Fighter Mark', 'Once per activation, before attacking, pick one enemy unit within 18", which friendly units gets Unpredictable Fighter against once (next time the effect would apply)', 'grimdark-future', 0, 'grimdark-future'),

-- Aura Special Rules
('furious-aura', 'Furious Aura', 'This model and its unit get Furious', 'grimdark-future', 0, 'grimdark-future'),
('hive-bond-boost-aura', 'Hive Bond Boost Aura', 'This model and its unit get Hive Bond Boost', 'grimdark-future', 0, 'grimdark-future'),
('increased-shooting-range-aura', 'Increased Shooting Range Aura', 'This model and its unit get +6" range when shooting', 'grimdark-future', 0, 'grimdark-future'),
('rapid-charge-aura', 'Rapid Charge Aura', 'This model and its unit moves +4" when using Charge actions', 'grimdark-future', 0, 'grimdark-future'),
('shielded-aura', 'Shielded Aura', 'This model and its unit get Shielded', 'grimdark-future', 0, 'grimdark-future'),

-- Other GF Rules (from other armies)
('impact', 'Impact', 'Attacks get AP(+1) when charging', 'grimdark-future', 1, 'grimdark-future'),
('poison', 'Poison', 'Attacks always wound on 4+, regardless of defense', 'grimdark-future', 0, 'grimdark-future'),
('acid-blood', 'Acid Blood', 'When killed in melee, attacker takes 1 hit', 'grimdark-future', 0, 'grimdark-future'),
('psychic', 'Psychic', 'May use psychic powers once per activation', 'grimdark-future', 1, 'grimdark-future'),
('repair', 'Repair', 'May heal wounds on nearby friendly units', 'grimdark-future', 1, 'grimdark-future'),
('destroyer', 'Destroyer', 'Ranged attacks get AP(+1)', 'grimdark-future', 0, 'grimdark-future'),
('quantum-shielding', 'Quantum Shielding', 'First wound each round is ignored', 'grimdark-future', 0, 'grimdark-future'),
('walker', 'Walker', 'Moves like infantry but counts as vehicle', 'grimdark-future', 0, 'grimdark-future');
