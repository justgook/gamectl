-- Grimdark Future - Alien Hives Units
-- Real data from GF - Alien Hives v3.5.1 PDF
-- Fully normalized with upgrade groups and weapon special rules

-- ============================================================================
-- UNITS
-- ============================================================================

INSERT INTO opr_units (id, army_id, name, size, cost, quality, defense, tough, unit_type, notes) VALUES
-- Heroes
('gf-ah-hive-lord', 'gf-alien-hives', 'Hive Lord', 1, 345, 3, 2, 12, 'Hero', 'Apex predator commander'),
('gf-ah-grunt-veteran', 'gf-alien-hives', 'Grunt Veteran', 1, 20, 5, 5, 3, 'Hero', 'Veteran grunt leader'),

-- Infantry
('gf-ah-assault-grunts', 'gf-alien-hives', 'Assault Grunts', 10, 110, 5, 5, NULL, 'Infantry', 'Fast assault swarm'),
('gf-ah-shooter-grunts', 'gf-alien-hives', 'Shooter Grunts', 10, 110, 5, 5, NULL, 'Infantry', 'Ranged swarm troops');

-- ============================================================================
-- UNIT SPECIAL RULES
-- ============================================================================

-- Hive Lord
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-hive-lord', 'fear', '2'),
('gf-ah-hive-lord', 'fearless', NULL),
('gf-ah-hive-lord', 'hero', NULL),
('gf-ah-hive-lord', 'hive-bond', NULL);

-- Grunt Veteran
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-grunt-veteran', 'hero', NULL),
('gf-ah-grunt-veteran', 'hive-bond', NULL),
('gf-ah-grunt-veteran', 'strider', NULL);

-- Assault Grunts
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-assault-grunts', 'fast', NULL),
('gf-ah-assault-grunts', 'hive-bond', NULL),
('gf-ah-assault-grunts', 'strider', NULL);

-- Shooter Grunts
INSERT INTO opr_unit_special_rules (unit_id, special_rule_id, rating) VALUES
('gf-ah-shooter-grunts', 'hive-bond', NULL),
('gf-ah-shooter-grunts', 'strider', NULL);

-- ============================================================================
-- UNIT WEAPONS (Base Loadouts)
-- ============================================================================

-- Hive Lord: 1x Shredder Cannon, 2x Heavy Razor Claws, 1x Stomp
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-hive-lord', 'shredder-cannon', 1, 1),
('gf-ah-hive-lord', 'heavy-razor-claws', 2, 1),
('gf-ah-hive-lord', 'stomp', 1, 1);

-- Grunt Veteran: 1x Razor Claws
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-grunt-veteran', 'razor-claws-a2', 1, 1);

-- Assault Grunts: 10x Razor Claws (A2)
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-assault-grunts', 'razor-claws-a2', 10, 1);

-- Shooter Grunts: 10x Bio-Spiners, 10x Razor Claws (A1)
INSERT INTO opr_unit_weapons (unit_id, weapon_id, count, is_default) VALUES
('gf-ah-shooter-grunts', 'bio-spiners', 10, 1),
('gf-ah-shooter-grunts', 'razor-claws', 10, 1);

-- ============================================================================
-- UPGRADE GROUPS
-- ============================================================================

-- Hive Lord Upgrade Groups
INSERT INTO opr_upgrade_groups (id, unit_id, label, selection_type, min_selections, max_selections, applies_to, applies_count, sort_order) VALUES
('gf-ah-hive-lord-ug1', 'gf-ah-hive-lord', 'Upgrade with one', 'pick-one', 0, 1, 'one-model', NULL, 1),
('gf-ah-hive-lord-ug2', 'gf-ah-hive-lord', 'Replace Shredder Gun', 'pick-any', 0, 1, 'one-model', NULL, 2),
('gf-ah-hive-lord-ug3', 'gf-ah-hive-lord', 'Replace Shredder Cannon', 'pick-any', 0, 1, 'one-model', NULL, 3),
('gf-ah-hive-lord-ug4', 'gf-ah-hive-lord', 'Replace any Heavy Razor Claw', 'pick-any', 0, 2, 'any-model', NULL, 4),
('gf-ah-hive-lord-ug5', 'gf-ah-hive-lord', 'Additional Upgrades', 'pick-any', 0, 2, 'one-model', NULL, 5);

-- Grunt Veteran Upgrade Groups
INSERT INTO opr_upgrade_groups (id, unit_id, label, selection_type, min_selections, max_selections, applies_to, applies_count, sort_order) VALUES
('gf-ah-grunt-veteran-ug1', 'gf-ah-grunt-veteran', 'Upgrade with one', 'pick-one', 0, 1, 'one-model', NULL, 1),
('gf-ah-grunt-veteran-ug2', 'gf-ah-grunt-veteran', 'Replace Razor Claw', 'pick-any', 0, 1, 'one-model', NULL, 2),
('gf-ah-grunt-veteran-ug3', 'gf-ah-grunt-veteran', 'Additional Upgrades', 'pick-any', 0, 1, 'one-model', NULL, 3);

-- Assault Grunts Upgrade Groups
INSERT INTO opr_upgrade_groups (id, unit_id, label, selection_type, min_selections, max_selections, applies_to, applies_count, sort_order) VALUES
('gf-ah-assault-grunts-ug1', 'gf-ah-assault-grunts', 'Replace up to two Razor Claws', 'pick-any', 0, 2, 'up-to-X-models', 2, 1),
('gf-ah-assault-grunts-ug2', 'gf-ah-assault-grunts', 'Upgrade all models with one', 'pick-one', 0, 1, 'all-models', NULL, 2);

-- Shooter Grunts Upgrade Groups
INSERT INTO opr_upgrade_groups (id, unit_id, label, selection_type, min_selections, max_selections, applies_to, applies_count, sort_order) VALUES
('gf-ah-shooter-grunts-ug1', 'gf-ah-shooter-grunts', 'Replace all Bio-Spiners', 'pick-one', 0, 1, 'all-models', NULL, 1),
('gf-ah-shooter-grunts-ug2', 'gf-ah-shooter-grunts', 'Replace up to two Bio-Spiners', 'pick-any', 0, 2, 'up-to-X-models', 2, 2),
('gf-ah-shooter-grunts-ug3', 'gf-ah-shooter-grunts', 'Upgrade all models with one', 'pick-one', 0, 1, 'all-models', NULL, 3),
('gf-ah-shooter-grunts-ug4', 'gf-ah-shooter-grunts', 'Additional Upgrades', 'pick-any', 0, 2, 'one-model', NULL, 4);

-- ============================================================================
-- UPGRADES
-- ============================================================================

-- Hive Lord Upgrades
-- Group 1: Upgrade with one (aura special rules)
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, adds_special_rule_id, sort_order) VALUES
('gf-ah-hive-lord-up1', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug1', 'add-rule', 'Pheromone Host (Hive Bond Boost Aura)', 5, 'This model and its unit get Hive Bond Boost', 'hive-bond-boost-aura', 1),
('gf-ah-hive-lord-up2', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug1', 'add-rule', 'Brood Leader (Rapid Charge Aura)', 10, 'This model and its unit moves +4" when using Charge actions', 'rapid-charge-aura', 2),
('gf-ah-hive-lord-up3', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug1', 'add-rule', 'Combat Bio-Engineer (Furious Aura)', 20, 'This model and its unit get Furious', 'furious-aura', 3),
('gf-ah-hive-lord-up4', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug1', 'add-rule', 'Bio-Tech Master (Increased Shooting Range Aura)', 35, 'This model and its unit get +6" range when shooting', 'increased-shooting-range-aura', 4),
('gf-ah-hive-lord-up5', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug1', 'add-rule', 'Psychic Synapses (Caster(2))', 40, 'May cast 2 spells per activation', 'caster', 5);

-- Group 2: Replace Shredder Gun (doesn't exist on Hive Lord, but leaving pattern for reference)

-- Group 3: Replace Shredder Cannon
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, replaces_weapon_id, adds_weapon_id, sort_order) VALUES
('gf-ah-hive-lord-up6', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug3', 'replace-weapon', '2x Heavy Razor Claws (A3, AP(1))', 5, 'Replace Shredder Cannon with 2x Heavy Razor Claws', 'shredder-cannon', 'heavy-razor-claws', 1),
('gf-ah-hive-lord-up7', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug3', 'replace-weapon', 'Spitter Cannon (24", A2, Blast(3))', 15, 'Replace Shredder Cannon with Spitter Cannon', 'shredder-cannon', 'spitter-cannon', 2),
('gf-ah-hive-lord-up8', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug3', 'replace-weapon', 'Barb Cannon (36", A1, AP(2), Blast(3))', 25, 'Replace Shredder Cannon with Barb Cannon', 'shredder-cannon', 'barb-cannon', 3);

-- Group 4: Replace any Heavy Razor Claw
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, replaces_weapon_id, adds_weapon_id, sort_order) VALUES
('gf-ah-hive-lord-up9', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug4', 'replace-weapon', 'Serrated Blade (A2, AP(4))', 5, 'Replace one Heavy Razor Claw with Serrated Blade', 'heavy-razor-claws', 'serrated-blade-a2', 1),
('gf-ah-hive-lord-up10', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug4', 'replace-weapon', 'Piercing Spike (A1, AP(2), Deadly(3))', 5, 'Replace one Heavy Razor Claw with Piercing Spike', 'heavy-razor-claws', 'piercing-spike', 2),
('gf-ah-hive-lord-up11', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug4', 'replace-weapon', 'Smashing Club (A1, AP(2), Blast(3))', 5, 'Replace one Heavy Razor Claw with Smashing Club', 'heavy-razor-claws', 'smashing-club', 3),
('gf-ah-hive-lord-up12', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug4', 'replace-weapon', 'Slashing Blade (A3, AP(1), Rending)', 5, 'Replace one Heavy Razor Claw with Slashing Blade', 'heavy-razor-claws', 'slashing-blade', 4),
('gf-ah-hive-lord-up13', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug4', 'replace-weapon', 'Razor Whip (A4, Bane, Precise)', 20, 'Replace one Heavy Razor Claw with Razor Whip', 'heavy-razor-claws', 'razor-whip-a4', 5);

-- Group 5: Additional Upgrades
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, adds_special_rule_id, adds_special_rule_rating, sort_order) VALUES
('gf-ah-hive-lord-up14', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug5', 'add-rule', 'Wings (Ambush, Flying)', 60, 'Unit gains Ambush and Flying', 'ambush', NULL, 1),
('gf-ah-hive-lord-up15', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug5', 'add-rule', 'Psy-Barrier (Resistance)', 35, 'Unit gains Resistance', 'resistance', NULL, 2),
('gf-ah-hive-lord-up16', 'gf-ah-hive-lord', 'gf-ah-hive-lord-ug5', 'add-rule', 'Bio-Recovery (Regeneration)', 40, 'Unit gains Regeneration', 'regeneration', NULL, 3);

-- Grunt Veteran Upgrades
-- Group 1: Upgrade with one
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, adds_special_rule_id, sort_order) VALUES
('gf-ah-grunt-veteran-up1', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug1', 'add-rule', 'Brood Leader (Rapid Charge Aura)', 10, 'This model and its unit moves +4" when using Charge actions', 'rapid-charge-aura', 1),
('gf-ah-grunt-veteran-up2', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug1', 'add-rule', 'Hive Protector (Shielded Aura)', 15, 'This model and its unit get Shielded', 'shielded-aura', 2),
('gf-ah-grunt-veteran-up3', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug1', 'add-rule', 'Combat Bio-Engineer (Furious Aura)', 20, 'This model and its unit get Furious', 'furious-aura', 3);

-- Group 2: Replace Razor Claw
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, replaces_weapon_id, adds_weapon_id, sort_order) VALUES
('gf-ah-grunt-veteran-up4', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug2', 'replace-weapon', 'Smashing Club (A1, Blast(3))', 5, 'Replace Razor Claws with Smashing Club', 'razor-claws-a2', 'smashing-club', 1),
('gf-ah-grunt-veteran-up5', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug2', 'replace-weapon', 'Piercing Spike (A1, AP(1), Deadly(3))', 5, 'Replace Razor Claws with Piercing Spike', 'razor-claws-a2', 'piercing-spike', 2),
('gf-ah-grunt-veteran-up6', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug2', 'replace-weapon', 'Slashing Blade (A2, AP(1), Rending)', 5, 'Replace Razor Claws with Slashing Blade', 'razor-claws-a2', 'slashing-blade-a2', 3),
('gf-ah-grunt-veteran-up7', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug2', 'replace-weapon', 'Serrated Blade (A2, AP(4))', 10, 'Replace Razor Claws with Serrated Blade', 'razor-claws-a2', 'serrated-blade-a2', 4);

-- Group 3: Additional Upgrades
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, adds_special_rule_id, sort_order) VALUES
('gf-ah-grunt-veteran-up8', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug3', 'add-rule', 'Adrenaline Fueled (Agile)', 5, 'Unit gains Agile', 'agile', 1),
('gf-ah-grunt-veteran-up9', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug3', 'add-rule', 'Toxic Cysts (Bane in Melee)', 5, 'Melee attacks gain Bane', 'bane', 2),
('gf-ah-grunt-veteran-up10', 'gf-ah-grunt-veteran', 'gf-ah-grunt-veteran-ug3', 'add-rule', 'Combat Mutations (Piercing Growth)', 25, 'Unit gains Piercing Growth', 'piercing-growth', 3);

-- Assault Grunts Upgrades
-- Group 1: Replace up to two Razor Claws
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, replaces_weapon_id, adds_weapon_id, sort_order) VALUES
('gf-ah-assault-grunts-up1', 'gf-ah-assault-grunts', 'gf-ah-assault-grunts-ug1', 'replace-weapon', 'Piercing Claws (A1, AP(1), Deadly(3))', 5, 'Replace up to 2x Razor Claws with Piercing Claws', 'razor-claws-a2', 'piercing-claws', 1),
('gf-ah-assault-grunts-up2', 'gf-ah-assault-grunts', 'gf-ah-assault-grunts-ug1', 'replace-weapon', 'Smashing Claws (A1, Blast(3))', 5, 'Replace up to 2x Razor Claws with Smashing Claws', 'razor-claws-a2', 'smashing-claws', 2),
('gf-ah-assault-grunts-up3', 'gf-ah-assault-grunts', 'gf-ah-assault-grunts-ug1', 'replace-weapon', 'Slashing Claws (A2, AP(1), Rending)', 5, 'Replace up to 2x Razor Claws with Slashing Claws', 'razor-claws-a2', 'slashing-claws', 3),
('gf-ah-assault-grunts-up4', 'gf-ah-assault-grunts', 'gf-ah-assault-grunts-ug1', 'replace-weapon', 'Serrated Claws (A2, AP(4))', 10, 'Replace up to 2x Razor Claws with Serrated Claws', 'razor-claws-a2', 'serrated-claws', 4);

-- Group 2: Upgrade all models with one
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, adds_special_rule_id, sort_order) VALUES
('gf-ah-assault-grunts-up5', 'gf-ah-assault-grunts', 'gf-ah-assault-grunts-ug2', 'add-rule', 'Adrenaline Fueled (Agile)', 5, 'All models gain Agile', 'agile', 1),
('gf-ah-assault-grunts-up6', 'gf-ah-assault-grunts', 'gf-ah-assault-grunts-ug2', 'add-rule', 'Toxic Cysts (Bane in Melee)', 10, 'All models melee attacks gain Bane', 'bane', 2),
('gf-ah-assault-grunts-up7', 'gf-ah-assault-grunts', 'gf-ah-assault-grunts-ug2', 'add-rule', 'Combat Mutations (Piercing Growth)', 25, 'All models gain Piercing Growth', 'piercing-growth', 3);

-- Shooter Grunts Upgrades
-- Group 1: Replace all Bio-Spiners
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, replaces_weapon_id, adds_weapon_id, sort_order) VALUES
('gf-ah-shooter-grunts-up1', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug1', 'replace-weapon', 'Bio-Borer (12", A2)', 10, 'Replace all Bio-Spiners with Bio-Borers', 'bio-spiners', 'bio-borer', 1),
('gf-ah-shooter-grunts-up2', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug1', 'replace-weapon', 'Bio-Ravager (18", A1, AP(1))', 20, 'Replace all Bio-Spiners with Bio-Ravagers', 'bio-spiners', 'bio-ravager', 2);

-- Group 2: Replace up to two Bio-Spiners
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, replaces_weapon_id, adds_weapon_id, sort_order) VALUES
('gf-ah-shooter-grunts-up3', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug2', 'replace-weapon', 'Bio-Plasma (12", A1, AP(4))', 5, 'Replace up to 2x Bio-Spiners with Bio-Plasma', 'bio-spiners', 'bio-plasma', 1),
('gf-ah-shooter-grunts-up4', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug2', 'replace-weapon', 'Bio-Fuser (6", A1, AP(4), Deadly(3))', 5, 'Replace up to 2x Bio-Spiners with Bio-Fuser', 'bio-spiners', 'bio-fuser', 2),
('gf-ah-shooter-grunts-up5', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug2', 'replace-weapon', 'Bio-Shredder (9", A2, Rending)', 5, 'Replace up to 2x Bio-Spiners with Bio-Shredder', 'bio-spiners', 'bio-shredder', 3),
('gf-ah-shooter-grunts-up6', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug2', 'replace-weapon', 'Bio-Flamer (6", A1, Blast(3), Reliable)', 5, 'Replace up to 2x Bio-Spiners with Bio-Flamer', 'bio-spiners', 'bio-flamer', 4),
('gf-ah-shooter-grunts-up7', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug2', 'replace-weapon', 'Bio-Spiker (18", A1, AP(1), Reliable, Takedown)', 15, 'Replace up to 2x Bio-Spiners with Bio-Spiker', 'bio-spiners', 'bio-spiker', 5);

-- Group 3: Upgrade all models with one
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, modifies_stat, modifies_value, sort_order) VALUES
('gf-ah-shooter-grunts-up8', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug3', 'replace-attacks', 'Veteran Bio-Spiner (6", A3, AP(1))', 5, 'All Bio-Spiners become A3', 'attacks', 'A3', 1),
('gf-ah-shooter-grunts-up9', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug3', 'replace-attacks', 'Veteran Bio-Borer (12", A3)', 5, 'All Bio-Borers become A3', 'attacks', 'A3', 2),
('gf-ah-shooter-grunts-up10', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug3', 'replace-attacks', 'Veteran Bio-Ravager (18", A2, AP(1))', 10, 'All Bio-Ravagers become A2', 'attacks', 'A2', 3);

-- Group 4: Additional Upgrades
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, adds_special_rule_id, sort_order) VALUES
('gf-ah-shooter-grunts-up11', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug4', 'add-rule', 'Assault Breed (Fast)', 5, 'Unit gains Fast', 'fast', 1),
('gf-ah-shooter-grunts-up12', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug4', 'add-rule', 'Winged Breed (Ambush, Flying)', 5, 'Unit gains Ambush and Flying', 'ambush', 2),
('gf-ah-shooter-grunts-up13', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug4', 'add-rule', 'Psycho Breed (Resistance)', 10, 'Unit gains Resistance', 'resistance', 3);

-- One model upgrades
INSERT INTO opr_upgrades (id, unit_id, group_id, upgrade_type, name, cost, description, adds_special_rule_id, sort_order) VALUES
('gf-ah-shooter-grunts-up14', 'gf-ah-shooter-grunts', 'gf-ah-shooter-grunts-ug4', 'add-rule', 'Synaptic Relay (Spell Conduit)', 10, 'One model becomes a Spell Conduit', 'spell-conduit', 4);
