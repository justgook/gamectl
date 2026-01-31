-- +goose Up
-- Migration: opr_gf_armies
-- Grimdark Future Armies/Factions

INSERT INTO opr_armies (id, universe_id, name, version, background, color_primary) VALUES
-- Standard Armies
('gf-alien-hives', 'grimdark-future', 'Alien Hives', 'v3.5.1', 'Biotechnology-based faction with specialized castes led by Hive Lords', '#7C2D12'),
('gf-blessed-sisters', 'grimdark-future', 'Blessed Sisters', NULL, NULL, '#D4AF37'),
('gf-custodian-brothers', 'grimdark-future', 'Custodian Brothers', NULL, NULL, '#FFD700'),
('gf-dao-union', 'grimdark-future', 'DAO Union', NULL, NULL, '#4A90E2'),
('gf-dark-elf-raiders', 'grimdark-future', 'Dark Elf Raiders', NULL, NULL, '#2D1B4E'),
('gf-dwarf-guilds', 'grimdark-future', 'Dwarf Guilds', NULL, NULL, '#8B4513'),
('gf-elven-jesters', 'grimdark-future', 'Elven Jesters', NULL, NULL, '#9B59B6'),
('gf-eternal-dynasty', 'grimdark-future', 'Eternal Dynasty', NULL, NULL, '#1B5E20'),
('gf-goblin-reclaimers', 'grimdark-future', 'Goblin Reclaimers', NULL, NULL, '#7CB342'),
('gf-high-elf-fleets', 'grimdark-future', 'High Elf Fleets', NULL, NULL, '#87CEEB'),
('gf-human-defense-force', 'grimdark-future', 'Human Defense Force', NULL, NULL, '#556B2F'),
('gf-human-inquisition', 'grimdark-future', 'Human Inquisition', NULL, NULL, '#8B0000'),
('gf-infected-colonies', 'grimdark-future', 'Infected Colonies', NULL, NULL, '#4B0082'),
('gf-jackals', 'grimdark-future', 'Jackals', NULL, NULL, '#CD853F'),
('gf-machine-cult', 'grimdark-future', 'Machine Cult', NULL, NULL, '#DC143C'),
('gf-orc-marauders', 'grimdark-future', 'Orc Marauders', NULL, NULL, '#228B22'),
('gf-ratmen-clans', 'grimdark-future', 'Ratmen Clans', NULL, NULL, '#654321'),
('gf-rebel-guerrillas', 'grimdark-future', 'Rebel Guerrillas', NULL, NULL, '#8B4513'),
('gf-robot-legions', 'grimdark-future', 'Robot Legions', NULL, NULL, '#44403C'),
('gf-saurian-starhost', 'grimdark-future', 'Saurian Starhost', NULL, NULL, '#00CED1'),
('gf-soul-snatcher-cults', 'grimdark-future', 'Soul-Snatcher Cults', NULL, NULL, '#8B008B'),
('gf-titan-lords', 'grimdark-future', 'Titan Lords', NULL, NULL, '#4169E1'),

-- Battle Brothers (6 subfactions)
('gf-battle-brothers', 'grimdark-future', 'Battle Brothers', NULL, NULL, '#1E3A8A'),
('gf-blood-brothers', 'grimdark-future', 'Blood Brothers', NULL, NULL, '#8B0000'),
('gf-dark-brothers', 'grimdark-future', 'Dark Brothers', NULL, NULL, '#1C1C1C'),
('gf-knight-brothers', 'grimdark-future', 'Knight Brothers', NULL, NULL, '#C0C0C0'),
('gf-watch-brothers', 'grimdark-future', 'Watch Brothers', NULL, NULL, '#2F4F4F'),
('gf-wolf-brothers', 'grimdark-future', 'Wolf Brothers', NULL, NULL, '#696969'),

-- Havoc Brothers (5 subfactions)
('gf-havoc-brothers', 'grimdark-future', 'Havoc Brothers', NULL, NULL, '#8B0000'),
('gf-change-disciples', 'grimdark-future', 'Change Disciples', NULL, NULL, '#4169E1'),
('gf-lust-disciples', 'grimdark-future', 'Lust Disciples', NULL, NULL, '#FF1493'),
('gf-plague-disciples', 'grimdark-future', 'Plague Disciples', NULL, NULL, '#556B2F'),
('gf-war-disciples', 'grimdark-future', 'War Disciples', NULL, NULL, '#B22222'),

-- Prime Brothers (6 subfactions)
('gf-prime-brothers', 'grimdark-future', 'Prime Brothers', NULL, NULL, '#000080'),
('gf-blood-prime-brothers', 'grimdark-future', 'Blood Prime Brothers', NULL, NULL, '#8B0000'),
('gf-dark-prime-brothers', 'grimdark-future', 'Dark Prime Brothers', NULL, NULL, '#1C1C1C'),
('gf-knight-prime-brothers', 'grimdark-future', 'Knight Prime Brothers', NULL, NULL, '#C0C0C0'),
('gf-watch-prime-brothers', 'grimdark-future', 'Watch Prime Brothers', NULL, NULL, '#2F4F4F'),
('gf-wolf-prime-brothers', 'grimdark-future', 'Wolf Prime Brothers', NULL, NULL, '#696969'),

-- Wormhole Daemons (4 subfactions)
('gf-daemons-of-change', 'grimdark-future', 'Daemons of Change', NULL, NULL, '#4169E1'),
('gf-daemons-of-lust', 'grimdark-future', 'Daemons of Lust', NULL, NULL, '#FF1493'),
('gf-daemons-of-plague', 'grimdark-future', 'Daemons of Plague', NULL, NULL, '#556B2F'),
('gf-daemons-of-war', 'grimdark-future', 'Daemons of War', NULL, NULL, '#B22222');
