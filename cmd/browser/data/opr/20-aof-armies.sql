-- Age of Fantasy Armies/Factions
-- All official armies from OnePage Rules (including subfactions)

DELETE FROM opr_armies WHERE universe_id = 'age-of-fantasy';

INSERT INTO opr_armies (id, universe_id, name, background, color_primary) VALUES
-- Standard Armies
('aof-beastmen', 'age-of-fantasy', 'Beastmen', 'TBD', '#8B4513'),
('aof-chivalrous-kingdoms', 'age-of-fantasy', 'Chivalrous Kingdoms', 'TBD', '#4169E1'),
('aof-dark-elves', 'age-of-fantasy', 'Dark Elves', 'TBD', '#2D1B4E'),
('aof-deep-sea-elves', 'age-of-fantasy', 'Deep-Sea Elves', 'TBD', '#006994'),
('aof-duchies-of-vinci', 'age-of-fantasy', 'Duchies of Vinci', 'TBD', '#8B0000'),
('aof-dwarves', 'age-of-fantasy', 'Dwarves', 'TBD', '#CD7F32'),
('aof-eternal-wardens', 'age-of-fantasy', 'Eternal Wardens', 'TBD', '#1B5E20'),
('aof-ghostly-undead', 'age-of-fantasy', 'Ghostly Undead', 'TBD', '#708090'),
('aof-giant-tribes', 'age-of-fantasy', 'Giant Tribes', 'TBD', '#A0522D'),
('aof-goblins', 'age-of-fantasy', 'Goblins', 'TBD', '#7CB342'),
('aof-halflings', 'age-of-fantasy', 'Halflings', 'TBD', '#DAA520'),
('aof-havoc-dwarves', 'age-of-fantasy', 'Havoc Dwarves', 'TBD', '#8B0000'),
('aof-high-elves', 'age-of-fantasy', 'High Elves', 'TBD', '#87CEEB'),
('aof-human-empire', 'age-of-fantasy', 'Human Empire', 'TBD', '#D4AF37'),
('aof-kingdom-of-angels', 'age-of-fantasy', 'Kingdom of Angels', 'TBD', '#FFD700'),
('aof-mummified-undead', 'age-of-fantasy', 'Mummified Undead', 'TBD', '#DEB887'),
('aof-ogres', 'age-of-fantasy', 'Ogres', 'TBD', '#8B4726'),
('aof-orcs', 'age-of-fantasy', 'Orcs', 'TBD', '#228B22'),
('aof-ossified-undead', 'age-of-fantasy', 'Ossified Undead', 'TBD', '#F5F5DC'),
('aof-ratmen', 'age-of-fantasy', 'Ratmen', 'TBD', '#654321'),
('aof-saurians', 'age-of-fantasy', 'Saurians', 'TBD', '#00CED1'),
('aof-shadow-stalkers', 'age-of-fantasy', 'Shadow Stalkers', 'TBD', '#483D8B'),
('aof-sky-city-dwarves', 'age-of-fantasy', 'Sky-City Dwarves', 'TBD', '#4682B4'),
('aof-vampiric-undead', 'age-of-fantasy', 'Vampiric Undead', 'TBD', '#8B0000'),
('aof-volcanic-dwarves', 'age-of-fantasy', 'Volcanic Dwarves', 'TBD', '#FF4500'),
('aof-wood-elves', 'age-of-fantasy', 'Wood Elves', 'TBD', '#228B22'),

-- Havoc Warriors (5 subfactions)
('aof-havoc-warriors', 'age-of-fantasy', 'Havoc Warriors', 'TBD', '#DC143C'),
('aof-change-disciples', 'age-of-fantasy', 'Change Disciples', 'TBD', '#4169E1'),
('aof-lust-disciples', 'age-of-fantasy', 'Lust Disciples', 'TBD', '#FF1493'),
('aof-plague-disciples', 'age-of-fantasy', 'Plague Disciples', 'TBD', '#556B2F'),
('aof-war-disciples', 'age-of-fantasy', 'War Disciples', 'TBD', '#B22222'),

-- Rift Daemons (4 subfactions)
('aof-daemons-of-change', 'age-of-fantasy', 'Daemons of Change', 'TBD', '#4169E1'),
('aof-daemons-of-lust', 'age-of-fantasy', 'Daemons of Lust', 'TBD', '#FF1493'),
('aof-daemons-of-plague', 'age-of-fantasy', 'Daemons of Plague', 'TBD', '#556B2F'),
('aof-daemons-of-war', 'age-of-fantasy', 'Daemons of War', 'TBD', '#B22222');
