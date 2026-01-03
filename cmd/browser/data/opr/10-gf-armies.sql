-- Grimdark Future Armies/Factions
-- All official armies from OnePage Rules (including subfactions)

DELETE FROM opr_armies WHERE universe_id = 'grimdark-future';

INSERT INTO opr_armies (id, universe_id, name, background, color_primary) VALUES
-- Standard Armies
('gf-alien-hives', 'grimdark-future', 'Alien Hives', 'TBD', '#7C2D12'),
('gf-blessed-sisters', 'grimdark-future', 'Blessed Sisters', 'TBD', '#D4AF37'),
('gf-custodian-brothers', 'grimdark-future', 'Custodian Brothers', 'TBD', '#FFD700'),
('gf-dao-union', 'grimdark-future', 'DAO Union', 'TBD', '#4A90E2'),
('gf-dark-elf-raiders', 'grimdark-future', 'Dark Elf Raiders', 'TBD', '#2D1B4E'),
('gf-dwarf-guilds', 'grimdark-future', 'Dwarf Guilds', 'TBD', '#8B4513'),
('gf-elven-jesters', 'grimdark-future', 'Elven Jesters', 'TBD', '#9B59B6'),
('gf-eternal-dynasty', 'grimdark-future', 'Eternal Dynasty', 'TBD', '#1B5E20'),
('gf-goblin-reclaimers', 'grimdark-future', 'Goblin Reclaimers', 'TBD', '#7CB342'),
('gf-high-elf-fleets', 'grimdark-future', 'High Elf Fleets', 'TBD', '#87CEEB'),
('gf-human-defense-force', 'grimdark-future', 'Human Defense Force', 'TBD', '#556B2F'),
('gf-human-inquisition', 'grimdark-future', 'Human Inquisition', 'TBD', '#8B0000'),
('gf-infected-colonies', 'grimdark-future', 'Infected Colonies', 'TBD', '#4B0082'),
('gf-jackals', 'grimdark-future', 'Jackals', 'TBD', '#CD853F'),
('gf-machine-cult', 'grimdark-future', 'Machine Cult', 'TBD', '#DC143C'),
('gf-orc-marauders', 'grimdark-future', 'Orc Marauders', 'TBD', '#228B22'),
('gf-ratmen-clans', 'grimdark-future', 'Ratmen Clans', 'TBD', '#654321'),
('gf-rebel-guerrillas', 'grimdark-future', 'Rebel Guerrillas', 'TBD', '#8B4513'),
('gf-robot-legions', 'grimdark-future', 'Robot Legions', 'TBD', '#44403C'),
('gf-saurian-starhost', 'grimdark-future', 'Saurian Starhost', 'TBD', '#00CED1'),
('gf-soul-snatcher-cults', 'grimdark-future', 'Soul-Snatcher Cults', 'TBD', '#8B008B'),
('gf-titan-lords', 'grimdark-future', 'Titan Lords', 'TBD', '#4169E1'),

-- Battle Brothers (6 subfactions)
('gf-battle-brothers', 'grimdark-future', 'Battle Brothers', 'TBD', '#1E3A8A'),
('gf-blood-brothers', 'grimdark-future', 'Blood Brothers', 'TBD', '#8B0000'),
('gf-dark-brothers', 'grimdark-future', 'Dark Brothers', 'TBD', '#1C1C1C'),
('gf-knight-brothers', 'grimdark-future', 'Knight Brothers', 'TBD', '#C0C0C0'),
('gf-watch-brothers', 'grimdark-future', 'Watch Brothers', 'TBD', '#2F4F4F'),
('gf-wolf-brothers', 'grimdark-future', 'Wolf Brothers', 'TBD', '#696969'),

-- Havoc Brothers (5 subfactions)
('gf-havoc-brothers', 'grimdark-future', 'Havoc Brothers', 'TBD', '#8B0000'),
('gf-change-disciples', 'grimdark-future', 'Change Disciples', 'TBD', '#4169E1'),
('gf-lust-disciples', 'grimdark-future', 'Lust Disciples', 'TBD', '#FF1493'),
('gf-plague-disciples', 'grimdark-future', 'Plague Disciples', 'TBD', '#556B2F'),
('gf-war-disciples', 'grimdark-future', 'War Disciples', 'TBD', '#B22222'),

-- Prime Brothers (6 subfactions)
('gf-prime-brothers', 'grimdark-future', 'Prime Brothers', 'TBD', '#000080'),
('gf-blood-prime-brothers', 'grimdark-future', 'Blood Prime Brothers', 'TBD', '#8B0000'),
('gf-dark-prime-brothers', 'grimdark-future', 'Dark Prime Brothers', 'TBD', '#1C1C1C'),
('gf-knight-prime-brothers', 'grimdark-future', 'Knight Prime Brothers', 'TBD', '#C0C0C0'),
('gf-watch-prime-brothers', 'grimdark-future', 'Watch Prime Brothers', 'TBD', '#2F4F4F'),
('gf-wolf-prime-brothers', 'grimdark-future', 'Wolf Prime Brothers', 'TBD', '#696969'),

-- Wormhole Daemons (4 subfactions)
('gf-daemons-of-change', 'grimdark-future', 'Daemons of Change', 'TBD', '#4169E1'),
('gf-daemons-of-lust', 'grimdark-future', 'Daemons of Lust', 'TBD', '#FF1493'),
('gf-daemons-of-plague', 'grimdark-future', 'Daemons of Plague', 'TBD', '#556B2F'),
('gf-daemons-of-war', 'grimdark-future', 'Daemons of War', 'TBD', '#B22222');
