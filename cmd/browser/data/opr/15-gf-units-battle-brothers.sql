-- ============================================================================
-- Army: Battle Brothers
-- Generated from OPR API
-- ============================================================================

-- Universe
INSERT OR IGNORE INTO opr_universes (id, name) VALUES ('grimdark-future', 'Grimdark Future');

-- Army
INSERT OR IGNORE INTO opr_armies (id, universe_id, name, version, background) VALUES
  ('gf-battle-brothers', 'grimdark-future', 'Battle Brothers', '3.5.1', 'The Battle Brothers are superhuman warriors that have been empowered through gene-mods and special training to bring about their Founder’s vision of an uplifted humanity. 

Their pursuit of this vision at any cost led to a violent civil war which nearly destroyed humanity itself, and in pursuit of their enemies fleeing this conflict, they found themselves lost in the Sirius Sector. The Battle Brothers have not relented however, and they go to any length to unite and uplift all of humanity.');

-- Special Rules
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-melee-shrouding-aura', 'Melee Shrouding Aura', 'This model and its unit get Melee Shrouding.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-shielded', 'Shielded', 'Units where all models have this rule get +1 to defense rolls against hits that are not from spells.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-re-deployment', 'Re-Deployment', 'After all other units are deployed (excluding units that were set aside), you may remove up to two friendly units from the table and deploy them again. Players alternate in placing Re-Deployment units, starting with the player that activates next.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-mend', 'Mend', 'Once per activation, pick one friendly model within 3" with Tough, and remove D3 wounds from it.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-versatile-attack', 'Versatile Attack', 'When this unit is activated, pick one effect: until the end of the activation all models with this rule in it either get AP(+1) when attacking, or get +1 to hit rolls when attacking.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-bane-when-shooting-aura', 'Bane when Shooting Aura', 'This model and its unit get Bane when shooting.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-regeneration-aura', 'Regeneration Aura', 'This model and its unit get Regeneration.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-rapid-rush-aura', 'Rapid Rush Aura', 'This model and its unit get Rapid Rush.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-bane-in-melee-aura', 'Bane in Melee Aura', 'This model and its unit get Bane in melee.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-battleborn', 'Battleborn', 'If a unit where all models have this rule is Shaken at the beginning of the round, roll one die. On a 4+, it stops being Shaken.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-smash', 'Smash', 'Ignores Regeneration, and against units where most models have Defense 5+ to Defense 6+, this weapon gets Blast(+3).', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-unstoppable-shooting-mark', 'Unstoppable Shooting Mark', 'Once per activation, before attacking, pick one enemy unit within 18", which friendly units gets Unstoppable when shooting against once (next time the effect would apply).', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-re-position-artillery', 'Re-Position Artillery', 'Once per activation, pick one friendly model within 6" with Artillery, which may immediately move by up to 9".

', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-versatile-reach-aura', 'Versatile Reach Aura', 'This model and its unit get Versatile Reach.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-courage-aura', 'Courage Aura', 'This model and its unit get +1 to morale test rolls.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-melee-shrouding', 'Melee Shrouding', 'Enemies get -3" movement when trying to charge units where all models have this rule.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-tough', 'Tough', 'This model must take X wounds before being killed. If a model with tough joins a unit without it, then it is removed last when the unit takes wounds. You must continue to put wounds on the tough model with most wounds in the unit until it is killed, before starting to put them on the next tough model (heroes must be assigned wounds last, even if already wounded).', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-ap', 'AP', 'Targets get -X to Defense rolls when blocking hits.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-bane', 'Bane', 'Ignores Regeneration, and when attacking the target must re-roll unmodified Defense results of 6.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-regeneration', 'Regeneration', 'When a unit where all models have this rule takes wounds, roll one die for each. On a 5+ it is ignored.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-rapid-rush', 'Rapid Rush', 'This model moves +6" when using Rush actions.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-ignores-regeneration', 'Ignores Regeneration', 'This weapon ignores Regeneration.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-defense', 'Defense', 'This model gets +X to defense rolls.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-blast', 'Blast', 'Ignores cover, and after resolving other special rules, each hit is multiplied by X, where X is up to as many hits as models in the target unit.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-unstoppable', 'Unstoppable', 'Ignores Regeneration, and ignores all negative modifiers to this weapon.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-artillery', 'Artillery', 'May only use Hold actions. When this model shoots at enemies over 9" away, it gets +1 to hit rolls. When enemy units shoot at this model from over 9" away, they get -2 to hit rolls.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-versatile-reach', 'Versatile Reach', 'When this unit is activated, pick one effect: until the end of the activation all models with this rule in it either get +4" range when shooting, or move +2" when charging.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-shred', 'Shred', 'On unmodified results of 1 to block hits, this weapon deals 1 extra wound.', 'gf-battle-brothers');
INSERT OR IGNORE INTO opr_special_rules (id, name, description, army_id) VALUES
  ('gf-battle-brothers-evasive', 'Evasive', 'Enemies get -1 to hit rolls when attacking units where all models have this rule.', 'gf-battle-brothers');

-- Equipment
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-archivist', 'gf-battle-brothers', 'Archivist', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-artillerist', 'gf-battle-brothers', 'Artillerist', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-bash', 'gf-battle-brothers', 'Bash', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-camo-cloak', 'gf-battle-brothers', 'Camo Cloak', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-camo-cloaks', 'gf-battle-brothers', 'Camo Cloaks', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-captain', 'gf-battle-brothers', 'Captain', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-ccw', 'gf-battle-brothers', 'CCW', 'weapon', 0, 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-chain-fist', 'gf-battle-brothers', 'Chain-Fist', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-chain-fist', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-chain-fist', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-chest-missiles', 'gf-battle-brothers', 'Chest Missiles', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-chest-missiles', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-chest-missiles', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-chest-rifles', 'gf-battle-brothers', 'Chest-Rifles', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-chest-rifles', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-combat-bike', 'gf-battle-brothers', 'Combat Bike', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment_grants (parent_equipment_id, granted_equipment_id) VALUES
  ('gf-battle-brothers-combat-bike', 'gf-battle-brothers-twin-heavy-rifle');
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-combat-shield', 'gf-battle-brothers', 'Combat Shield', 'item', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-commander', 'gf-battle-brothers', 'Commander', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-crew', 'gf-battle-brothers', 'Crew', 'weapon', 0, 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-cyclone-missiles', 'gf-battle-brothers', 'Cyclone Missiles', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-cyclone-missiles', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-cyclone-missiles', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-cyclone-missiles', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-death-launcher', 'gf-battle-brothers', 'Death Launcher', 'weapon', 18, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-death-launcher', 'gf-battle-brothers-blast', 6);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-demolition-cannon', 'gf-battle-brothers', 'Demolition Cannon', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-demolition-cannon', 'gf-battle-brothers-blast', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-demolition-cannon', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-demolition-cannon', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-detachment-banner', 'gf-battle-brothers', 'Detachment Banner', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-dozer-blade', 'gf-battle-brothers', 'Dozer Blade', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-dual-combat-drills', 'gf-battle-brothers', 'Dual Combat Drills', 'weapon', 0, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-dual-combat-drills', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-dual-energy-claws', 'gf-battle-brothers', 'Dual Energy Claws', 'weapon', 0, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-dual-energy-claws', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-dual-heavy-fists', 'gf-battle-brothers', 'Dual Heavy Fists', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-dual-heavy-fists', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-energy-fist', 'gf-battle-brothers', 'Energy Fist', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-energy-fist', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-energy-hammer', 'gf-battle-brothers', 'Energy Hammer', 'weapon', 0, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-energy-hammer', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-energy-sword', 'gf-battle-brothers', 'Energy Sword', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-energy-sword', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-energy-sword', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-engineer', 'gf-battle-brothers', 'Engineer', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-flamer', 'gf-battle-brothers', 'Flamer', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-flamer', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-flamer', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-flamer-mod', 'gf-battle-brothers', 'Flamer-Mod', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-flamer-mod', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-flamer-mod', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-flamer-mod', 'universal-limited', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-flamer-pistol', 'gf-battle-brothers', 'Flamer Pistol', 'weapon', 6, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-flamer-pistol', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-flamer-pistol', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-forward-sentries', 'gf-battle-brothers', 'Forward Sentries', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-forward-sentry', 'gf-battle-brothers', 'Forward Sentry', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-fusion-mod', 'gf-battle-brothers', 'Fusion-Mod', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-fusion-mod', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-fusion-mod', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-fusion-mod', 'universal-limited', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-fusion-pistol', 'gf-battle-brothers', 'Fusion Pistol', 'weapon', 6, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-fusion-pistol', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-fusion-pistol', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-fusion-rifle', 'gf-battle-brothers', 'Fusion Rifle', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-fusion-rifle', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-fusion-rifle', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-gravity-cannon', 'gf-battle-brothers', 'Gravity Cannon', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-cannon', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-cannon', 'gf-battle-brothers-smash', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-gravity-mod', 'gf-battle-brothers', 'Gravity-Mod', 'weapon', 18, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-mod', 'universal-limited', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-mod', 'gf-battle-brothers-smash', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-mod', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-gravity-pistol', 'gf-battle-brothers', 'Gravity Pistol', 'weapon', 9, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-pistol', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-pistol', 'gf-battle-brothers-smash', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-gravity-rifle', 'gf-battle-brothers', 'Gravity Rifle', 'weapon', 18, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-rifle', 'gf-battle-brothers-smash', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-gravity-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-grenade-launcher', 'gf-battle-brothers', 'Grenade Launcher', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-grenade-launcher', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-guardian', 'gf-battle-brothers', 'Guardian', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-ccw', 'gf-battle-brothers', 'Heavy CCW', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-ccw', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-chainsaw-sword', 'gf-battle-brothers', 'Heavy Chainsaw Sword', 'weapon', 0, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-chainsaw-sword', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-crack-cannon', 'gf-battle-brothers', 'Heavy Crack Cannon', 'weapon', 30, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-crack-cannon', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-crack-cannon', 'universal-rending', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-crack-cannon', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-flak-cannon', 'gf-battle-brothers', 'Heavy Flak Cannon', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-flak-cannon', 'gf-battle-brothers-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-flak-cannon', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-flak-cannon', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-flamer', 'gf-battle-brothers', 'Heavy Flamer', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-flamer', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-flamer', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-flamer', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-fusion-rifle', 'gf-battle-brothers', 'Heavy Fusion Rifle', 'weapon', 18, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-fusion-rifle', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-fusion-rifle', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-gatling-cannon', 'gf-battle-brothers', 'Heavy Gatling Cannon', 'weapon', 24, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-gatling-cannon', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-machinegun', 'gf-battle-brothers', 'Heavy Machinegun', 'weapon', 30, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-machinegun', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-minigun', 'gf-battle-brothers', 'Heavy Minigun', 'weapon', 24, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-minigun', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-pistol', 'gf-battle-brothers', 'Heavy Pistol', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-pistol', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-plasma-cannon', 'gf-battle-brothers', 'Heavy Plasma Cannon', 'weapon', 30, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-plasma-cannon', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-plasma-cannon', 'gf-battle-brothers-blast', 6);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-rifle', 'gf-battle-brothers', 'Heavy Rifle', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-rifle-array', 'gf-battle-brothers', 'Heavy Rifle Array', 'weapon', 24, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-rifle-array', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-heavy-thunder-cannon', 'gf-battle-brothers', 'Heavy Thunder Cannon', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-thunder-cannon', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-thunder-cannon', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-thunder-cannon', 'universal-indirect', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-hunter-missiles', 'gf-battle-brothers', 'Hunter Missiles', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-hunter-missiles', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-hunter-missiles', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-hunter-missiles', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-hunter-missiles', 'universal-limited', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-jetpack', 'gf-battle-brothers', 'Jetpack', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-jetpacks', 'gf-battle-brothers', 'Jetpacks', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-laser-cannon', 'gf-battle-brothers', 'Laser Cannon', 'weapon', 36, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-laser-cannon', 'gf-battle-brothers-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-laser-cannon', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-laser-talon', 'gf-battle-brothers', 'Laser Talon', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-laser-talon', 'gf-battle-brothers-ap', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-lieutenant', 'gf-battle-brothers', 'Lieutenant', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-light-heavy-rifle-array', 'gf-battle-brothers', 'Light Heavy Rifle Array', 'weapon', 24, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-light-heavy-rifle-array', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-master-archivist', 'gf-battle-brothers', 'Master Archivist', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-master-heavy-pistol', 'gf-battle-brothers', 'Master Heavy Pistol', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-heavy-pistol', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-master-heavy-rifle', 'gf-battle-brothers', 'Master Heavy Rifle', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-heavy-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-master-plasma-pistol', 'gf-battle-brothers', 'Master Plasma Pistol', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-plasma-pistol', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-master-shotgun', 'gf-battle-brothers', 'Master Shotgun', 'weapon', 12, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-shotgun', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-master-sniper-rifle', 'gf-battle-brothers', 'Master Sniper Rifle', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-sniper-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-sniper-rifle', 'universal-takedown', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-sniper-rifle', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-master-storm-rifle', 'gf-battle-brothers', 'Master Storm Rifle', 'weapon', 24, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-storm-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-medical-training', 'gf-battle-brothers', 'Medical Training', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-minigun', 'gf-battle-brothers', 'Minigun', 'weapon', 24, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-minigun', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-missile-array', 'gf-battle-brothers', 'Missile Array', 'weapon', 30, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-missile-array', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-missile-array', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-missile-launcher', 'gf-battle-brothers', 'Missile Launcher', 'weapon', 30, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-missile-launcher', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-missile-launcher', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-missile-launcher', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-open-sides', 'gf-battle-brothers', 'Open Sides', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-plasma-cannon', 'gf-battle-brothers', 'Plasma Cannon', 'weapon', 30, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-plasma-cannon', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-plasma-cannon', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-plasma-mod', 'gf-battle-brothers', 'Plasma-Mod', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-plasma-mod', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-plasma-mod', 'universal-limited', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-plasma-pistol', 'gf-battle-brothers', 'Plasma Pistol', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-plasma-pistol', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-plasma-rifle', 'gf-battle-brothers', 'Plasma Rifle', 'weapon', 24, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-plasma-rifle', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-preacher', 'gf-battle-brothers', 'Preacher', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-quad-flamer-cannon', 'gf-battle-brothers', 'Quad Flamer Cannon', 'weapon', 18, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-quad-flamer-cannon', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-quad-flamer-cannon', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-quad-flamer-cannon', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-quad-laser-cannon', 'gf-battle-brothers', 'Quad Laser Cannon', 'weapon', 36, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-quad-laser-cannon', 'gf-battle-brothers-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-quad-laser-cannon', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-rapid-autocannon', 'gf-battle-brothers', 'Rapid Autocannon', 'weapon', 36, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-rapid-autocannon', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-rapid-storm-rifle', 'gf-battle-brothers', 'Rapid Storm Rifle', 'weapon', 24, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-rapid-storm-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-sgt-heavy-pistol', 'gf-battle-brothers', 'Sgt. Heavy Pistol', 'weapon', 12, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-sgt-heavy-pistol', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-shotgun', 'gf-battle-brothers', 'Shotgun', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-shotgun', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-sniper-rifle', 'gf-battle-brothers', 'Sniper Rifle', 'weapon', 30, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-sniper-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-sniper-rifle', 'universal-takedown', 0);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-sniper-rifle', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-spear-missile-launcher', 'gf-battle-brothers', 'Spear Missile Launcher', 'weapon', 30, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-spear-missile-launcher', 'gf-battle-brothers-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-spear-missile-launcher', 'universal-deadly', 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-spear-missile-launcher', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-stomp', 'gf-battle-brothers', 'Stomp', 'weapon', 0, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-stomp', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-storm-cannon', 'gf-battle-brothers', 'Storm Cannon', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-storm-cannon', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-storm-cannon', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-storm-missiles', 'gf-battle-brothers', 'Storm Missiles', 'weapon', 36, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-storm-missiles', 'gf-battle-brothers-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-storm-missiles', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-storm-rifle', 'gf-battle-brothers', 'Storm Rifle', 'weapon', 24, 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-storm-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-super-heavy-fusion-rifle', 'gf-battle-brothers', 'Super-Heavy Fusion Rifle', 'weapon', 18, 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-super-heavy-fusion-rifle', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-super-heavy-fusion-rifle', 'universal-deadly', 6);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-targeting-array', 'gf-battle-brothers', 'Targeting Array', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-the-founder-s-banner', 'gf-battle-brothers', 'The Founder''s Banner', 'mount', 0, 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-autocannon', 'gf-battle-brothers', 'Twin Autocannon', 'weapon', 36, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-autocannon', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-flamer', 'gf-battle-brothers', 'Twin Flamer', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-flamer', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-flamer', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-fusion-rifle', 'gf-battle-brothers', 'Twin Fusion Rifle', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-fusion-rifle', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-fusion-rifle', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-hammer-missiles', 'gf-battle-brothers', 'Twin Hammer Missiles', 'weapon', 36, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-hammer-missiles', 'gf-battle-brothers-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-hammer-missiles', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-hammer-missiles', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-heavy-flamer', 'gf-battle-brothers', 'Twin Heavy Flamer', 'weapon', 12, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-heavy-flamer', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-heavy-flamer', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-heavy-flamer', 'universal-reliable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-heavy-machinegun', 'gf-battle-brothers', 'Twin Heavy Machinegun', 'weapon', 30, 6);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-heavy-machinegun', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-heavy-rifle', 'gf-battle-brothers', 'Twin Heavy Rifle', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-heavy-rifle', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-heavy-rifle-array', 'gf-battle-brothers', 'Twin Heavy Rifle Array', 'weapon', 24, 12);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-heavy-rifle-array', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-laser-cannon', 'gf-battle-brothers', 'Twin Laser Cannon', 'weapon', 36, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-laser-cannon', 'gf-battle-brothers-ap', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-laser-cannon', 'universal-deadly', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-light-gravity-cannon', 'gf-battle-brothers', 'Twin Light Gravity Cannon', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-light-gravity-cannon', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-light-gravity-cannon', 'gf-battle-brothers-smash', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-minigun', 'gf-battle-brothers', 'Twin Minigun', 'weapon', 24, 8);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-minigun', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-plasma-cannon', 'gf-battle-brothers', 'Twin Plasma Cannon', 'weapon', 30, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-plasma-cannon', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-plasma-cannon', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-plasma-rifle', 'gf-battle-brothers', 'Twin Plasma Rifle', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-plasma-rifle', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-storm-cannon', 'gf-battle-brothers', 'Twin Storm Cannon', 'weapon', 30, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-storm-cannon', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-storm-cannon', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-twin-typhoon-missiles', 'gf-battle-brothers', 'Twin Typhoon Missiles', 'weapon', 24, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-typhoon-missiles', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-twin-typhoon-missiles', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-typhoon-missiles', 'gf-battle-brothers', 'Typhoon Missiles', 'weapon', 24, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-typhoon-missiles', 'gf-battle-brothers-ap', 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-typhoon-missiles', 'gf-battle-brothers-unstoppable', 0);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-walker-fist', 'gf-battle-brothers', 'Walker Fist', 'weapon', 0, 4);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-walker-fist', 'gf-battle-brothers-ap', 4);
INSERT OR IGNORE INTO opr_equipment (id, army_id, name, type, range, attacks) VALUES
  ('gf-battle-brothers-wind-missile-launcher', 'gf-battle-brothers', 'Wind Missile Launcher', 'weapon', 36, 2);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-wind-missile-launcher', 'gf-battle-brothers-blast', 3);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-wind-missile-launcher', 'gf-battle-brothers-ap', 1);
INSERT OR IGNORE INTO opr_equipment_special_rules (equipment_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-wind-missile-launcher', 'universal-indirect', 0);

-- Units
INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-master-destroyer', 'gf-battle-brothers', 'Master Destroyer', 1, 130, 3, 3, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-destroyer', 'universal-ambush', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-destroyer', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-destroyer', 'gf-battle-brothers-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-destroyer', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-destroyer', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-master-destroyer', 'gf-battle-brothers-ccw', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-master-destroyer', 'gf-battle-brothers-combat-shield', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-1', 'gf-battle-brothers-master-destroyer', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-1-opt-0', 'gf-battle-brothers-master-destroyer-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-1-opt-1', 'gf-battle-brothers-master-destroyer-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-1-opt-2', 'gf-battle-brothers-master-destroyer-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-1-opt-3', 'gf-battle-brothers-master-destroyer-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-2', 'gf-battle-brothers-master-destroyer', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-2-opt-0', 'gf-battle-brothers-master-destroyer-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-2-opt-1', 'gf-battle-brothers-master-destroyer-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-2-opt-2', 'gf-battle-brothers-master-destroyer-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-2-opt-3', 'gf-battle-brothers-master-destroyer-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-2-opt-4', 'gf-battle-brothers-master-destroyer-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-2-opt-5', 'gf-battle-brothers-master-destroyer-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-3', 'gf-battle-brothers-master-destroyer', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-3-opt-0', 'gf-battle-brothers-master-destroyer-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-3-opt-1', 'gf-battle-brothers-master-destroyer-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-3-opt-2', 'gf-battle-brothers-master-destroyer-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-3-opt-3', 'gf-battle-brothers-master-destroyer-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-4', 'gf-battle-brothers-master-destroyer', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-4-opt-0', 'gf-battle-brothers-master-destroyer-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-4-opt-1', 'gf-battle-brothers-master-destroyer-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-4-opt-2', 'gf-battle-brothers-master-destroyer-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-4-opt-3', 'gf-battle-brothers-master-destroyer-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-5', 'gf-battle-brothers-master-destroyer', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-5-opt-0', 'gf-battle-brothers-master-destroyer-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-5-opt-1', 'gf-battle-brothers-master-destroyer-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-5-opt-2', 'gf-battle-brothers-master-destroyer-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-5-opt-3', 'gf-battle-brothers-master-destroyer-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-6', 'gf-battle-brothers-master-destroyer', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-6-opt-0', 'gf-battle-brothers-master-destroyer-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-6-opt-1', 'gf-battle-brothers-master-destroyer-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-6-opt-2', 'gf-battle-brothers-master-destroyer-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-6-opt-3', 'gf-battle-brothers-master-destroyer-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-6-opt-4', 'gf-battle-brothers-master-destroyer-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-6-opt-5', 'gf-battle-brothers-master-destroyer-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-7', 'gf-battle-brothers-master-destroyer', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-7-opt-0', 'gf-battle-brothers-master-destroyer-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-7-opt-1', 'gf-battle-brothers-master-destroyer-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-7-opt-2', 'gf-battle-brothers-master-destroyer-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-7-opt-3', 'gf-battle-brothers-master-destroyer-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-8', 'gf-battle-brothers-master-destroyer', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-destroyer-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-8-opt-0', 'gf-battle-brothers-master-destroyer-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-8-opt-1', 'gf-battle-brothers-master-destroyer-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-8-opt-2', 'gf-battle-brothers-master-destroyer-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-destroyer-grp-8-opt-3', 'gf-battle-brothers-master-destroyer-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-veteran-master-brother', 'gf-battle-brothers', 'Veteran Master Brother', 1, 65, 3, 3, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-master-brother', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-master-brother', 'gf-battle-brothers-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-master-brother', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-master-brother', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-master-brother', 'gf-battle-brothers-versatile-attack', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-veteran-master-brother', 'gf-battle-brothers-ccw', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-veteran-master-brother', 'gf-battle-brothers-combat-shield', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-1', 'gf-battle-brothers-veteran-master-brother', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-1-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-1', 'gf-battle-brothers-ccw', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-1-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-1', 'gf-battle-brothers-gravity-pistol', 5, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-1-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-1', 'gf-battle-brothers-dual-energy-claws', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-1-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 20, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-2', 'gf-battle-brothers-veteran-master-brother', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-2-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-2-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-2', 'gf-battle-brothers-master-heavy-pistol', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-2-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-2', 'gf-battle-brothers-fusion-pistol', 10, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-2-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-2', 'gf-battle-brothers-master-plasma-pistol', 25, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-2-opt-4', 'gf-battle-brothers-veteran-master-brother-grp-2', 'gf-battle-brothers-master-heavy-rifle', 30, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-2-opt-5', 'gf-battle-brothers-veteran-master-brother-grp-2', 'gf-battle-brothers-master-storm-rifle', 75, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-3', 'gf-battle-brothers-veteran-master-brother', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-3-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-3', 'gf-battle-brothers-gravity-mod', 10, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-3-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-3', 'gf-battle-brothers-flamer-mod', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-3-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-3', 'gf-battle-brothers-plasma-mod', 10, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-3-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-3', 'gf-battle-brothers-fusion-mod', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-4', 'gf-battle-brothers-veteran-master-brother', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-4-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-4-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-4-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-4', 'gf-battle-brothers-energy-fist', 20, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-4-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-4', 'gf-battle-brothers-chain-fist', 20, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-5', 'gf-battle-brothers-veteran-master-brother', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-5-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-5', 'gf-battle-brothers-ccw', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-5-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-5', 'gf-battle-brothers-gravity-pistol', 5, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-5-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-5', 'gf-battle-brothers-dual-energy-claws', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-5-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 20, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-6', 'gf-battle-brothers-veteran-master-brother', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-6-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-6-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-6', 'gf-battle-brothers-master-heavy-pistol', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-6-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-6', 'gf-battle-brothers-fusion-pistol', 10, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-6-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-6', 'gf-battle-brothers-master-plasma-pistol', 25, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-6-opt-4', 'gf-battle-brothers-veteran-master-brother-grp-6', 'gf-battle-brothers-master-heavy-rifle', 30, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-6-opt-5', 'gf-battle-brothers-veteran-master-brother-grp-6', 'gf-battle-brothers-master-storm-rifle', 75, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-7', 'gf-battle-brothers-veteran-master-brother', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-7-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-7', 'gf-battle-brothers-gravity-mod', 10, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-7-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-7', 'gf-battle-brothers-flamer-mod', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-7-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-7', 'gf-battle-brothers-plasma-mod', 10, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-7-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-7', 'gf-battle-brothers-fusion-mod', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-8', 'gf-battle-brothers-veteran-master-brother', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-8-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-8-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-8-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-8', 'gf-battle-brothers-energy-fist', 20, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-8-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-8', 'gf-battle-brothers-chain-fist', 20, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-9', 'gf-battle-brothers-veteran-master-brother', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 9);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-9', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-9', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-9-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-9', 'gf-battle-brothers-ccw', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-9-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-9', 'gf-battle-brothers-gravity-pistol', 5, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-9-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-9', 'gf-battle-brothers-dual-energy-claws', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-9-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-9', 'gf-battle-brothers-heavy-chainsaw-sword', 20, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-10', 'gf-battle-brothers-veteran-master-brother', 'Replace Gravity Pistol', 1, 'one-model', 1, 10);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-10', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-10-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-10', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-10-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-10', 'gf-battle-brothers-master-heavy-pistol', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-10-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-10', 'gf-battle-brothers-fusion-pistol', 10, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-10-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-10', 'gf-battle-brothers-master-plasma-pistol', 25, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-10-opt-4', 'gf-battle-brothers-veteran-master-brother-grp-10', 'gf-battle-brothers-master-heavy-rifle', 30, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-10-opt-5', 'gf-battle-brothers-veteran-master-brother-grp-10', 'gf-battle-brothers-master-storm-rifle', 75, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-11', 'gf-battle-brothers-veteran-master-brother', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 11);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-11', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-11-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-11', 'gf-battle-brothers-gravity-mod', 10, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-11-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-11', 'gf-battle-brothers-flamer-mod', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-11-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-11', 'gf-battle-brothers-plasma-mod', 10, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-11-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-11', 'gf-battle-brothers-fusion-mod', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-12', 'gf-battle-brothers-veteran-master-brother', 'Replace CCW', 1, 'one-model', 1, 12);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-12', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-12-opt-0', 'gf-battle-brothers-veteran-master-brother-grp-12', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-12-opt-1', 'gf-battle-brothers-veteran-master-brother-grp-12', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-12-opt-2', 'gf-battle-brothers-veteran-master-brother-grp-12', 'gf-battle-brothers-energy-fist', 20, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-master-brother-grp-12-opt-3', 'gf-battle-brothers-veteran-master-brother-grp-12', 'gf-battle-brothers-chain-fist', 20, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-master-brother', 'gf-battle-brothers', 'Master Brother', 1, 55, 3, 3, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-brother', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-brother', 'gf-battle-brothers-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-brother', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-master-brother', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-master-brother', 'gf-battle-brothers-gravity-pistol', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-master-brother', 'gf-battle-brothers-ccw', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-1', 'gf-battle-brothers-master-brother', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-1-opt-0', 'gf-battle-brothers-master-brother-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-1-opt-1', 'gf-battle-brothers-master-brother-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-1-opt-2', 'gf-battle-brothers-master-brother-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-1-opt-3', 'gf-battle-brothers-master-brother-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-2', 'gf-battle-brothers-master-brother', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-2-opt-0', 'gf-battle-brothers-master-brother-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-2-opt-1', 'gf-battle-brothers-master-brother-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-2-opt-2', 'gf-battle-brothers-master-brother-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-2-opt-3', 'gf-battle-brothers-master-brother-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-2-opt-4', 'gf-battle-brothers-master-brother-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-2-opt-5', 'gf-battle-brothers-master-brother-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-3', 'gf-battle-brothers-master-brother', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-3-opt-0', 'gf-battle-brothers-master-brother-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-3-opt-1', 'gf-battle-brothers-master-brother-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-3-opt-2', 'gf-battle-brothers-master-brother-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-3-opt-3', 'gf-battle-brothers-master-brother-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-4', 'gf-battle-brothers-master-brother', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-4-opt-0', 'gf-battle-brothers-master-brother-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-4-opt-1', 'gf-battle-brothers-master-brother-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-4-opt-2', 'gf-battle-brothers-master-brother-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-4-opt-3', 'gf-battle-brothers-master-brother-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-5', 'gf-battle-brothers-master-brother', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-5-opt-0', 'gf-battle-brothers-master-brother-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-5-opt-1', 'gf-battle-brothers-master-brother-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-5-opt-2', 'gf-battle-brothers-master-brother-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-5-opt-3', 'gf-battle-brothers-master-brother-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-6', 'gf-battle-brothers-master-brother', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-6-opt-0', 'gf-battle-brothers-master-brother-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-6-opt-1', 'gf-battle-brothers-master-brother-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-6-opt-2', 'gf-battle-brothers-master-brother-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-6-opt-3', 'gf-battle-brothers-master-brother-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-6-opt-4', 'gf-battle-brothers-master-brother-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-6-opt-5', 'gf-battle-brothers-master-brother-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-7', 'gf-battle-brothers-master-brother', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-7-opt-0', 'gf-battle-brothers-master-brother-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-7-opt-1', 'gf-battle-brothers-master-brother-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-7-opt-2', 'gf-battle-brothers-master-brother-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-7-opt-3', 'gf-battle-brothers-master-brother-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-8', 'gf-battle-brothers-master-brother', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-8-opt-0', 'gf-battle-brothers-master-brother-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-8-opt-1', 'gf-battle-brothers-master-brother-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-8-opt-2', 'gf-battle-brothers-master-brother-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-8-opt-3', 'gf-battle-brothers-master-brother-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-9', 'gf-battle-brothers-master-brother', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 9);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-9', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-9', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-9-opt-0', 'gf-battle-brothers-master-brother-grp-9', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-9-opt-1', 'gf-battle-brothers-master-brother-grp-9', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-9-opt-2', 'gf-battle-brothers-master-brother-grp-9', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-9-opt-3', 'gf-battle-brothers-master-brother-grp-9', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-10', 'gf-battle-brothers-master-brother', 'Replace Gravity Pistol', 1, 'one-model', 1, 10);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-10', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-10-opt-0', 'gf-battle-brothers-master-brother-grp-10', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-10-opt-1', 'gf-battle-brothers-master-brother-grp-10', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-10-opt-2', 'gf-battle-brothers-master-brother-grp-10', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-10-opt-3', 'gf-battle-brothers-master-brother-grp-10', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-10-opt-4', 'gf-battle-brothers-master-brother-grp-10', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-10-opt-5', 'gf-battle-brothers-master-brother-grp-10', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-11', 'gf-battle-brothers-master-brother', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 11);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-11', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-11-opt-0', 'gf-battle-brothers-master-brother-grp-11', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-11-opt-1', 'gf-battle-brothers-master-brother-grp-11', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-11-opt-2', 'gf-battle-brothers-master-brother-grp-11', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-11-opt-3', 'gf-battle-brothers-master-brother-grp-11', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-12', 'gf-battle-brothers-master-brother', 'Replace CCW', 1, 'one-model', 1, 12);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-master-brother-grp-12', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-12-opt-0', 'gf-battle-brothers-master-brother-grp-12', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-12-opt-1', 'gf-battle-brothers-master-brother-grp-12', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-12-opt-2', 'gf-battle-brothers-master-brother-grp-12', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-master-brother-grp-12-opt-3', 'gf-battle-brothers-master-brother-grp-12', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-elite-pathfinder', 'gf-battle-brothers', 'Elite Pathfinder', 1, 50, 4, 4, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-elite-pathfinder', 'universal-hero', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-elite-pathfinder', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-elite-pathfinder', 'gf-battle-brothers-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-elite-pathfinder', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-elite-pathfinder', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-elite-pathfinder', 'gf-battle-brothers-gravity-pistol', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-elite-pathfinder', 'gf-battle-brothers-ccw', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-1', 'gf-battle-brothers-elite-pathfinder', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-1-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-1-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-1-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-1-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-2', 'gf-battle-brothers-elite-pathfinder', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-2-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-2-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-2-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-2-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-2-opt-4', 'gf-battle-brothers-elite-pathfinder-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-2-opt-5', 'gf-battle-brothers-elite-pathfinder-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-3', 'gf-battle-brothers-elite-pathfinder', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-3-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-3-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-3-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-3-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-4', 'gf-battle-brothers-elite-pathfinder', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-4-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-4-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-4-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-4-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-5', 'gf-battle-brothers-elite-pathfinder', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-5-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-5-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-5-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-5-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-6', 'gf-battle-brothers-elite-pathfinder', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-6-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-6-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-6-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-6-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-6-opt-4', 'gf-battle-brothers-elite-pathfinder-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-6-opt-5', 'gf-battle-brothers-elite-pathfinder-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-7', 'gf-battle-brothers-elite-pathfinder', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-7-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-7-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-7-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-7-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-8', 'gf-battle-brothers-elite-pathfinder', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-8-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-8-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-8-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-8-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-9', 'gf-battle-brothers-elite-pathfinder', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 9);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-9', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-9', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-9-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-9', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-9-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-9', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-9-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-9', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-9-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-9', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-10', 'gf-battle-brothers-elite-pathfinder', 'Replace Gravity Pistol', 1, 'one-model', 1, 10);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-10', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-10-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-10', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-10-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-10', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-10-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-10', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-10-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-10', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-10-opt-4', 'gf-battle-brothers-elite-pathfinder-grp-10', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-10-opt-5', 'gf-battle-brothers-elite-pathfinder-grp-10', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-11', 'gf-battle-brothers-elite-pathfinder', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 11);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-11', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-11-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-11', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-11-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-11', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-11-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-11', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-11-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-11', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-12', 'gf-battle-brothers-elite-pathfinder', 'Replace CCW', 1, 'one-model', 1, 12);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-12', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-12-opt-0', 'gf-battle-brothers-elite-pathfinder-grp-12', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-12-opt-1', 'gf-battle-brothers-elite-pathfinder-grp-12', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-12-opt-2', 'gf-battle-brothers-elite-pathfinder-grp-12', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-elite-pathfinder-grp-12-opt-3', 'gf-battle-brothers-elite-pathfinder-grp-12', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-pathfinders', 'gf-battle-brothers', 'Pathfinders', 5, 115, 4, 4, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-pathfinders', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-pathfinders', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-pathfinders', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-pathfinders', 'gf-battle-brothers-heavy-pistol', 5);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-pathfinders', 'gf-battle-brothers-ccw', 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-1', 'gf-battle-brothers-pathfinders', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinders-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinders-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-1-opt-0', 'gf-battle-brothers-pathfinders-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-1-opt-1', 'gf-battle-brothers-pathfinders-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-1-opt-2', 'gf-battle-brothers-pathfinders-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-1-opt-3', 'gf-battle-brothers-pathfinders-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-2', 'gf-battle-brothers-pathfinders', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinders-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-2-opt-0', 'gf-battle-brothers-pathfinders-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-2-opt-1', 'gf-battle-brothers-pathfinders-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-2-opt-2', 'gf-battle-brothers-pathfinders-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-2-opt-3', 'gf-battle-brothers-pathfinders-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-2-opt-4', 'gf-battle-brothers-pathfinders-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-2-opt-5', 'gf-battle-brothers-pathfinders-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-3', 'gf-battle-brothers-pathfinders', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinders-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-3-opt-0', 'gf-battle-brothers-pathfinders-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-3-opt-1', 'gf-battle-brothers-pathfinders-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-3-opt-2', 'gf-battle-brothers-pathfinders-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-3-opt-3', 'gf-battle-brothers-pathfinders-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-4', 'gf-battle-brothers-pathfinders', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinders-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-4-opt-0', 'gf-battle-brothers-pathfinders-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-4-opt-1', 'gf-battle-brothers-pathfinders-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-4-opt-2', 'gf-battle-brothers-pathfinders-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinders-grp-4-opt-3', 'gf-battle-brothers-pathfinders-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-battle-brothers', 'gf-battle-brothers', 'Battle Brothers', 5, 150, 3, 3, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-battle-brothers', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-battle-brothers', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-battle-brothers', 'gf-battle-brothers-heavy-rifle', 5);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-battle-brothers', 'gf-battle-brothers-ccw', 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-1', 'gf-battle-brothers-battle-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-1-opt-0', 'gf-battle-brothers-battle-brothers-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-1-opt-1', 'gf-battle-brothers-battle-brothers-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-1-opt-2', 'gf-battle-brothers-battle-brothers-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-1-opt-3', 'gf-battle-brothers-battle-brothers-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-2', 'gf-battle-brothers-battle-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-2-opt-0', 'gf-battle-brothers-battle-brothers-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-2-opt-1', 'gf-battle-brothers-battle-brothers-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-2-opt-2', 'gf-battle-brothers-battle-brothers-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-2-opt-3', 'gf-battle-brothers-battle-brothers-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-2-opt-4', 'gf-battle-brothers-battle-brothers-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-2-opt-5', 'gf-battle-brothers-battle-brothers-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-3', 'gf-battle-brothers-battle-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-3-opt-0', 'gf-battle-brothers-battle-brothers-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-3-opt-1', 'gf-battle-brothers-battle-brothers-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-3-opt-2', 'gf-battle-brothers-battle-brothers-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-3-opt-3', 'gf-battle-brothers-battle-brothers-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-4', 'gf-battle-brothers-battle-brothers', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-4-opt-0', 'gf-battle-brothers-battle-brothers-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-4-opt-1', 'gf-battle-brothers-battle-brothers-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-4-opt-2', 'gf-battle-brothers-battle-brothers-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-4-opt-3', 'gf-battle-brothers-battle-brothers-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-5', 'gf-battle-brothers-battle-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-5-opt-0', 'gf-battle-brothers-battle-brothers-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-5-opt-1', 'gf-battle-brothers-battle-brothers-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-5-opt-2', 'gf-battle-brothers-battle-brothers-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-5-opt-3', 'gf-battle-brothers-battle-brothers-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-6', 'gf-battle-brothers-battle-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-6-opt-0', 'gf-battle-brothers-battle-brothers-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-6-opt-1', 'gf-battle-brothers-battle-brothers-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-6-opt-2', 'gf-battle-brothers-battle-brothers-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-6-opt-3', 'gf-battle-brothers-battle-brothers-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-6-opt-4', 'gf-battle-brothers-battle-brothers-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-6-opt-5', 'gf-battle-brothers-battle-brothers-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-7', 'gf-battle-brothers-battle-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-7-opt-0', 'gf-battle-brothers-battle-brothers-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-7-opt-1', 'gf-battle-brothers-battle-brothers-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-7-opt-2', 'gf-battle-brothers-battle-brothers-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-7-opt-3', 'gf-battle-brothers-battle-brothers-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-8', 'gf-battle-brothers-battle-brothers', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-brothers-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-8-opt-0', 'gf-battle-brothers-battle-brothers-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-8-opt-1', 'gf-battle-brothers-battle-brothers-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-8-opt-2', 'gf-battle-brothers-battle-brothers-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-brothers-grp-8-opt-3', 'gf-battle-brothers-battle-brothers-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-assault-brothers', 'gf-battle-brothers', 'Assault Brothers', 5, 165, 3, 3, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-assault-brothers', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-assault-brothers', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-assault-brothers', 'gf-battle-brothers-heavy-pistol', 5);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-assault-brothers', 'gf-battle-brothers-heavy-ccw', 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-1', 'gf-battle-brothers-assault-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-1-opt-0', 'gf-battle-brothers-assault-brothers-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-1-opt-1', 'gf-battle-brothers-assault-brothers-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-1-opt-2', 'gf-battle-brothers-assault-brothers-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-1-opt-3', 'gf-battle-brothers-assault-brothers-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-2', 'gf-battle-brothers-assault-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-2-opt-0', 'gf-battle-brothers-assault-brothers-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-2-opt-1', 'gf-battle-brothers-assault-brothers-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-2-opt-2', 'gf-battle-brothers-assault-brothers-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-2-opt-3', 'gf-battle-brothers-assault-brothers-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-2-opt-4', 'gf-battle-brothers-assault-brothers-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-2-opt-5', 'gf-battle-brothers-assault-brothers-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-3', 'gf-battle-brothers-assault-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-3-opt-0', 'gf-battle-brothers-assault-brothers-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-3-opt-1', 'gf-battle-brothers-assault-brothers-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-3-opt-2', 'gf-battle-brothers-assault-brothers-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-3-opt-3', 'gf-battle-brothers-assault-brothers-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-4', 'gf-battle-brothers-assault-brothers', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-4-opt-0', 'gf-battle-brothers-assault-brothers-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-4-opt-1', 'gf-battle-brothers-assault-brothers-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-4-opt-2', 'gf-battle-brothers-assault-brothers-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-4-opt-3', 'gf-battle-brothers-assault-brothers-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-5', 'gf-battle-brothers-assault-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-5-opt-0', 'gf-battle-brothers-assault-brothers-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-5-opt-1', 'gf-battle-brothers-assault-brothers-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-5-opt-2', 'gf-battle-brothers-assault-brothers-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-5-opt-3', 'gf-battle-brothers-assault-brothers-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-6', 'gf-battle-brothers-assault-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-6-opt-0', 'gf-battle-brothers-assault-brothers-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-6-opt-1', 'gf-battle-brothers-assault-brothers-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-6-opt-2', 'gf-battle-brothers-assault-brothers-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-6-opt-3', 'gf-battle-brothers-assault-brothers-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-6-opt-4', 'gf-battle-brothers-assault-brothers-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-6-opt-5', 'gf-battle-brothers-assault-brothers-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-7', 'gf-battle-brothers-assault-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-7-opt-0', 'gf-battle-brothers-assault-brothers-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-7-opt-1', 'gf-battle-brothers-assault-brothers-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-7-opt-2', 'gf-battle-brothers-assault-brothers-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-7-opt-3', 'gf-battle-brothers-assault-brothers-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-8', 'gf-battle-brothers-assault-brothers', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-assault-brothers-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-8-opt-0', 'gf-battle-brothers-assault-brothers-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-8-opt-1', 'gf-battle-brothers-assault-brothers-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-8-opt-2', 'gf-battle-brothers-assault-brothers-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-assault-brothers-grp-8-opt-3', 'gf-battle-brothers-assault-brothers-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-veteran-assault-brothers', 'gf-battle-brothers', 'Veteran Assault Brothers', 3, 95, 3, 3, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-assault-brothers', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-assault-brothers', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-assault-brothers', 'gf-battle-brothers-versatile-attack', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-veteran-assault-brothers', 'gf-battle-brothers-heavy-pistol', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-veteran-assault-brothers', 'gf-battle-brothers-combat-shield', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-1', 'gf-battle-brothers-veteran-assault-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-1-opt-0', 'gf-battle-brothers-veteran-assault-brothers-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-1-opt-1', 'gf-battle-brothers-veteran-assault-brothers-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-1-opt-2', 'gf-battle-brothers-veteran-assault-brothers-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-1-opt-3', 'gf-battle-brothers-veteran-assault-brothers-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-2', 'gf-battle-brothers-veteran-assault-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-2-opt-0', 'gf-battle-brothers-veteran-assault-brothers-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-2-opt-1', 'gf-battle-brothers-veteran-assault-brothers-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-2-opt-2', 'gf-battle-brothers-veteran-assault-brothers-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-2-opt-3', 'gf-battle-brothers-veteran-assault-brothers-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-2-opt-4', 'gf-battle-brothers-veteran-assault-brothers-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-2-opt-5', 'gf-battle-brothers-veteran-assault-brothers-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-3', 'gf-battle-brothers-veteran-assault-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-3-opt-0', 'gf-battle-brothers-veteran-assault-brothers-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-3-opt-1', 'gf-battle-brothers-veteran-assault-brothers-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-3-opt-2', 'gf-battle-brothers-veteran-assault-brothers-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-3-opt-3', 'gf-battle-brothers-veteran-assault-brothers-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-4', 'gf-battle-brothers-veteran-assault-brothers', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-4-opt-0', 'gf-battle-brothers-veteran-assault-brothers-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-4-opt-1', 'gf-battle-brothers-veteran-assault-brothers-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-4-opt-2', 'gf-battle-brothers-veteran-assault-brothers-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-4-opt-3', 'gf-battle-brothers-veteran-assault-brothers-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-5', 'gf-battle-brothers-veteran-assault-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-5-opt-0', 'gf-battle-brothers-veteran-assault-brothers-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-5-opt-1', 'gf-battle-brothers-veteran-assault-brothers-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-5-opt-2', 'gf-battle-brothers-veteran-assault-brothers-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-5-opt-3', 'gf-battle-brothers-veteran-assault-brothers-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-6', 'gf-battle-brothers-veteran-assault-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-6-opt-0', 'gf-battle-brothers-veteran-assault-brothers-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-6-opt-1', 'gf-battle-brothers-veteran-assault-brothers-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-6-opt-2', 'gf-battle-brothers-veteran-assault-brothers-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-6-opt-3', 'gf-battle-brothers-veteran-assault-brothers-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-6-opt-4', 'gf-battle-brothers-veteran-assault-brothers-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-6-opt-5', 'gf-battle-brothers-veteran-assault-brothers-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-7', 'gf-battle-brothers-veteran-assault-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-7-opt-0', 'gf-battle-brothers-veteran-assault-brothers-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-7-opt-1', 'gf-battle-brothers-veteran-assault-brothers-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-7-opt-2', 'gf-battle-brothers-veteran-assault-brothers-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-7-opt-3', 'gf-battle-brothers-veteran-assault-brothers-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-8', 'gf-battle-brothers-veteran-assault-brothers', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-8-opt-0', 'gf-battle-brothers-veteran-assault-brothers-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-8-opt-1', 'gf-battle-brothers-veteran-assault-brothers-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-8-opt-2', 'gf-battle-brothers-veteran-assault-brothers-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-assault-brothers-grp-8-opt-3', 'gf-battle-brothers-veteran-assault-brothers-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-veteran-battle-brothers', 'gf-battle-brothers', 'Veteran Battle Brothers', 3, 125, 3, 3, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-battle-brothers', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-battle-brothers', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-battle-brothers', 'gf-battle-brothers-versatile-attack', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-veteran-battle-brothers', 'gf-battle-brothers-heavy-rifle', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-veteran-battle-brothers', 'gf-battle-brothers-ccw', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-1', 'gf-battle-brothers-veteran-battle-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-1-opt-0', 'gf-battle-brothers-veteran-battle-brothers-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-1-opt-1', 'gf-battle-brothers-veteran-battle-brothers-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-1-opt-2', 'gf-battle-brothers-veteran-battle-brothers-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-1-opt-3', 'gf-battle-brothers-veteran-battle-brothers-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-2', 'gf-battle-brothers-veteran-battle-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-2-opt-0', 'gf-battle-brothers-veteran-battle-brothers-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-2-opt-1', 'gf-battle-brothers-veteran-battle-brothers-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-2-opt-2', 'gf-battle-brothers-veteran-battle-brothers-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-2-opt-3', 'gf-battle-brothers-veteran-battle-brothers-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-2-opt-4', 'gf-battle-brothers-veteran-battle-brothers-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-2-opt-5', 'gf-battle-brothers-veteran-battle-brothers-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-3', 'gf-battle-brothers-veteran-battle-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-3-opt-0', 'gf-battle-brothers-veteran-battle-brothers-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-3-opt-1', 'gf-battle-brothers-veteran-battle-brothers-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-3-opt-2', 'gf-battle-brothers-veteran-battle-brothers-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-3-opt-3', 'gf-battle-brothers-veteran-battle-brothers-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-4', 'gf-battle-brothers-veteran-battle-brothers', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-4-opt-0', 'gf-battle-brothers-veteran-battle-brothers-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-4-opt-1', 'gf-battle-brothers-veteran-battle-brothers-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-4-opt-2', 'gf-battle-brothers-veteran-battle-brothers-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-4-opt-3', 'gf-battle-brothers-veteran-battle-brothers-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-5', 'gf-battle-brothers-veteran-battle-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-5-opt-0', 'gf-battle-brothers-veteran-battle-brothers-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-5-opt-1', 'gf-battle-brothers-veteran-battle-brothers-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-5-opt-2', 'gf-battle-brothers-veteran-battle-brothers-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-5-opt-3', 'gf-battle-brothers-veteran-battle-brothers-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-6', 'gf-battle-brothers-veteran-battle-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-6-opt-0', 'gf-battle-brothers-veteran-battle-brothers-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-6-opt-1', 'gf-battle-brothers-veteran-battle-brothers-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-6-opt-2', 'gf-battle-brothers-veteran-battle-brothers-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-6-opt-3', 'gf-battle-brothers-veteran-battle-brothers-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-6-opt-4', 'gf-battle-brothers-veteran-battle-brothers-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-6-opt-5', 'gf-battle-brothers-veteran-battle-brothers-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-7', 'gf-battle-brothers-veteran-battle-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-7-opt-0', 'gf-battle-brothers-veteran-battle-brothers-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-7-opt-1', 'gf-battle-brothers-veteran-battle-brothers-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-7-opt-2', 'gf-battle-brothers-veteran-battle-brothers-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-7-opt-3', 'gf-battle-brothers-veteran-battle-brothers-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-8', 'gf-battle-brothers-veteran-battle-brothers', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-8-opt-0', 'gf-battle-brothers-veteran-battle-brothers-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-8-opt-1', 'gf-battle-brothers-veteran-battle-brothers-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-8-opt-2', 'gf-battle-brothers-veteran-battle-brothers-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-battle-brothers-grp-8-opt-3', 'gf-battle-brothers-veteran-battle-brothers-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-support-brothers', 'gf-battle-brothers', 'Support Brothers', 3, 155, 3, 3, 'infantry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-support-brothers', 'universal-relentless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-support-brothers', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-support-brothers', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-support-brothers', 'gf-battle-brothers-heavy-flamer', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-support-brothers', 'gf-battle-brothers-ccw', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-1', 'gf-battle-brothers-support-brothers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-brothers-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-brothers-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-1-opt-0', 'gf-battle-brothers-support-brothers-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-1-opt-1', 'gf-battle-brothers-support-brothers-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-1-opt-2', 'gf-battle-brothers-support-brothers-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-1-opt-3', 'gf-battle-brothers-support-brothers-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-2', 'gf-battle-brothers-support-brothers', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-brothers-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-2-opt-0', 'gf-battle-brothers-support-brothers-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-2-opt-1', 'gf-battle-brothers-support-brothers-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-2-opt-2', 'gf-battle-brothers-support-brothers-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-2-opt-3', 'gf-battle-brothers-support-brothers-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-2-opt-4', 'gf-battle-brothers-support-brothers-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-2-opt-5', 'gf-battle-brothers-support-brothers-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-3', 'gf-battle-brothers-support-brothers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-brothers-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-3-opt-0', 'gf-battle-brothers-support-brothers-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-3-opt-1', 'gf-battle-brothers-support-brothers-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-3-opt-2', 'gf-battle-brothers-support-brothers-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-3-opt-3', 'gf-battle-brothers-support-brothers-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-4', 'gf-battle-brothers-support-brothers', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-brothers-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-4-opt-0', 'gf-battle-brothers-support-brothers-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-4-opt-1', 'gf-battle-brothers-support-brothers-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-4-opt-2', 'gf-battle-brothers-support-brothers-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-brothers-grp-4-opt-3', 'gf-battle-brothers-support-brothers-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-destroyers', 'gf-battle-brothers', 'Destroyers', 3, 205, 3, 3, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-destroyers', 'universal-ambush', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-destroyers', 'gf-battle-brothers-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-destroyers', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-destroyers', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-destroyers', 'gf-battle-brothers-ccw', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-destroyers', 'gf-battle-brothers-combat-shield', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-1', 'gf-battle-brothers-destroyers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-1-opt-0', 'gf-battle-brothers-destroyers-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-1-opt-1', 'gf-battle-brothers-destroyers-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-1-opt-2', 'gf-battle-brothers-destroyers-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-1-opt-3', 'gf-battle-brothers-destroyers-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-2', 'gf-battle-brothers-destroyers', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-2-opt-0', 'gf-battle-brothers-destroyers-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-2-opt-1', 'gf-battle-brothers-destroyers-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-2-opt-2', 'gf-battle-brothers-destroyers-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-2-opt-3', 'gf-battle-brothers-destroyers-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-2-opt-4', 'gf-battle-brothers-destroyers-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-2-opt-5', 'gf-battle-brothers-destroyers-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-3', 'gf-battle-brothers-destroyers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-3-opt-0', 'gf-battle-brothers-destroyers-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-3-opt-1', 'gf-battle-brothers-destroyers-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-3-opt-2', 'gf-battle-brothers-destroyers-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-3-opt-3', 'gf-battle-brothers-destroyers-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-4', 'gf-battle-brothers-destroyers', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-4-opt-0', 'gf-battle-brothers-destroyers-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-4-opt-1', 'gf-battle-brothers-destroyers-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-4-opt-2', 'gf-battle-brothers-destroyers-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-4-opt-3', 'gf-battle-brothers-destroyers-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-5', 'gf-battle-brothers-destroyers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-5-opt-0', 'gf-battle-brothers-destroyers-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-5-opt-1', 'gf-battle-brothers-destroyers-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-5-opt-2', 'gf-battle-brothers-destroyers-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-5-opt-3', 'gf-battle-brothers-destroyers-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-6', 'gf-battle-brothers-destroyers', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-6-opt-0', 'gf-battle-brothers-destroyers-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-6-opt-1', 'gf-battle-brothers-destroyers-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-6-opt-2', 'gf-battle-brothers-destroyers-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-6-opt-3', 'gf-battle-brothers-destroyers-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-6-opt-4', 'gf-battle-brothers-destroyers-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-6-opt-5', 'gf-battle-brothers-destroyers-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-7', 'gf-battle-brothers-destroyers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-7-opt-0', 'gf-battle-brothers-destroyers-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-7-opt-1', 'gf-battle-brothers-destroyers-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-7-opt-2', 'gf-battle-brothers-destroyers-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-7-opt-3', 'gf-battle-brothers-destroyers-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-8', 'gf-battle-brothers-destroyers', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-destroyers-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-8-opt-0', 'gf-battle-brothers-destroyers-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-8-opt-1', 'gf-battle-brothers-destroyers-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-8-opt-2', 'gf-battle-brothers-destroyers-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-destroyers-grp-8-opt-3', 'gf-battle-brothers-destroyers-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'gf-battle-brothers', 'Pathfinder Bikers', 3, 230, 4, 4, 'cavalry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'universal-scout', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'gf-battle-brothers-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'gf-battle-brothers-grenade-launcher', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'gf-battle-brothers-heavy-pistol', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-pathfinder-bikers', 'gf-battle-brothers-ccw', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-1', 'gf-battle-brothers-pathfinder-bikers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-1-opt-0', 'gf-battle-brothers-pathfinder-bikers-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-1-opt-1', 'gf-battle-brothers-pathfinder-bikers-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-1-opt-2', 'gf-battle-brothers-pathfinder-bikers-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-1-opt-3', 'gf-battle-brothers-pathfinder-bikers-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-2', 'gf-battle-brothers-pathfinder-bikers', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-2-opt-0', 'gf-battle-brothers-pathfinder-bikers-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-2-opt-1', 'gf-battle-brothers-pathfinder-bikers-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-2-opt-2', 'gf-battle-brothers-pathfinder-bikers-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-2-opt-3', 'gf-battle-brothers-pathfinder-bikers-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-2-opt-4', 'gf-battle-brothers-pathfinder-bikers-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-2-opt-5', 'gf-battle-brothers-pathfinder-bikers-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-3', 'gf-battle-brothers-pathfinder-bikers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-3-opt-0', 'gf-battle-brothers-pathfinder-bikers-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-3-opt-1', 'gf-battle-brothers-pathfinder-bikers-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-3-opt-2', 'gf-battle-brothers-pathfinder-bikers-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-3-opt-3', 'gf-battle-brothers-pathfinder-bikers-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-4', 'gf-battle-brothers-pathfinder-bikers', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-4-opt-0', 'gf-battle-brothers-pathfinder-bikers-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-4-opt-1', 'gf-battle-brothers-pathfinder-bikers-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-4-opt-2', 'gf-battle-brothers-pathfinder-bikers-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-pathfinder-bikers-grp-4-opt-3', 'gf-battle-brothers-pathfinder-bikers-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-brother-bikers', 'gf-battle-brothers', 'Brother Bikers', 3, 280, 3, 3, 'cavalry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-brother-bikers', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-brother-bikers', 'gf-battle-brothers-tough', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-brother-bikers', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-brother-bikers', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-brother-bikers', 'gf-battle-brothers-twin-heavy-rifle', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-brother-bikers', 'gf-battle-brothers-heavy-pistol', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-brother-bikers', 'gf-battle-brothers-ccw', 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-1', 'gf-battle-brothers-brother-bikers', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-brother-bikers-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-brother-bikers-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-1-opt-0', 'gf-battle-brothers-brother-bikers-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-1-opt-1', 'gf-battle-brothers-brother-bikers-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-1-opt-2', 'gf-battle-brothers-brother-bikers-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-1-opt-3', 'gf-battle-brothers-brother-bikers-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-2', 'gf-battle-brothers-brother-bikers', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-brother-bikers-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-2-opt-0', 'gf-battle-brothers-brother-bikers-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-2-opt-1', 'gf-battle-brothers-brother-bikers-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-2-opt-2', 'gf-battle-brothers-brother-bikers-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-2-opt-3', 'gf-battle-brothers-brother-bikers-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-2-opt-4', 'gf-battle-brothers-brother-bikers-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-2-opt-5', 'gf-battle-brothers-brother-bikers-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-3', 'gf-battle-brothers-brother-bikers', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-brother-bikers-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-3-opt-0', 'gf-battle-brothers-brother-bikers-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-3-opt-1', 'gf-battle-brothers-brother-bikers-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-3-opt-2', 'gf-battle-brothers-brother-bikers-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-3-opt-3', 'gf-battle-brothers-brother-bikers-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-4', 'gf-battle-brothers-brother-bikers', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-brother-bikers-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-4-opt-0', 'gf-battle-brothers-brother-bikers-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-4-opt-1', 'gf-battle-brothers-brother-bikers-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-4-opt-2', 'gf-battle-brothers-brother-bikers-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-brother-bikers-grp-4-opt-3', 'gf-battle-brothers-brother-bikers-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-support-bike', 'gf-battle-brothers', 'Support Bike', 1, 175, 3, 3, 'cavalry');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-support-bike', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-support-bike', 'gf-battle-brothers-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-support-bike', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-support-bike', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-support-bike', 'gf-battle-brothers-twin-heavy-rifle', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-support-bike', 'gf-battle-brothers-heavy-flamer', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-support-bike', 'gf-battle-brothers-heavy-pistol', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-support-bike', 'gf-battle-brothers-ccw', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-1', 'gf-battle-brothers-support-bike', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-bike-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-bike-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-1-opt-0', 'gf-battle-brothers-support-bike-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-1-opt-1', 'gf-battle-brothers-support-bike-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-1-opt-2', 'gf-battle-brothers-support-bike-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-1-opt-3', 'gf-battle-brothers-support-bike-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-2', 'gf-battle-brothers-support-bike', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-bike-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-2-opt-0', 'gf-battle-brothers-support-bike-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-2-opt-1', 'gf-battle-brothers-support-bike-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-2-opt-2', 'gf-battle-brothers-support-bike-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-2-opt-3', 'gf-battle-brothers-support-bike-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-2-opt-4', 'gf-battle-brothers-support-bike-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-2-opt-5', 'gf-battle-brothers-support-bike-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-3', 'gf-battle-brothers-support-bike', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-bike-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-3-opt-0', 'gf-battle-brothers-support-bike-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-3-opt-1', 'gf-battle-brothers-support-bike-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-3-opt-2', 'gf-battle-brothers-support-bike-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-3-opt-3', 'gf-battle-brothers-support-bike-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-4', 'gf-battle-brothers-support-bike', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-support-bike-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-4-opt-0', 'gf-battle-brothers-support-bike-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-4-opt-1', 'gf-battle-brothers-support-bike-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-4-opt-2', 'gf-battle-brothers-support-bike-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-support-bike-grp-4-opt-3', 'gf-battle-brothers-support-bike-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-apc', 'gf-battle-brothers', 'APC', 1, 205, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-apc', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-apc', 'universal-impact', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-apc', 'gf-battle-brothers-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-apc', 'universal-transport', 11);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-apc', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-apc', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-apc', 'gf-battle-brothers-storm-rifle', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-1', 'gf-battle-brothers-apc', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-1-opt-0', 'gf-battle-brothers-apc-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-1-opt-1', 'gf-battle-brothers-apc-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-1-opt-2', 'gf-battle-brothers-apc-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-1-opt-3', 'gf-battle-brothers-apc-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-2', 'gf-battle-brothers-apc', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-2-opt-0', 'gf-battle-brothers-apc-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-2-opt-1', 'gf-battle-brothers-apc-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-2-opt-2', 'gf-battle-brothers-apc-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-2-opt-3', 'gf-battle-brothers-apc-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-2-opt-4', 'gf-battle-brothers-apc-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-2-opt-5', 'gf-battle-brothers-apc-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-3', 'gf-battle-brothers-apc', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-3-opt-0', 'gf-battle-brothers-apc-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-3-opt-1', 'gf-battle-brothers-apc-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-3-opt-2', 'gf-battle-brothers-apc-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-3-opt-3', 'gf-battle-brothers-apc-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-4', 'gf-battle-brothers-apc', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-4-opt-0', 'gf-battle-brothers-apc-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-4-opt-1', 'gf-battle-brothers-apc-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-4-opt-2', 'gf-battle-brothers-apc-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-4-opt-3', 'gf-battle-brothers-apc-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-5', 'gf-battle-brothers-apc', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-5-opt-0', 'gf-battle-brothers-apc-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-5-opt-1', 'gf-battle-brothers-apc-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-5-opt-2', 'gf-battle-brothers-apc-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-5-opt-3', 'gf-battle-brothers-apc-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-6', 'gf-battle-brothers-apc', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-6-opt-0', 'gf-battle-brothers-apc-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-6-opt-1', 'gf-battle-brothers-apc-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-6-opt-2', 'gf-battle-brothers-apc-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-6-opt-3', 'gf-battle-brothers-apc-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-6-opt-4', 'gf-battle-brothers-apc-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-6-opt-5', 'gf-battle-brothers-apc-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-7', 'gf-battle-brothers-apc', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-7-opt-0', 'gf-battle-brothers-apc-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-7-opt-1', 'gf-battle-brothers-apc-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-7-opt-2', 'gf-battle-brothers-apc-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-7-opt-3', 'gf-battle-brothers-apc-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-8', 'gf-battle-brothers-apc', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-apc-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-8-opt-0', 'gf-battle-brothers-apc-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-8-opt-1', 'gf-battle-brothers-apc-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-8-opt-2', 'gf-battle-brothers-apc-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-apc-grp-8-opt-3', 'gf-battle-brothers-apc-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-attack-apc', 'gf-battle-brothers', 'Attack APC', 1, 205, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-apc', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-apc', 'universal-impact', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-apc', 'gf-battle-brothers-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-apc', 'universal-transport', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-apc', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-apc', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-attack-apc', 'gf-battle-brothers-twin-heavy-flamer', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-1', 'gf-battle-brothers-attack-apc', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-apc-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-apc-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-1-opt-0', 'gf-battle-brothers-attack-apc-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-1-opt-1', 'gf-battle-brothers-attack-apc-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-1-opt-2', 'gf-battle-brothers-attack-apc-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-1-opt-3', 'gf-battle-brothers-attack-apc-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-2', 'gf-battle-brothers-attack-apc', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-apc-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-2-opt-0', 'gf-battle-brothers-attack-apc-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-2-opt-1', 'gf-battle-brothers-attack-apc-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-2-opt-2', 'gf-battle-brothers-attack-apc-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-2-opt-3', 'gf-battle-brothers-attack-apc-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-2-opt-4', 'gf-battle-brothers-attack-apc-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-2-opt-5', 'gf-battle-brothers-attack-apc-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-3', 'gf-battle-brothers-attack-apc', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-apc-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-3-opt-0', 'gf-battle-brothers-attack-apc-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-3-opt-1', 'gf-battle-brothers-attack-apc-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-3-opt-2', 'gf-battle-brothers-attack-apc-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-3-opt-3', 'gf-battle-brothers-attack-apc-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-4', 'gf-battle-brothers-attack-apc', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-apc-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-4-opt-0', 'gf-battle-brothers-attack-apc-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-4-opt-1', 'gf-battle-brothers-attack-apc-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-4-opt-2', 'gf-battle-brothers-attack-apc-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-apc-grp-4-opt-3', 'gf-battle-brothers-attack-apc-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-drop-pod', 'gf-battle-brothers', 'Drop Pod', 1, 135, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-drop-pod', 'universal-ambush', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-drop-pod', 'universal-immobile', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-drop-pod', 'gf-battle-brothers-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-drop-pod', 'universal-transport', 11);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-drop-pod', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-drop-pod', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-drop-pod', 'gf-battle-brothers-death-launcher', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-1', 'gf-battle-brothers-drop-pod', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-drop-pod-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-drop-pod-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-1-opt-0', 'gf-battle-brothers-drop-pod-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-1-opt-1', 'gf-battle-brothers-drop-pod-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-1-opt-2', 'gf-battle-brothers-drop-pod-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-1-opt-3', 'gf-battle-brothers-drop-pod-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-2', 'gf-battle-brothers-drop-pod', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-drop-pod-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-2-opt-0', 'gf-battle-brothers-drop-pod-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-2-opt-1', 'gf-battle-brothers-drop-pod-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-2-opt-2', 'gf-battle-brothers-drop-pod-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-2-opt-3', 'gf-battle-brothers-drop-pod-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-2-opt-4', 'gf-battle-brothers-drop-pod-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-2-opt-5', 'gf-battle-brothers-drop-pod-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-3', 'gf-battle-brothers-drop-pod', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-drop-pod-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-3-opt-0', 'gf-battle-brothers-drop-pod-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-3-opt-1', 'gf-battle-brothers-drop-pod-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-3-opt-2', 'gf-battle-brothers-drop-pod-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-3-opt-3', 'gf-battle-brothers-drop-pod-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-4', 'gf-battle-brothers-drop-pod', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-drop-pod-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-4-opt-0', 'gf-battle-brothers-drop-pod-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-4-opt-1', 'gf-battle-brothers-drop-pod-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-4-opt-2', 'gf-battle-brothers-drop-pod-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-drop-pod-grp-4-opt-3', 'gf-battle-brothers-drop-pod-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-battle-tank', 'gf-battle-brothers', 'Battle Tank', 1, 475, 3, 2, 'vehicle');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-battle-tank', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-battle-tank', 'gf-battle-brothers-tough', 12);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-battle-tank', 'universal-impact', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-battle-tank', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-battle-tank', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-battle-tank', 'gf-battle-brothers-twin-heavy-machinegun', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-battle-tank', 'gf-battle-brothers-twin-storm-cannon', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-1', 'gf-battle-brothers-battle-tank', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-1-opt-0', 'gf-battle-brothers-battle-tank-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-1-opt-1', 'gf-battle-brothers-battle-tank-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-1-opt-2', 'gf-battle-brothers-battle-tank-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-1-opt-3', 'gf-battle-brothers-battle-tank-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-2', 'gf-battle-brothers-battle-tank', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-2-opt-0', 'gf-battle-brothers-battle-tank-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-2-opt-1', 'gf-battle-brothers-battle-tank-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-2-opt-2', 'gf-battle-brothers-battle-tank-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-2-opt-3', 'gf-battle-brothers-battle-tank-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-2-opt-4', 'gf-battle-brothers-battle-tank-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-2-opt-5', 'gf-battle-brothers-battle-tank-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-3', 'gf-battle-brothers-battle-tank', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-3-opt-0', 'gf-battle-brothers-battle-tank-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-3-opt-1', 'gf-battle-brothers-battle-tank-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-3-opt-2', 'gf-battle-brothers-battle-tank-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-3-opt-3', 'gf-battle-brothers-battle-tank-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-4', 'gf-battle-brothers-battle-tank', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-4-opt-0', 'gf-battle-brothers-battle-tank-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-4-opt-1', 'gf-battle-brothers-battle-tank-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-4-opt-2', 'gf-battle-brothers-battle-tank-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-4-opt-3', 'gf-battle-brothers-battle-tank-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-5', 'gf-battle-brothers-battle-tank', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-5-opt-0', 'gf-battle-brothers-battle-tank-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-5-opt-1', 'gf-battle-brothers-battle-tank-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-5-opt-2', 'gf-battle-brothers-battle-tank-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-5-opt-3', 'gf-battle-brothers-battle-tank-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-6', 'gf-battle-brothers-battle-tank', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-6-opt-0', 'gf-battle-brothers-battle-tank-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-6-opt-1', 'gf-battle-brothers-battle-tank-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-6-opt-2', 'gf-battle-brothers-battle-tank-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-6-opt-3', 'gf-battle-brothers-battle-tank-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-6-opt-4', 'gf-battle-brothers-battle-tank-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-6-opt-5', 'gf-battle-brothers-battle-tank-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-7', 'gf-battle-brothers-battle-tank', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-7-opt-0', 'gf-battle-brothers-battle-tank-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-7-opt-1', 'gf-battle-brothers-battle-tank-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-7-opt-2', 'gf-battle-brothers-battle-tank-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-7-opt-3', 'gf-battle-brothers-battle-tank-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-8', 'gf-battle-brothers-battle-tank', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-battle-tank-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-8-opt-0', 'gf-battle-brothers-battle-tank-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-8-opt-1', 'gf-battle-brothers-battle-tank-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-8-opt-2', 'gf-battle-brothers-battle-tank-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-battle-tank-grp-8-opt-3', 'gf-battle-brothers-battle-tank-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-heavy-tank', 'gf-battle-brothers', 'Heavy Tank', 1, 740, 3, 2, 'vehicle');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-tank', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-tank', 'gf-battle-brothers-tough', 18);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-tank', 'universal-impact', 9);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-tank', 'universal-transport', 11);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-tank', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-tank', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-heavy-tank', 'gf-battle-brothers-twin-heavy-machinegun', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-heavy-tank', 'gf-battle-brothers-twin-heavy-rifle-array', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-1', 'gf-battle-brothers-heavy-tank', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-1-opt-0', 'gf-battle-brothers-heavy-tank-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-1-opt-1', 'gf-battle-brothers-heavy-tank-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-1-opt-2', 'gf-battle-brothers-heavy-tank-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-1-opt-3', 'gf-battle-brothers-heavy-tank-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-2', 'gf-battle-brothers-heavy-tank', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-2-opt-0', 'gf-battle-brothers-heavy-tank-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-2-opt-1', 'gf-battle-brothers-heavy-tank-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-2-opt-2', 'gf-battle-brothers-heavy-tank-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-2-opt-3', 'gf-battle-brothers-heavy-tank-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-2-opt-4', 'gf-battle-brothers-heavy-tank-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-2-opt-5', 'gf-battle-brothers-heavy-tank-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-3', 'gf-battle-brothers-heavy-tank', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-3-opt-0', 'gf-battle-brothers-heavy-tank-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-3-opt-1', 'gf-battle-brothers-heavy-tank-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-3-opt-2', 'gf-battle-brothers-heavy-tank-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-3-opt-3', 'gf-battle-brothers-heavy-tank-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-4', 'gf-battle-brothers-heavy-tank', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-4-opt-0', 'gf-battle-brothers-heavy-tank-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-4-opt-1', 'gf-battle-brothers-heavy-tank-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-4-opt-2', 'gf-battle-brothers-heavy-tank-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-4-opt-3', 'gf-battle-brothers-heavy-tank-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-5', 'gf-battle-brothers-heavy-tank', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 5);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-5', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-5', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-5-opt-0', 'gf-battle-brothers-heavy-tank-grp-5', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-5-opt-1', 'gf-battle-brothers-heavy-tank-grp-5', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-5-opt-2', 'gf-battle-brothers-heavy-tank-grp-5', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-5-opt-3', 'gf-battle-brothers-heavy-tank-grp-5', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-6', 'gf-battle-brothers-heavy-tank', 'Replace Gravity Pistol', 1, 'one-model', 1, 6);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-6', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-6-opt-0', 'gf-battle-brothers-heavy-tank-grp-6', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-6-opt-1', 'gf-battle-brothers-heavy-tank-grp-6', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-6-opt-2', 'gf-battle-brothers-heavy-tank-grp-6', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-6-opt-3', 'gf-battle-brothers-heavy-tank-grp-6', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-6-opt-4', 'gf-battle-brothers-heavy-tank-grp-6', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-6-opt-5', 'gf-battle-brothers-heavy-tank-grp-6', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-7', 'gf-battle-brothers-heavy-tank', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 7);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-7', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-7-opt-0', 'gf-battle-brothers-heavy-tank-grp-7', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-7-opt-1', 'gf-battle-brothers-heavy-tank-grp-7', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-7-opt-2', 'gf-battle-brothers-heavy-tank-grp-7', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-7-opt-3', 'gf-battle-brothers-heavy-tank-grp-7', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-8', 'gf-battle-brothers-heavy-tank', 'Replace CCW', 1, 'one-model', 1, 8);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-tank-grp-8', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-8-opt-0', 'gf-battle-brothers-heavy-tank-grp-8', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-8-opt-1', 'gf-battle-brothers-heavy-tank-grp-8', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-8-opt-2', 'gf-battle-brothers-heavy-tank-grp-8', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-tank-grp-8-opt-3', 'gf-battle-brothers-heavy-tank-grp-8', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-attack-speeder', 'gf-battle-brothers', 'Attack Speeder', 1, 215, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-speeder', 'universal-ambush', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-speeder', 'universal-fast', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-speeder', 'universal-impact', 3);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-speeder', 'universal-strider', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-speeder', 'gf-battle-brothers-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-speeder', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-attack-speeder', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-attack-speeder', 'gf-battle-brothers-heavy-flamer', 2);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-1', 'gf-battle-brothers-attack-speeder', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-speeder-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-speeder-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-1-opt-0', 'gf-battle-brothers-attack-speeder-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-1-opt-1', 'gf-battle-brothers-attack-speeder-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-1-opt-2', 'gf-battle-brothers-attack-speeder-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-1-opt-3', 'gf-battle-brothers-attack-speeder-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-2', 'gf-battle-brothers-attack-speeder', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-speeder-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-2-opt-0', 'gf-battle-brothers-attack-speeder-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-2-opt-1', 'gf-battle-brothers-attack-speeder-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-2-opt-2', 'gf-battle-brothers-attack-speeder-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-2-opt-3', 'gf-battle-brothers-attack-speeder-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-2-opt-4', 'gf-battle-brothers-attack-speeder-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-2-opt-5', 'gf-battle-brothers-attack-speeder-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-3', 'gf-battle-brothers-attack-speeder', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-speeder-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-3-opt-0', 'gf-battle-brothers-attack-speeder-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-3-opt-1', 'gf-battle-brothers-attack-speeder-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-3-opt-2', 'gf-battle-brothers-attack-speeder-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-3-opt-3', 'gf-battle-brothers-attack-speeder-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-4', 'gf-battle-brothers-attack-speeder', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-attack-speeder-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-4-opt-0', 'gf-battle-brothers-attack-speeder-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-4-opt-1', 'gf-battle-brothers-attack-speeder-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-4-opt-2', 'gf-battle-brothers-attack-speeder-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-attack-speeder-grp-4-opt-3', 'gf-battle-brothers-attack-speeder-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-heavy-exo-suit', 'gf-battle-brothers', 'Heavy Exo-Suit', 1, 165, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-exo-suit', 'universal-fear', 1);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-exo-suit', 'gf-battle-brothers-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-exo-suit', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-exo-suit', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-heavy-exo-suit', 'gf-battle-brothers-twin-flamer', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-heavy-exo-suit', 'gf-battle-brothers-stomp', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-1', 'gf-battle-brothers-heavy-exo-suit', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-1-opt-0', 'gf-battle-brothers-heavy-exo-suit-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-1-opt-1', 'gf-battle-brothers-heavy-exo-suit-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-1-opt-2', 'gf-battle-brothers-heavy-exo-suit-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-1-opt-3', 'gf-battle-brothers-heavy-exo-suit-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-2', 'gf-battle-brothers-heavy-exo-suit', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-2-opt-0', 'gf-battle-brothers-heavy-exo-suit-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-2-opt-1', 'gf-battle-brothers-heavy-exo-suit-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-2-opt-2', 'gf-battle-brothers-heavy-exo-suit-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-2-opt-3', 'gf-battle-brothers-heavy-exo-suit-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-2-opt-4', 'gf-battle-brothers-heavy-exo-suit-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-2-opt-5', 'gf-battle-brothers-heavy-exo-suit-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-3', 'gf-battle-brothers-heavy-exo-suit', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-3-opt-0', 'gf-battle-brothers-heavy-exo-suit-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-3-opt-1', 'gf-battle-brothers-heavy-exo-suit-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-3-opt-2', 'gf-battle-brothers-heavy-exo-suit-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-3-opt-3', 'gf-battle-brothers-heavy-exo-suit-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-4', 'gf-battle-brothers-heavy-exo-suit', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-4-opt-0', 'gf-battle-brothers-heavy-exo-suit-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-4-opt-1', 'gf-battle-brothers-heavy-exo-suit-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-4-opt-2', 'gf-battle-brothers-heavy-exo-suit-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-exo-suit-grp-4-opt-3', 'gf-battle-brothers-heavy-exo-suit-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-combat-walker', 'gf-battle-brothers', 'Combat Walker', 1, 365, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-combat-walker', 'universal-fear', 2);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-combat-walker', 'gf-battle-brothers-tough', 12);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-combat-walker', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-combat-walker', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-combat-walker', 'gf-battle-brothers-stomp', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-combat-walker', 'gf-battle-brothers-walker-fist', 2);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-1', 'gf-battle-brothers-combat-walker', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-combat-walker-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-combat-walker-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-1-opt-0', 'gf-battle-brothers-combat-walker-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-1-opt-1', 'gf-battle-brothers-combat-walker-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-1-opt-2', 'gf-battle-brothers-combat-walker-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-1-opt-3', 'gf-battle-brothers-combat-walker-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-2', 'gf-battle-brothers-combat-walker', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-combat-walker-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-2-opt-0', 'gf-battle-brothers-combat-walker-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-2-opt-1', 'gf-battle-brothers-combat-walker-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-2-opt-2', 'gf-battle-brothers-combat-walker-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-2-opt-3', 'gf-battle-brothers-combat-walker-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-2-opt-4', 'gf-battle-brothers-combat-walker-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-2-opt-5', 'gf-battle-brothers-combat-walker-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-3', 'gf-battle-brothers-combat-walker', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-combat-walker-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-3-opt-0', 'gf-battle-brothers-combat-walker-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-3-opt-1', 'gf-battle-brothers-combat-walker-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-3-opt-2', 'gf-battle-brothers-combat-walker-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-3-opt-3', 'gf-battle-brothers-combat-walker-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-4', 'gf-battle-brothers-combat-walker', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-combat-walker-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-4-opt-0', 'gf-battle-brothers-combat-walker-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-4-opt-1', 'gf-battle-brothers-combat-walker-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-4-opt-2', 'gf-battle-brothers-combat-walker-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-combat-walker-grp-4-opt-3', 'gf-battle-brothers-combat-walker-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-veteran-combat-walker', 'gf-battle-brothers', 'Veteran Combat Walker', 1, 420, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-combat-walker', 'universal-fear', 2);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-combat-walker', 'gf-battle-brothers-tough', 12);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-combat-walker', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-combat-walker', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-veteran-combat-walker', 'gf-battle-brothers-versatile-attack', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-veteran-combat-walker', 'gf-battle-brothers-stomp', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-veteran-combat-walker', 'gf-battle-brothers-walker-fist', 2);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-1', 'gf-battle-brothers-veteran-combat-walker', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-1-opt-0', 'gf-battle-brothers-veteran-combat-walker-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-1-opt-1', 'gf-battle-brothers-veteran-combat-walker-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-1-opt-2', 'gf-battle-brothers-veteran-combat-walker-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-1-opt-3', 'gf-battle-brothers-veteran-combat-walker-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-2', 'gf-battle-brothers-veteran-combat-walker', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-2-opt-0', 'gf-battle-brothers-veteran-combat-walker-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-2-opt-1', 'gf-battle-brothers-veteran-combat-walker-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-2-opt-2', 'gf-battle-brothers-veteran-combat-walker-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-2-opt-3', 'gf-battle-brothers-veteran-combat-walker-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-2-opt-4', 'gf-battle-brothers-veteran-combat-walker-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-2-opt-5', 'gf-battle-brothers-veteran-combat-walker-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-3', 'gf-battle-brothers-veteran-combat-walker', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-3-opt-0', 'gf-battle-brothers-veteran-combat-walker-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-3-opt-1', 'gf-battle-brothers-veteran-combat-walker-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-3-opt-2', 'gf-battle-brothers-veteran-combat-walker-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-3-opt-3', 'gf-battle-brothers-veteran-combat-walker-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-4', 'gf-battle-brothers-veteran-combat-walker', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-4-opt-0', 'gf-battle-brothers-veteran-combat-walker-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-4-opt-1', 'gf-battle-brothers-veteran-combat-walker-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-4-opt-2', 'gf-battle-brothers-veteran-combat-walker-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-veteran-combat-walker-grp-4-opt-3', 'gf-battle-brothers-veteran-combat-walker-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-light-gunship', 'gf-battle-brothers', 'Light Gunship', 1, 340, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-light-gunship', 'universal-aircraft', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-light-gunship', 'gf-battle-brothers-tough', 6);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-light-gunship', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-light-gunship', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-light-gunship', 'gf-battle-brothers-minigun', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-light-gunship', 'gf-battle-brothers-twin-typhoon-missiles', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-1', 'gf-battle-brothers-light-gunship', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-light-gunship-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-light-gunship-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-1-opt-0', 'gf-battle-brothers-light-gunship-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-1-opt-1', 'gf-battle-brothers-light-gunship-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-1-opt-2', 'gf-battle-brothers-light-gunship-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-1-opt-3', 'gf-battle-brothers-light-gunship-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-2', 'gf-battle-brothers-light-gunship', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-light-gunship-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-2-opt-0', 'gf-battle-brothers-light-gunship-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-2-opt-1', 'gf-battle-brothers-light-gunship-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-2-opt-2', 'gf-battle-brothers-light-gunship-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-2-opt-3', 'gf-battle-brothers-light-gunship-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-2-opt-4', 'gf-battle-brothers-light-gunship-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-2-opt-5', 'gf-battle-brothers-light-gunship-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-3', 'gf-battle-brothers-light-gunship', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-light-gunship-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-3-opt-0', 'gf-battle-brothers-light-gunship-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-3-opt-1', 'gf-battle-brothers-light-gunship-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-3-opt-2', 'gf-battle-brothers-light-gunship-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-3-opt-3', 'gf-battle-brothers-light-gunship-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-4', 'gf-battle-brothers-light-gunship', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-light-gunship-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-4-opt-0', 'gf-battle-brothers-light-gunship-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-4-opt-1', 'gf-battle-brothers-light-gunship-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-4-opt-2', 'gf-battle-brothers-light-gunship-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-light-gunship-grp-4-opt-3', 'gf-battle-brothers-light-gunship-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-heavy-gunship', 'gf-battle-brothers', 'Heavy Gunship', 1, 625, 3, 2, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-gunship', 'universal-aircraft', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-gunship', 'gf-battle-brothers-tough', 9);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-gunship', 'universal-transport', 11);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-gunship', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-heavy-gunship', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-heavy-gunship', 'gf-battle-brothers-storm-missiles', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-heavy-gunship', 'gf-battle-brothers-light-heavy-rifle-array', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-heavy-gunship', 'gf-battle-brothers-twin-minigun', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-heavy-gunship', 'gf-battle-brothers-typhoon-missiles', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-1', 'gf-battle-brothers-heavy-gunship', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-1-opt-0', 'gf-battle-brothers-heavy-gunship-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-1-opt-1', 'gf-battle-brothers-heavy-gunship-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-1-opt-2', 'gf-battle-brothers-heavy-gunship-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-1-opt-3', 'gf-battle-brothers-heavy-gunship-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-2', 'gf-battle-brothers-heavy-gunship', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-2-opt-0', 'gf-battle-brothers-heavy-gunship-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-2-opt-1', 'gf-battle-brothers-heavy-gunship-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-2-opt-2', 'gf-battle-brothers-heavy-gunship-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-2-opt-3', 'gf-battle-brothers-heavy-gunship-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-2-opt-4', 'gf-battle-brothers-heavy-gunship-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-2-opt-5', 'gf-battle-brothers-heavy-gunship-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-3', 'gf-battle-brothers-heavy-gunship', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-3-opt-0', 'gf-battle-brothers-heavy-gunship-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-3-opt-1', 'gf-battle-brothers-heavy-gunship-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-3-opt-2', 'gf-battle-brothers-heavy-gunship-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-3-opt-3', 'gf-battle-brothers-heavy-gunship-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-4', 'gf-battle-brothers-heavy-gunship', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-4-opt-0', 'gf-battle-brothers-heavy-gunship-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-4-opt-1', 'gf-battle-brothers-heavy-gunship-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-4-opt-2', 'gf-battle-brothers-heavy-gunship-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-heavy-gunship-grp-4-opt-3', 'gf-battle-brothers-heavy-gunship-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

INSERT OR IGNORE INTO opr_units (id, army_id, name, size, cost, quality, defense, unit_type) VALUES
  ('gf-battle-brothers-artillery-gun', 'gf-battle-brothers', 'Artillery Gun', 1, 165, 3, 3, 'hero');
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-artillery-gun', 'gf-battle-brothers-artillery', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-artillery-gun', 'gf-battle-brothers-battleborn', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-artillery-gun', 'universal-fearless', 0);
INSERT OR IGNORE INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
  ('gf-battle-brothers-artillery-gun', 'gf-battle-brothers-tough', 3);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-artillery-gun', 'gf-battle-brothers-heavy-gatling-cannon', 1);
INSERT OR IGNORE INTO opr_unit_equipment (unit_id, equipment_id, count) VALUES
  ('gf-battle-brothers-artillery-gun', 'gf-battle-brothers-crew', 1);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-1', 'gf-battle-brothers-artillery-gun', 'Replace Combat Shield and CCW', 1, 'one-model', 1, 1);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-artillery-gun-grp-1', 'gf-battle-brothers-combat-shield');
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-artillery-gun-grp-1', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-1-opt-0', 'gf-battle-brothers-artillery-gun-grp-1', 'gf-battle-brothers-ccw', 0, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-1-opt-1', 'gf-battle-brothers-artillery-gun-grp-1', 'gf-battle-brothers-gravity-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-1-opt-2', 'gf-battle-brothers-artillery-gun-grp-1', 'gf-battle-brothers-dual-energy-claws', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-1-opt-3', 'gf-battle-brothers-artillery-gun-grp-1', 'gf-battle-brothers-heavy-chainsaw-sword', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-2', 'gf-battle-brothers-artillery-gun', 'Replace Gravity Pistol', 1, 'one-model', 1, 2);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-artillery-gun-grp-2', 'gf-battle-brothers-gravity-pistol');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-2-opt-0', 'gf-battle-brothers-artillery-gun-grp-2', 'gf-battle-brothers-flamer-pistol', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-2-opt-1', 'gf-battle-brothers-artillery-gun-grp-2', 'gf-battle-brothers-master-heavy-pistol', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-2-opt-2', 'gf-battle-brothers-artillery-gun-grp-2', 'gf-battle-brothers-fusion-pistol', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-2-opt-3', 'gf-battle-brothers-artillery-gun-grp-2', 'gf-battle-brothers-master-plasma-pistol', 10, 3);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-2-opt-4', 'gf-battle-brothers-artillery-gun-grp-2', 'gf-battle-brothers-master-heavy-rifle', 15, 4);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-2-opt-5', 'gf-battle-brothers-artillery-gun-grp-2', 'gf-battle-brothers-master-storm-rifle', 45, 5);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-3', 'gf-battle-brothers-artillery-gun', 'Take one Master Heavy Rifle attachment', 1, 'exactly', 1, 3);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-artillery-gun-grp-3', 'gf-battle-brothers-master-heavy-rifle');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-3-opt-0', 'gf-battle-brothers-artillery-gun-grp-3', 'gf-battle-brothers-gravity-mod', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-3-opt-1', 'gf-battle-brothers-artillery-gun-grp-3', 'gf-battle-brothers-flamer-mod', 0, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-3-opt-2', 'gf-battle-brothers-artillery-gun-grp-3', 'gf-battle-brothers-plasma-mod', 5, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-3-opt-3', 'gf-battle-brothers-artillery-gun-grp-3', 'gf-battle-brothers-fusion-mod', 5, 3);
INSERT OR IGNORE INTO opr_upgrade_groups (id, unit_id, label, select_max, affects, affects_count, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-4', 'gf-battle-brothers-artillery-gun', 'Replace CCW', 1, 'one-model', 1, 4);
INSERT OR IGNORE INTO opr_upgrade_group_replaces (group_id, equipment_id) VALUES
  ('gf-battle-brothers-artillery-gun-grp-4', 'gf-battle-brothers-ccw');
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-4-opt-0', 'gf-battle-brothers-artillery-gun-grp-4', 'gf-battle-brothers-energy-hammer', 5, 0);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-4-opt-1', 'gf-battle-brothers-artillery-gun-grp-4', 'gf-battle-brothers-energy-sword', 10, 1);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-4-opt-2', 'gf-battle-brothers-artillery-gun-grp-4', 'gf-battle-brothers-energy-fist', 15, 2);
INSERT OR IGNORE INTO opr_upgrade_options (id, group_id, equipment_id, cost, sort_order) VALUES
  ('gf-battle-brothers-artillery-gun-grp-4-opt-3', 'gf-battle-brothers-artillery-gun-grp-4', 'gf-battle-brothers-chain-fist', 15, 3);

