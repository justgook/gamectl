-- ============================================================================
-- Army: Alien Hives
-- Generated from OPR API
-- ============================================================================

-- Universe
INSERT OR IGNORE INTO opr_universes (id, name) VALUES ('grimdark-future', 'Grimdark Future');

-- Army
INSERT OR IGNORE INTO opr_armies (id, universe_id, name, version, background) VALUES
  ('gf-alien-hives', 'grimdark-future', 'Alien Hives', '3.5.1', 'The Alien Hives are a faction of aliens using biotechnology, and is made up of a variety of sub-species which come from the remote frontiers of the galaxy, striving to find their niche in Sirius. 

When they first arrived, they were viewed as monstrous invaders, but after a long war of extermination, breakthroughs in communication lead to a fragile peace. Now, the Hives must come to terms with the legacy of the long war and decide how they are to adapt.');

-- Special Rules
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-piercing-growth', 'Piercing Growth', 'Place one marker on this unit at the beginning of each round, starting on the round after which it deployed (counting  start of game deployment as deploying on the first round). For each marker models with this rule in it get AP(+1) (up to a max. of +2). If this unit is ever Shaken, it loses all its markers.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-strafing', 'Strafing', 'Once per activation, when this model moves through enemy units, pick one of them and attack it with this weapon as if it was shooting. This weapon may only be used in this way.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-increased-shooting-range', 'Increased Shooting Range', 'This model gets +6" range when shooting.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-precise', 'Precise', 'Gets +1 to hit when attacking.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-hive-bond', 'Hive Bond', 'Units where all models have this rule get +1 to morale test rolls.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-breath-attack', 'Breath Attack', 'Once per activation, before attacking, roll one die. On a 2+ one enemy unit within 6" in line of sight takes 1 hit with Blast(3) and AP(1).', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-spell-conduit', 'Spell Conduit', 'Casters within 12" that are from other friendly units may cast spells as if they were in this model''s position, and get +1 to casting rolls when doing so.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-unique', 'Unique', 'This unit may only be taken once per army.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-takedown-strike', 'Takedown Strike', 'Once per game, when it''s this model''s turn to attack in melee, you may pick one model in the unit as its target, and make one attack at Quality 2+ with AP(2) and Deadly(3), which is resolved as if it''s a unit of 1.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-infiltrate', 'Infiltrate', 'Counts as having Ambush, but may be deployed up to 1" away from enemy units.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-shielded', 'Shielded', 'Units where all models have this rule get +1 to defense rolls against hits that are not from spells.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-shred', 'Shred', 'On unmodified results of 1 to block hits, this weapon deals 1 extra wound.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-regenerative-strength', 'Regenerative Strength', 'Place one marker on this model when it ignores a wound. When in melee, pick one of its weapons to get +X attacks, where X is the number of markers on it.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-predator-fighter', 'Predator Fighter', 'For each unmodified roll of 6 to hit in melee, this model may roll +1 attack with that weapon. This rule doesn’t apply to newly generated attacks.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-rapid-charge-aura', 'Rapid Charge Aura', 'This model and its unit moves +4" when using Charge actions.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-ravage', 'Ravage', 'When it''s this model''s turn to attack in melee, roll X dice. For each 6+ the target takes one wound.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-increased-shooting-range-aura', 'Increased Shooting Range Aura', 'This model and its unit get +6" range when shooting.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-rapid-charge', 'Rapid Charge', 'This model moves +4" when using Charge actions.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-furious-aura', 'Furious Aura', 'This model and its unit get Furious.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-bane-in-melee', 'Bane in Melee', 'This model gets Bane in melee.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-rupture', 'Rupture', 'Ignores Regeneration, and on unmodified results of 6 to hit that aren''t blocked, this weapon deals 1 extra wound.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-self-destruct', 'Self-Destruct', 'If this model is killed in melee, the attacking unit takes X hits. If this model survives melee, after both sides have finished attacking, it is immediately killed, and the enemy unit takes X hits.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-stealth-buff', 'Stealth Buff', 'Once per activation, before attacking, pick one friendly unit within 12", which gets Stealth once (next time the effect would apply).', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-agile', 'Agile', 'Moves +1" when using Advance, and +2” when using Rush/Charge.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-unpredictable-fighter-mark', 'Unpredictable Fighter Mark', 'Once per activation, before attacking, pick one enemy unit within 18", which friendly units gets Unpredictable Fighter against once (next time the effect would apply).', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-shielded-aura', 'Shielded Aura', 'This model and its unit get Shielded.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-resistance', 'Resistance', 'When a unit where all models have this rule takes wounds, roll one die for each. On a 6+ it is ignored. If the wounds were from a spell, then they are ignored on a 2+ instead.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-surprise-attack', 'Surprise Attack', 'Counts as having Infiltrate. Once deployed via this rule, roll X dice, for each 4+ one enemy unit within 3” takes 2 hits with AP(1).', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-spawn', 'Spawn', 'Once per game, when this model is activated, you may place a new unit of X fully within 6" of it.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-caster-group', 'Caster Group', 'Pick one model with this rule in this unit to have Caster(X), where X is the total number of models with this rule in this unit. If the model is killed, pick another to be the new caster, and transfer all spell tokens to it. The caster loses all unspent spell tokens at the end of the round.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-hive-bond-boost-aura', 'Hive Bond Boost Aura', 'This model and its unit get Hive Bond Boost.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-no-retreat', 'No Retreat', 'When a unit where most models have this rule fails a morale test that causes it to be Shaken or Routed, the test counts as passed instead. Then, roll as many dice as the number of wounds it would take to fully destroy it, and for each result of 1-3 the unit takes one wound, which can''t be ignored.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-ap', 'AP', 'Targets get -X to Defense rolls when blocking hits.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-blast', 'Blast', 'Ignores cover, and after resolving other special rules, each hit is multiplied by X, where X is up to as many hits as models in the target unit.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-caster', 'Caster', 'Gets X spell tokens at the start of each round, but can’t hold more than 6 tokens at once. At any point before attacking, spend as many tokens as the spell’s value to try casting one or more spells (only one try per spell). Roll one die, on 4+ resolve the effect on a target in line of sight. Models within 18” in line of sight of the caster’s unit may spend any number of spell tokens at the same time before rolling, to give the caster +1/-1 to the roll per token.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-deadly', 'Deadly', 'Assign each wound to one model, and multiply it by X. Hits from Deadly must be resolved first, and these wounds don’t carry over to other models if the original target is killed.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-ambush', 'Ambush', 'May be set aside before deployment. At the start of any round after the first, may be deployed anywhere over 9” away from enemy units. Players alternate in placing Ambush units, starting with the player that activates next. Units that deploy via Ambush can’t seize or contest objectives on the round they deploy.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-furious', 'Furious', 'When charging, unmodified results of 6 to hit in melee deal 1 extra hit (only the original hit counts as a 6 for special rules).', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-bane', 'Bane', 'Ignores Regeneration, and when attacking the target must re-roll unmodified Defense results of 6.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-regeneration', 'Regeneration', 'When a unit where all models have this rule takes wounds, roll one die for each. On a 5+ it is ignored.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-ignores-regeneration', 'Ignores Regeneration', 'This weapon ignores Regeneration.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-stealth', 'Stealth', 'When units where all models have this rule are shot from over 9" away, enemy units get -1 to hit rolls.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-unpredictable-fighter', 'Unpredictable Fighter', 'When in melee, roll one die and apply one effect to all models with this rule: on a 1-3 they get AP(+1), and on a 4-6 they get +1 to hit rolls instead.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-unpredictable', 'Unpredictable', 'When attacking, roll one die and apply one effect to all models with this rule: on a 1-3 they get AP(+1), and on a 4-6 they get +1 to hit rolls instead.', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-hive-bond-boost', 'Hive Bond Boost', 'If all models in this unit have Hive Bond, they get +2 to morale test rolls from Hive Bond (instead of only +1).', 'gf-alien-hives');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-alien-hives-hit-run-fighter', 'Hit & Run Fighter', 'Once per round, units where all models have this rule may move by up to 3" after being in melee.', 'gf-alien-hives');

-- Equipment
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-acid-bio-artillery', 'gf-alien-hives', 'Acid Bio-Artillery', 'weapon', 36, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-bio-artillery', 'gf-alien-hives-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-bio-artillery', 'gf-alien-hives-deadly', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-bio-artillery', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-acid-cannon', 'gf-alien-hives', 'Acid Cannon', 'weapon', 36, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-cannon', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-cannon', 'gf-alien-hives-deadly', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-cannon', 'universal-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-acid-launcher', 'gf-alien-hives', 'Acid Launcher', 'weapon', 30, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-launcher', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-launcher', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-launcher', 'universal-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-acid-launcher-array', 'gf-alien-hives', 'Acid Launcher Array', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-launcher-array', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-launcher-array', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-launcher-array', 'universal-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-acid-spike-launcher', 'gf-alien-hives', 'Acid Spike Launcher', 'weapon', 18, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-spike-launcher', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-spike-launcher', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-spike-launcher', 'universal-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-acid-spurt', 'gf-alien-hives', 'Acid Spurt', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-spurt', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-acid-spurt', 'gf-alien-hives-bane', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-adrenaline-fueled', 'gf-alien-hives', 'Adrenaline Fueled', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-assault-breed', 'gf-alien-hives', 'Assault Breed', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-assault-brood', 'gf-alien-hives', 'Assault Brood', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-barb-cannon', 'gf-alien-hives', 'Barb Cannon', 'weapon', 36, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-barb-cannon', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-barb-cannon', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-barb-cannon-array', 'gf-alien-hives', 'Barb Cannon Array', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-barb-cannon-array', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-barb-cannon-array', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-barb-gun', 'gf-alien-hives', 'Barb Gun', 'weapon', 30, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-barb-gun', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-barb-gun', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-barb-launcher', 'gf-alien-hives', 'Barb Launcher', 'weapon', 18, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-barb-launcher', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-barb-launcher', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-battle-pheromones', 'gf-alien-hives', 'Battle Pheromones', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-borer', 'gf-alien-hives', 'Bio-Borer', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-cannon', 'gf-alien-hives', 'Bio-Cannon', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-cannon', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-cannon', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-cannon', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-flamer', 'gf-alien-hives', 'Bio-Flamer', 'weapon', 6, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-flamer', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-flamer', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-fuser', 'gf-alien-hives', 'Bio-Fuser', 'weapon', 6, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-fuser', 'gf-alien-hives-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-fuser', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-plasma', 'gf-alien-hives', 'Bio-Plasma', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-plasma', 'gf-alien-hives-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-pod', 'gf-alien-hives', 'Bio-Pod', 'weapon', 24, 12);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-ravager', 'gf-alien-hives', 'Bio-Ravager', 'weapon', 18, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-ravager', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-recovery', 'gf-alien-hives', 'Bio-Recovery', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-shredder', 'gf-alien-hives', 'Bio-Shredder', 'weapon', 9, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-shredder', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-spiker', 'gf-alien-hives', 'Bio-Spiker', 'weapon', 18, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-spiker', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-spiker', 'universal-takedown', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-spiker', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-spiner', 'gf-alien-hives', 'Bio-Spiner', 'weapon', 6, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-bio-spiner', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-bio-tech-master', 'gf-alien-hives', 'Bio-Tech Master', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-brood-leader', 'gf-alien-hives', 'Brood Leader', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-burrow-attack', 'gf-alien-hives', 'Burrow Attack', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-burrowing-strike', 'gf-alien-hives', 'Burrowing Strike', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-carapace-fist', 'gf-alien-hives', 'Carapace Fist', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-carapace-fist', 'gf-alien-hives-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-carrier-titan', 'gf-alien-hives', 'Carrier Titan', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-caustic-cannon', 'gf-alien-hives', 'Caustic Cannon', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-caustic-cannon', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-caustic-cannon', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-combat-bio-engineer', 'gf-alien-hives', 'Combat Bio-Engineer', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-combat-mutations', 'gf-alien-hives', 'Combat Mutations', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-deep-deployment', 'gf-alien-hives', 'Deep Deployment', 'item', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-devourer-titan', 'gf-alien-hives', 'Devourer Titan', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment_grants (parent_equipment_id, granted_equipment_id) VALUES
  ('gf-alien-hives-devourer-titan', 'gf-alien-hives-titan-devouring-tongue');
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-devouring-tongue', 'gf-alien-hives', 'Devouring Tongue', 'weapon', 12, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-devouring-tongue', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-devouring-tongue', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-devouring-tongue', 'universal-takedown', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-explosive-spit', 'gf-alien-hives', 'Explosive Spit', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-explosive-spit', 'gf-alien-hives-blast', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-explosive-spit', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-fierceclaw-sword', 'gf-alien-hives', 'Fierceclaw Sword', 'weapon', 0, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-fierceclaw-sword', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-fierceclaw-sword', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-for-the-hive', 'gf-alien-hives', 'For the Hive!', 'item', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-fracture-cannon', 'gf-alien-hives', 'Fracture Cannon', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-fracture-cannon', 'gf-alien-hives-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-fracture-cannon', 'gf-alien-hives-deadly', 6);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-grasping-titan', 'gf-alien-hives', 'Grasping Titan', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment_grants (parent_equipment_id, granted_equipment_id) VALUES
  ('gf-alien-hives-grasping-titan', 'gf-alien-hives-titan-grasping-tongue');
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-acid-cannon', 'gf-alien-hives', 'Heavy Acid Cannon', 'weapon', 36, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-acid-cannon', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-acid-cannon', 'gf-alien-hives-deadly', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-acid-cannon', 'universal-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-barb-cannon', 'gf-alien-hives', 'Heavy Barb Cannon', 'weapon', 36, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-barb-cannon', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-barb-cannon', 'gf-alien-hives-blast', 6);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-claws', 'gf-alien-hives', 'Heavy Claws', 'weapon', 0, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-claws', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-claws', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-piercing-spike', 'gf-alien-hives', 'Heavy Piercing Spike', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-piercing-spike', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-piercing-spike', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-piercing-spike', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-psy-blast', 'gf-alien-hives', 'Heavy Psy-Blast', 'weapon', 18, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-psy-blast', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-psy-blast', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-psy-stinger', 'gf-alien-hives', 'Heavy Psy-Stinger', 'weapon', 18, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-psy-stinger', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-psy-stinger', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-psy-torrent', 'gf-alien-hives', 'Heavy Psy-Torrent', 'weapon', 9, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-psy-torrent', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-psy-torrent', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-psy-torrent', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-ravager-cannon', 'gf-alien-hives', 'Heavy Ravager Cannon', 'weapon', 18, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-ravager-cannon', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-ravager-cannon', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-ravager-gun', 'gf-alien-hives', 'Heavy Ravager Gun', 'weapon', 18, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-ravager-gun', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-ravager-gun', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-razor-claws', 'gf-alien-hives', 'Heavy Razor Claws', 'weapon', 0, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-razor-claws', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-serrated-blade', 'gf-alien-hives', 'Heavy Serrated Blade', 'weapon', 0, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-serrated-blade', 'gf-alien-hives-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-serrated-blade', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-shredder-cannon', 'gf-alien-hives', 'Heavy Shredder Cannon', 'weapon', 18, 8);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-shredder-cannon', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-slashing-blade', 'gf-alien-hives', 'Heavy Slashing Blade', 'weapon', 0, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-slashing-blade', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-slashing-blade', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-slashing-blade', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-smashing-club', 'gf-alien-hives', 'Heavy Smashing Club', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-smashing-club', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-smashing-club', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-smashing-club', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-heavy-spitter-cannon', 'gf-alien-hives', 'Heavy Spitter Cannon', 'weapon', 24, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-heavy-spitter-cannon', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-hive-protector', 'gf-alien-hives', 'Hive Protector', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-killing-scream', 'gf-alien-hives', 'Killing Scream', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-massive-spore-carrier', 'gf-alien-hives', 'Massive Spore Carrier', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-mind-hunter', 'gf-alien-hives', 'Mind Hunter', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-mind-snatcher', 'gf-alien-hives', 'Mind Snatcher', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-missile-bugs', 'gf-alien-hives', 'Missile Bugs', 'weapon', 36, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-missile-bugs', 'gf-alien-hives-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-missile-bugs', 'universal-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-molded-by-war', 'gf-alien-hives', 'Molded by War', 'item', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-pheromone-host', 'gf-alien-hives', 'Pheromone Host', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-piercing-claws', 'gf-alien-hives', 'Piercing Claws', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-piercing-claws', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-piercing-claws', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-piercing-spike', 'gf-alien-hives', 'Piercing Spike', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-piercing-spike', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-piercing-spike', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-plasma-bio-artillery', 'gf-alien-hives', 'Plasma Bio-Artillery', 'weapon', 36, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-plasma-bio-artillery', 'gf-alien-hives-blast', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-plasma-bio-artillery', 'gf-alien-hives-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-plasma-bio-artillery', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-poison-mist', 'gf-alien-hives', 'Poison Mist', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-poison-mist', 'gf-alien-hives-blast', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-poison-mist', 'gf-alien-hives-bane', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-poison-spurt', 'gf-alien-hives', 'Poison Spurt', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-poison-spurt', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-poison-spurt', 'gf-alien-hives-bane', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-psy-barrier', 'gf-alien-hives', 'Psy-Barrier', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-psy-blast', 'gf-alien-hives', 'Psy-Blast', 'weapon', 18, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psy-blast', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-psy-frenzy', 'gf-alien-hives', 'Psy-Frenzy', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-psy-shock', 'gf-alien-hives', 'Psy-Shock', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-psychic-emissary', 'gf-alien-hives', 'Psychic Emissary', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-psychic-synapses', 'gf-alien-hives', 'Psychic Synapses', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-psycho-breed', 'gf-alien-hives', 'Psycho Breed', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-rapid-heavy-ravager-cannon', 'gf-alien-hives', 'Rapid Heavy Ravager Cannon', 'weapon', 18, 12);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-rapid-heavy-ravager-cannon', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-rapid-heavy-ravager-cannon', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-ravager-bio-cannon', 'gf-alien-hives', 'Ravager Bio-Cannon', 'weapon', 24, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-ravager-bio-cannon', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-ravager-bio-cannon', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-ravager-gun', 'gf-alien-hives', 'Ravager Gun', 'weapon', 18, 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-razor-claws', 'gf-alien-hives', 'Razor Claws', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-razor-tendrils', 'gf-alien-hives', 'Razor Tendrils', 'weapon', 0, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-razor-tendrils', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-razor-whip', 'gf-alien-hives', 'Razor Whip', 'weapon', 0, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-razor-whip', 'gf-alien-hives-bane', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-razor-whip', 'gf-alien-hives-precise', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-rending-claws', 'gf-alien-hives', 'Rending Claws', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-rending-claws', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-serrated-blade', 'gf-alien-hives', 'Serrated Blade', 'weapon', 0, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-serrated-blade', 'gf-alien-hives-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-serrated-claws', 'gf-alien-hives', 'Serrated Claws', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-serrated-claws', 'gf-alien-hives-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-shock-harpoon', 'gf-alien-hives', 'Shock Harpoon', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shock-harpoon', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shock-harpoon', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-shooter-brood', 'gf-alien-hives', 'Shooter Brood', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-shredder-bio-artillery', 'gf-alien-hives', 'Shredder Bio-Artillery', 'weapon', 36, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shredder-bio-artillery', 'gf-alien-hives-blast', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shredder-bio-artillery', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shredder-bio-artillery', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-shredder-cannon', 'gf-alien-hives', 'Shredder Cannon', 'weapon', 18, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shredder-cannon', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-shredder-gun', 'gf-alien-hives', 'Shredder Gun', 'weapon', 18, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shredder-gun', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-shredder-gun-array', 'gf-alien-hives', 'Shredder Gun Array', 'weapon', 18, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shredder-gun-array', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-shrouding-mist', 'gf-alien-hives', 'Shrouding Mist', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-silent-assassin', 'gf-alien-hives', 'Silent Assassin', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-skewer-cannon', 'gf-alien-hives', 'Skewer Cannon', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-skewer-cannon', 'gf-alien-hives-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-skewer-cannon', 'universal-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-slashing-blade', 'gf-alien-hives', 'Slashing Blade', 'weapon', 0, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-slashing-blade', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-slashing-blade', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-slashing-claws', 'gf-alien-hives', 'Slashing Claws', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-slashing-claws', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-slashing-claws', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-smashing-claws', 'gf-alien-hives', 'Smashing Claws', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-smashing-claws', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-smashing-club', 'gf-alien-hives', 'Smashing Club', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-smashing-club', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-smashing-club', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spine-shooter', 'gf-alien-hives', 'Spine Shooter', 'weapon', 12, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spine-shooter', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spit-flames', 'gf-alien-hives', 'Spit Flames', 'weapon', 18, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spit-flames', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spit-flames', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spit-flames', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spitter-bio-artillery', 'gf-alien-hives', 'Spitter Bio-Artillery', 'weapon', 36, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spitter-bio-artillery', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spitter-bio-artillery', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spitter-bio-artillery', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spitter-cannon', 'gf-alien-hives', 'Spitter Cannon', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spitter-cannon', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spitter-gun', 'gf-alien-hives', 'Spitter Gun', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spitter-gun', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spitter-gun-array', 'gf-alien-hives', 'Spitter Gun Array', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spitter-gun-array', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spore-bombs', 'gf-alien-hives', 'Spore Bombs', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spore-bombs', 'gf-alien-hives-blast', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spore-bombs', 'gf-alien-hives-shred', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spore-bombs', 'gf-alien-hives-strafing', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spore-carrier', 'gf-alien-hives', 'Spore Carrier', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-spore-gun', 'gf-alien-hives', 'Spore Gun', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spore-gun', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spore-gun', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spore-gun', 'gf-alien-hives-shred', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-stinger-launcher', 'gf-alien-hives', 'Stinger Launcher', 'weapon', 18, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-stinger-launcher', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-stinger-spitter', 'gf-alien-hives', 'Stinger Spitter', 'weapon', 18, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-stinger-spitter', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-stomp', 'gf-alien-hives', 'Stomp', 'weapon', 0, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-stomp', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-swarm-attacks', 'gf-alien-hives', 'Swarm Attacks', 'weapon', 0, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-swarm-attacks', 'gf-alien-hives-bane', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-swarm-brood', 'gf-alien-hives', 'Swarm Brood', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-synapse-burrower', 'gf-alien-hives', 'Synapse Burrower', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-synaptic-relay', 'gf-alien-hives', 'Synaptic Relay', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-tendrils', 'gf-alien-hives', 'Tendrils', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-titan-devouring-tongue', 'gf-alien-hives', 'Titan Devouring Tongue', 'weapon', 18, 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-titan-grasping-tongue', 'gf-alien-hives', 'Titan Grasping Tongue', 'weapon', 18, 12);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-titanic-claws', 'gf-alien-hives', 'Titanic Claws', 'weapon', 0, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-titanic-claws', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-titanic-claws', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-titanic-heavy-claws', 'gf-alien-hives', 'Titanic Heavy Claws', 'weapon', 0, 18);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-titanic-heavy-claws', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-titanic-heavy-claws', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-toxic-cysts', 'gf-alien-hives', 'Toxic Cysts', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-toxic-spray', 'gf-alien-hives', 'Toxic Spray', 'weapon', 18, 12);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-toxic-spray', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-toxin-claws', 'gf-alien-hives', 'Toxin Claws', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-toxin-claws', 'gf-alien-hives-bane', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-toxin-cysts', 'gf-alien-hives', 'Toxin Cysts', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-twin-acid-launchers', 'gf-alien-hives', 'Twin Acid Launchers', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-twin-acid-launchers', 'gf-alien-hives-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-twin-acid-launchers', 'gf-alien-hives-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-twin-acid-launchers', 'universal-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-twin-barb-guns', 'gf-alien-hives', 'Twin Barb Guns', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-twin-barb-guns', 'gf-alien-hives-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-twin-barb-guns', 'gf-alien-hives-ap', 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-twin-spine-guns', 'gf-alien-hives', 'Twin Spine Guns', 'weapon', 12, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-twin-spine-guns', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-twin-stingers', 'gf-alien-hives', 'Twin Stingers', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-twin-stingers', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-twin-stingers', 'gf-alien-hives-rupture', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-venom-burrower', 'gf-alien-hives', 'Venom Burrower', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-veteran-bio-borer', 'gf-alien-hives', 'Veteran Bio-Borer', 'weapon', 12, 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-veteran-bio-ravager', 'gf-alien-hives', 'Veteran Bio-Ravager', 'weapon', 18, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-veteran-bio-ravager', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-veteran-bio-spiner', 'gf-alien-hives', 'Veteran Bio-Spiner', 'weapon', 6, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-veteran-bio-spiner', 'gf-alien-hives-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-warrior-emissary', 'gf-alien-hives', 'Warrior Emissary', 'item', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-whip-limbs', 'gf-alien-hives', 'Whip Limbs', 'weapon', 0, 8);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-whip-limbs', 'gf-alien-hives-bane', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-whip-limbs', 'gf-alien-hives-precise', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-winged-breed', 'gf-alien-hives', 'Winged Breed', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-winged-titan', 'gf-alien-hives', 'Winged Titan', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-alien-hives-wings', 'gf-alien-hives', 'Wings', 'mount', 0, 0);

-- Units
INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-hive-lord', 'gf-alien-hives', 'Hive Lord', 1, 345, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-lord', 'universal-fear', 2);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-lord', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-lord', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-lord', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-lord', 'universal-tough', 12);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-lord', 'gf-alien-hives-shredder-cannon', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-lord', 'gf-alien-hives-heavy-razor-claws', 2);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-lord', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-lord-grp-1', 'gf-alien-hives-hive-lord', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-lord-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-lord-grp-1-opt-0', 'gf-alien-hives-hive-lord-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-lord-grp-2', 'gf-alien-hives-hive-lord', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-lord-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-lord-grp-2-opt-0', 'gf-alien-hives-hive-lord-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-lord-grp-3', 'gf-alien-hives-hive-lord', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-lord-grp-3', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-lord-grp-3-opt-0', 'gf-alien-hives-hive-lord-grp-3', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-prime-warrior', 'gf-alien-hives', 'Prime Warrior', 1, 80, 4, 4, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-prime-warrior', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-prime-warrior', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-prime-warrior', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-prime-warrior', 'gf-alien-hives-shredder-gun', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-prime-warrior', 'gf-alien-hives-heavy-razor-claws', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-prime-warrior-grp-1', 'gf-alien-hives-prime-warrior', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-prime-warrior-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-prime-warrior-grp-1-opt-0', 'gf-alien-hives-prime-warrior-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-prime-warrior-grp-2', 'gf-alien-hives-prime-warrior', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-prime-warrior-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-prime-warrior-grp-2-opt-0', 'gf-alien-hives-prime-warrior-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-prime-warrior-grp-3', 'gf-alien-hives-prime-warrior', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-prime-warrior-grp-3', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-prime-warrior-grp-3-opt-0', 'gf-alien-hives-prime-warrior-grp-3', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-snatcher-lord', 'gf-alien-hives', 'Snatcher Lord', 1, 80, 3, 4, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-snatcher-lord', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-snatcher-lord', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-snatcher-lord', 'universal-scout', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-snatcher-lord', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-snatcher-lord', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-snatcher-lord', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-snatcher-lord', 'gf-alien-hives-heavy-claws', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-snatcher-lord-grp-1', 'gf-alien-hives-snatcher-lord', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-snatcher-lord-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-snatcher-lord-grp-1-opt-0', 'gf-alien-hives-snatcher-lord-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-grunt-veteran', 'gf-alien-hives', 'Grunt Veteran', 1, 20, 5, 5, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-grunt-veteran', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-grunt-veteran', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-grunt-veteran', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-grunt-veteran', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-grunt-veteran', 'gf-alien-hives-razor-claws', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-grunt-veteran-grp-1', 'gf-alien-hives-grunt-veteran', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-grunt-veteran-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-grunt-veteran-grp-1-opt-0', 'gf-alien-hives-grunt-veteran-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-grunt-veteran-grp-2', 'gf-alien-hives-grunt-veteran', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-grunt-veteran-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-grunt-veteran-grp-2-opt-0', 'gf-alien-hives-grunt-veteran-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-assault-grunts', 'gf-alien-hives', 'Assault Grunts', 10, 110, 5, 5, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-assault-grunts', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-assault-grunts', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-assault-grunts', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-assault-grunts', 'gf-alien-hives-razor-claws', 10);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-assault-grunts-grp-1', 'gf-alien-hives-assault-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-assault-grunts-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-assault-grunts-grp-1-opt-0', 'gf-alien-hives-assault-grunts-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-assault-grunts-grp-2', 'gf-alien-hives-assault-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-assault-grunts-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-assault-grunts-grp-2-opt-0', 'gf-alien-hives-assault-grunts-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-shooter-grunts', 'gf-alien-hives', 'Shooter Grunts', 10, 110, 5, 5, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shooter-grunts', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shooter-grunts', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-shooter-grunts', 'gf-alien-hives-bio-spiner', 10);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-shooter-grunts', 'gf-alien-hives-razor-claws', 10);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-shooter-grunts-grp-1', 'gf-alien-hives-shooter-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-shooter-grunts-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-shooter-grunts-grp-1-opt-0', 'gf-alien-hives-shooter-grunts-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-shooter-grunts-grp-2', 'gf-alien-hives-shooter-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-shooter-grunts-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-shooter-grunts-grp-2-opt-0', 'gf-alien-hives-shooter-grunts-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-psycho-grunts', 'gf-alien-hives', 'Psycho-Grunts', 10, 110, 5, 5, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-grunts', 'gf-alien-hives-resistance', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-grunts', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-grunts', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-psycho-grunts', 'gf-alien-hives-rending-claws', 10);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-psycho-grunts-grp-1', 'gf-alien-hives-psycho-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-psycho-grunts-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-psycho-grunts-grp-1-opt-0', 'gf-alien-hives-psycho-grunts-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-psycho-grunts-grp-2', 'gf-alien-hives-psycho-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-psycho-grunts-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-psycho-grunts-grp-2-opt-0', 'gf-alien-hives-psycho-grunts-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-winged-grunts', 'gf-alien-hives', 'Winged Grunts', 10, 130, 5, 5, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-winged-grunts', 'gf-alien-hives-ambush', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-winged-grunts', 'universal-flying', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-winged-grunts', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-winged-grunts', 'gf-alien-hives-bio-spiner', 10);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-winged-grunts', 'gf-alien-hives-razor-claws', 10);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-winged-grunts-grp-1', 'gf-alien-hives-winged-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-winged-grunts-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-winged-grunts-grp-1-opt-0', 'gf-alien-hives-winged-grunts-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-winged-grunts-grp-2', 'gf-alien-hives-winged-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-winged-grunts-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-winged-grunts-grp-2-opt-0', 'gf-alien-hives-winged-grunts-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-support-grunts', 'gf-alien-hives', 'Support Grunts', 3, 140, 5, 5, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-support-grunts', 'universal-relentless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-support-grunts', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-support-grunts', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-support-grunts', 'gf-alien-hives-ravager-bio-cannon', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-support-grunts', 'gf-alien-hives-razor-claws', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-support-grunts-grp-1', 'gf-alien-hives-support-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-support-grunts-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-support-grunts-grp-1-opt-0', 'gf-alien-hives-support-grunts-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-support-grunts-grp-2', 'gf-alien-hives-support-grunts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-support-grunts-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-support-grunts-grp-2-opt-0', 'gf-alien-hives-support-grunts-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-soul-snatchers', 'gf-alien-hives', 'Soul-Snatchers', 5, 160, 3, 4, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-soul-snatchers', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-soul-snatchers', 'universal-scout', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-soul-snatchers', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-soul-snatchers', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-soul-snatchers', 'gf-alien-hives-heavy-claws', 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-soul-snatchers-grp-1', 'gf-alien-hives-soul-snatchers', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-soul-snatchers-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-soul-snatchers-grp-1-opt-0', 'gf-alien-hives-soul-snatchers-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-hive-swarms', 'gf-alien-hives', 'Hive Swarms', 3, 70, 5, 6, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-swarms', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-swarms', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-swarms', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-swarms', 'gf-alien-hives-swarm-attacks', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-swarms-grp-1', 'gf-alien-hives-hive-swarms', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-swarms-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-swarms-grp-1-opt-0', 'gf-alien-hives-hive-swarms-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-hive-warriors', 'gf-alien-hives', 'Hive Warriors', 3, 110, 4, 4, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-warriors', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-warriors', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-warriors', 'gf-alien-hives-razor-claws', 6);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-warriors-grp-1', 'gf-alien-hives-hive-warriors', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-warriors-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-warriors-grp-1-opt-0', 'gf-alien-hives-hive-warriors-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-warriors-grp-2', 'gf-alien-hives-hive-warriors', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-warriors-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-warriors-grp-2-opt-0', 'gf-alien-hives-hive-warriors-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-ravenous-beasts', 'gf-alien-hives', 'Ravenous Beasts', 3, 135, 4, 4, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-ravenous-beasts', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-ravenous-beasts', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-ravenous-beasts', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-ravenous-beasts', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-ravenous-beasts', 'gf-alien-hives-razor-claws', 6);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-ravenous-beasts-grp-1', 'gf-alien-hives-ravenous-beasts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-ravenous-beasts-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-ravenous-beasts-grp-1-opt-0', 'gf-alien-hives-ravenous-beasts-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-ravenous-beasts-grp-2', 'gf-alien-hives-ravenous-beasts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-ravenous-beasts-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-ravenous-beasts-grp-2-opt-0', 'gf-alien-hives-ravenous-beasts-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-venom-beasts', 'gf-alien-hives', 'Venom Beasts', 3, 150, 4, 4, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-venom-beasts', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-venom-beasts', 'gf-alien-hives-regeneration', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-venom-beasts', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-venom-beasts', 'gf-alien-hives-poison-spurt', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-venom-beasts', 'gf-alien-hives-toxin-claws', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-venom-beasts-grp-1', 'gf-alien-hives-venom-beasts', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-venom-beasts-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-venom-beasts-grp-1-opt-0', 'gf-alien-hives-venom-beasts-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-hive-guardians', 'gf-alien-hives', 'Hive Guardians', 3, 150, 3, 3, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-guardians', 'universal-relentless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-guardians', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-guardians', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-guardians', 'gf-alien-hives-razor-claws', 6);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-guardians-grp-1', 'gf-alien-hives-hive-guardians', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-guardians-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-guardians-grp-1-opt-0', 'gf-alien-hives-hive-guardians-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-guardians-grp-2', 'gf-alien-hives-hive-guardians', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-guardians-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-guardians-grp-2-opt-0', 'gf-alien-hives-hive-guardians-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-shadow-leapers', 'gf-alien-hives', 'Shadow Leapers', 3, 190, 3, 4, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-leapers', 'gf-alien-hives-stealth', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-leapers', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-leapers', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-leapers', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-leapers', 'universal-scout', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-shadow-leapers', 'gf-alien-hives-razor-claws', 6);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-shadow-leapers-grp-1', 'gf-alien-hives-shadow-leapers', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-shadow-leapers-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-shadow-leapers-grp-1-opt-0', 'gf-alien-hives-shadow-leapers-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-synapse-beasts', 'gf-alien-hives', 'Synapse Beasts', 3, 200, 4, 4, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-beasts', 'gf-alien-hives-caster-group', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-beasts', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-beasts', 'gf-alien-hives-resistance', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-beasts', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-synapse-beasts', 'gf-alien-hives-psy-blast', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-synapse-beasts', 'gf-alien-hives-psy-shock', 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-spores', 'gf-alien-hives', 'Spores', 5, 75, 6, 6, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spores', 'gf-alien-hives-self-destruct', 2);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spores', 'gf-alien-hives-no-retreat', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spores', 'universal-slow', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-spores', 'gf-alien-hives-tendrils', 5);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-massive-spores', 'gf-alien-hives', 'Massive Spores', 3, 145, 6, 6, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-massive-spores', 'gf-alien-hives-self-destruct', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-massive-spores', 'gf-alien-hives-no-retreat', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-massive-spores', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-massive-spores', 'universal-slow', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-massive-spores', 'gf-alien-hives-tendrils', 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-shadow-hunter', 'gf-alien-hives', 'Shadow Hunter', 1, 150, 3, 4, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-hunter', 'universal-fear', 1);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-hunter', 'gf-alien-hives-stealth', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-hunter', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-hunter', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-hunter', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-shadow-hunter', 'gf-alien-hives-infiltrate', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-shadow-hunter', 'gf-alien-hives-heavy-razor-claws', 2);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-shadow-hunter-grp-1', 'gf-alien-hives-shadow-hunter', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-shadow-hunter-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-shadow-hunter-grp-1-opt-0', 'gf-alien-hives-shadow-hunter-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-shadow-hunter-grp-2', 'gf-alien-hives-shadow-hunter', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-shadow-hunter-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-shadow-hunter-grp-2-opt-0', 'gf-alien-hives-shadow-hunter-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-mortar-beast', 'gf-alien-hives', 'Mortar Beast', 1, 155, 4, 3, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-mortar-beast', 'universal-fear', 1);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-mortar-beast', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-mortar-beast', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-mortar-beast', 'gf-alien-hives-spore-gun', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-mortar-beast', 'gf-alien-hives-heavy-razor-claws', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-mortar-beast', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-mortar-beast-grp-1', 'gf-alien-hives-mortar-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-mortar-beast-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-mortar-beast-grp-1-opt-0', 'gf-alien-hives-mortar-beast-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-synapse-tyrant', 'gf-alien-hives', 'Synapse Tyrant', 1, 180, 4, 4, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-tyrant', 'gf-alien-hives-caster', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-tyrant', 'universal-fear', 1);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-tyrant', 'gf-alien-hives-resistance', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-tyrant', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-synapse-tyrant', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-synapse-tyrant', 'gf-alien-hives-heavy-psy-stinger', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-synapse-tyrant', 'gf-alien-hives-psy-shock', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-synapse-tyrant-grp-1', 'gf-alien-hives-synapse-tyrant', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-synapse-tyrant-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-synapse-tyrant-grp-1-opt-0', 'gf-alien-hives-synapse-tyrant-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-flamer-beast', 'gf-alien-hives', 'Flamer Beast', 1, 185, 4, 3, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-flamer-beast', 'universal-fear', 1);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-flamer-beast', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-flamer-beast', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-flamer-beast', 'gf-alien-hives-spit-flames', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-flamer-beast', 'gf-alien-hives-heavy-razor-claws', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-flamer-beast', 'gf-alien-hives-stomp', 1);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-carnivo-rex', 'gf-alien-hives', 'Carnivo-Rex', 1, 280, 4, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-carnivo-rex', 'universal-fear', 2);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-carnivo-rex', 'universal-tough', 12);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-carnivo-rex', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-carnivo-rex', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-carnivo-rex', 'gf-alien-hives-heavy-razor-claws', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-carnivo-rex', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-carnivo-rex-grp-1', 'gf-alien-hives-carnivo-rex', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-carnivo-rex-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-carnivo-rex-grp-1-opt-0', 'gf-alien-hives-carnivo-rex-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-carnivo-rex-grp-2', 'gf-alien-hives-carnivo-rex', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-carnivo-rex-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-carnivo-rex-grp-2-opt-0', 'gf-alien-hives-carnivo-rex-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-carnivo-rex-grp-3', 'gf-alien-hives-carnivo-rex', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-carnivo-rex-grp-3', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-carnivo-rex-grp-3-opt-0', 'gf-alien-hives-carnivo-rex-grp-3', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-toxico-rex', 'gf-alien-hives', 'Toxico-Rex', 1, 365, 4, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-toxico-rex', 'universal-fear', 2);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-toxico-rex', 'universal-tough', 12);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-toxico-rex', 'gf-alien-hives-regeneration', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-toxico-rex', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-toxico-rex', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-toxico-rex', 'gf-alien-hives-acid-spurt', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-toxico-rex', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-toxico-rex', 'gf-alien-hives-whip-limbs', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-toxico-rex-grp-1', 'gf-alien-hives-toxico-rex', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-toxico-rex-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-toxico-rex-grp-1-opt-0', 'gf-alien-hives-toxico-rex-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-psycho-rex', 'gf-alien-hives', 'Psycho-Rex', 1, 400, 4, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-rex', 'gf-alien-hives-caster', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-rex', 'universal-fear', 2);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-rex', 'universal-tough', 12);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-rex', 'gf-alien-hives-resistance', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-rex', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-psycho-rex', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-psycho-rex', 'gf-alien-hives-heavy-psy-stinger', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-psycho-rex', 'gf-alien-hives-heavy-razor-claws', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-psycho-rex', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-psycho-rex-grp-1', 'gf-alien-hives-psycho-rex', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-psycho-rex-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-psycho-rex-grp-1-opt-0', 'gf-alien-hives-psycho-rex-grp-1', 'gf-alien-hives-heavy-razor-claws', 25, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-psycho-rex-grp-2', 'gf-alien-hives-psycho-rex', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-psycho-rex-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-psycho-rex-grp-2-opt-0', 'gf-alien-hives-psycho-rex-grp-2', 'gf-alien-hives-heavy-razor-claws', 25, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-hive-burrower', 'gf-alien-hives', 'Hive Burrower', 1, 385, 4, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-burrower', 'universal-fear', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-burrower', 'universal-tough', 15);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-burrower', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-burrower', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-burrower', 'gf-alien-hives-heavy-razor-claws', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-burrower', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-burrower', 'gf-alien-hives-deep-deployment', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-burrower-grp-1', 'gf-alien-hives-hive-burrower', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-burrower-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-burrower-grp-1-opt-0', 'gf-alien-hives-hive-burrower-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-burrower-grp-2', 'gf-alien-hives-hive-burrower', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-burrower-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-burrower-grp-2-opt-0', 'gf-alien-hives-hive-burrower-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-tyrant-heavy-beast', 'gf-alien-hives', 'Tyrant Heavy Beast', 1, 440, 4, 2, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-tyrant-heavy-beast', 'universal-fear', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-tyrant-heavy-beast', 'universal-tough', 15);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-tyrant-heavy-beast', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-tyrant-heavy-beast', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-tyrant-heavy-beast', 'gf-alien-hives-bio-pod', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-tyrant-heavy-beast', 'gf-alien-hives-stinger-launcher', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-tyrant-heavy-beast', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-1', 'gf-alien-hives-tyrant-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-1-opt-0', 'gf-alien-hives-tyrant-heavy-beast-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-2', 'gf-alien-hives-tyrant-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-2-opt-0', 'gf-alien-hives-tyrant-heavy-beast-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-3', 'gf-alien-hives-tyrant-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-3', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-tyrant-heavy-beast-grp-3-opt-0', 'gf-alien-hives-tyrant-heavy-beast-grp-3', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-spawning-heavy-beast', 'gf-alien-hives', 'Spawning Heavy Beast', 1, 445, 4, 2, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spawning-heavy-beast', 'universal-fear', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spawning-heavy-beast', 'universal-tough', 15);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spawning-heavy-beast', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-spawning-heavy-beast', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-spawning-heavy-beast', 'gf-alien-hives-stinger-launcher', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-spawning-heavy-beast', 'gf-alien-hives-heavy-razor-claws', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-spawning-heavy-beast', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-1', 'gf-alien-hives-spawning-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-1-opt-0', 'gf-alien-hives-spawning-heavy-beast-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-2', 'gf-alien-hives-spawning-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-2-opt-0', 'gf-alien-hives-spawning-heavy-beast-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-3', 'gf-alien-hives-spawning-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-3', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-spawning-heavy-beast-grp-3-opt-0', 'gf-alien-hives-spawning-heavy-beast-grp-3', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-devourer-heavy-beast', 'gf-alien-hives', 'Devourer Heavy Beast', 1, 430, 4, 2, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-devourer-heavy-beast', 'universal-fear', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-devourer-heavy-beast', 'universal-tough', 15);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-devourer-heavy-beast', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-devourer-heavy-beast', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-devourer-heavy-beast', 'gf-alien-hives-devouring-tongue', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-devourer-heavy-beast', 'gf-alien-hives-heavy-razor-claws', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-devourer-heavy-beast', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-devourer-heavy-beast-grp-1', 'gf-alien-hives-devourer-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-devourer-heavy-beast-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-devourer-heavy-beast-grp-1-opt-0', 'gf-alien-hives-devourer-heavy-beast-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-devourer-heavy-beast-grp-2', 'gf-alien-hives-devourer-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-devourer-heavy-beast-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-devourer-heavy-beast-grp-2-opt-0', 'gf-alien-hives-devourer-heavy-beast-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-artillery-heavy-beast', 'gf-alien-hives', 'Artillery Heavy Beast', 1, 570, 4, 2, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-artillery-heavy-beast', 'universal-fear', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-artillery-heavy-beast', 'universal-tough', 15);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-artillery-heavy-beast', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-artillery-heavy-beast', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-artillery-heavy-beast', 'gf-alien-hives-shredder-bio-artillery', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-artillery-heavy-beast', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-artillery-heavy-beast-grp-1', 'gf-alien-hives-artillery-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-artillery-heavy-beast-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-artillery-heavy-beast-grp-1-opt-0', 'gf-alien-hives-artillery-heavy-beast-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-artillery-heavy-beast-grp-2', 'gf-alien-hives-artillery-heavy-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-artillery-heavy-beast-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-artillery-heavy-beast-grp-2-opt-0', 'gf-alien-hives-artillery-heavy-beast-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-invasion-carrier-spore', 'gf-alien-hives', 'Invasion Carrier Spore', 1, 120, 4, 3, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-carrier-spore', 'gf-alien-hives-ambush', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-carrier-spore', 'universal-slow', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-carrier-spore', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-carrier-spore', 'universal-transport', 11);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-carrier-spore', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-invasion-carrier-spore', 'gf-alien-hives-razor-tendrils', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-invasion-carrier-spore-grp-1', 'gf-alien-hives-invasion-carrier-spore', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-invasion-carrier-spore-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-invasion-carrier-spore-grp-1-opt-0', 'gf-alien-hives-invasion-carrier-spore-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-invasion-artillery-spore', 'gf-alien-hives', 'Invasion Artillery Spore', 1, 170, 4, 3, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-artillery-spore', 'gf-alien-hives-ambush', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-artillery-spore', 'universal-artillery', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-artillery-spore', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-invasion-artillery-spore', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-invasion-artillery-spore', 'gf-alien-hives-spore-gun', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-invasion-artillery-spore', 'gf-alien-hives-razor-tendrils', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-invasion-artillery-spore-grp-1', 'gf-alien-hives-invasion-artillery-spore', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-invasion-artillery-spore-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-invasion-artillery-spore-grp-1-opt-0', 'gf-alien-hives-invasion-artillery-spore-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-invasion-artillery-spore-grp-2', 'gf-alien-hives-invasion-artillery-spore', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-invasion-artillery-spore-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-invasion-artillery-spore-grp-2-opt-0', 'gf-alien-hives-invasion-artillery-spore-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-rapacious-beast', 'gf-alien-hives', 'Rapacious Beast', 1, 225, 4, 2, 'beast');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-rapacious-beast', 'universal-aircraft', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-rapacious-beast', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-rapacious-beast', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-rapacious-beast', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-rapacious-beast', 'gf-alien-hives-caustic-cannon', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-rapacious-beast', 'gf-alien-hives-spore-bombs', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-rapacious-beast-grp-1', 'gf-alien-hives-rapacious-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-rapacious-beast-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-rapacious-beast-grp-1-opt-0', 'gf-alien-hives-rapacious-beast-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-rapacious-beast-grp-2', 'gf-alien-hives-rapacious-beast', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-rapacious-beast-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-rapacious-beast-grp-2-opt-0', 'gf-alien-hives-rapacious-beast-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-hive-titan', 'gf-alien-hives', 'Hive Titan', 1, 645, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-titan', 'universal-fear', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-titan', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-titan', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-hive-titan', 'universal-tough', 18);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-titan', 'gf-alien-hives-stomp', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-titan', 'gf-alien-hives-titanic-heavy-claws', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-hive-titan', 'gf-alien-hives-warrior-emissary', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-titan-grp-1', 'gf-alien-hives-hive-titan', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-titan-grp-1', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-titan-grp-1-opt-0', 'gf-alien-hives-hive-titan-grp-1', 'gf-alien-hives-heavy-razor-claws', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-alien-hives-hive-titan-grp-2', 'gf-alien-hives-hive-titan', 'Replace Heavy Psy-Stinger', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-alien-hives-hive-titan-grp-2', 'gf-alien-hives-heavy-psy-stinger');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-alien-hives-hive-titan-grp-2-opt-0', 'gf-alien-hives-hive-titan-grp-2', 'gf-alien-hives-heavy-razor-claws', 0, 0);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-druzhak', 'gf-alien-hives', 'Druzhak', 1, 115, 4, 4, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-druzhak', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-druzhak', 'universal-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-druzhak', 'gf-alien-hives-unique', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-druzhak', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-druzhak', 'gf-alien-hives-carapace-fist', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-druzhak', 'gf-alien-hives-fierceclaw-sword', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-druzhak', 'gf-alien-hives-molded-by-war', 1);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-alien-hives-vradhez', 'gf-alien-hives', 'Vradhez', 1, 125, 3, 4, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-vradhez', 'gf-alien-hives-caster', 2);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-vradhez', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-vradhez', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-vradhez', 'universal-scout', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-vradhez', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-vradhez', 'universal-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-vradhez', 'gf-alien-hives-unique', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-alien-hives-vradhez', 'gf-alien-hives-hive-bond', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-vradhez', 'gf-alien-hives-twin-stingers', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-alien-hives-vradhez', 'gf-alien-hives-for-the-hive', 1);

