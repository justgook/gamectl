-- Items table for testing view-sql-table component
-- Includes various column types: id, text, number, boolean, and base64 images

CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    rarity TEXT DEFAULT 'common',
    price INTEGER DEFAULT 0,
    weight REAL DEFAULT 1.0,
    stackable INTEGER DEFAULT 1,
    icon TEXT  -- base64 encoded image
);

-- Clear existing items (for development)
DELETE FROM items;

-- Insert sample items with tiny placeholder icons (8x8 PNGs)
-- These are minimal valid base64 PNG images for testing

INSERT INTO items (name, description, rarity, price, weight, stackable, icon) VALUES
('Rusty Sword', 'A weathered blade showing signs of heavy use. Still sharp enough to cut.', 'common', 25, 3.5, 0, 
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12NggID/DAwAAB4ABW8l1fkAAAAASUVORK5CYII='),

('Health Potion', 'A crimson liquid that restores vitality when consumed.', 'common', 50, 0.5, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVQI12P4z8DwHwMNMDAAAAzUAf1kKqFvAAAAAElFTkSuQmCC'),

('Mana Crystal', 'A glowing shard that pulses with arcane energy.', 'uncommon', 100, 0.2, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVQI12NgYGD4TyRg+A8GAA6eAf0FCqLRAAAAAElFTkSuQmCC'),

('Steel Shield', 'A sturdy shield forged from quality steel.', 'uncommon', 150, 8.0, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVQI12P4////fwY0wMAAAA7KAf3XZbinAAAAAElFTkSuQmCC'),

('Dragon Scale', 'A shimmering scale from an ancient dragon. Extremely rare.', 'legendary', 5000, 1.0, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVQI12P4z8Dw/z8aYGAAAA4SAf26rIVQAAAAAElFTkSuQmCC'),

('Torch', 'A simple wooden torch that provides light in dark places.', 'common', 5, 1.0, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVQI12P4z8Dwn4GBgZGBHgAADqIB/R8S8XoAAAAASUVORK5CYII='),

('Lockpick Set', 'A collection of delicate tools for opening locks without keys.', 'uncommon', 75, 0.3, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVQI12NgYPjPQAwAAA2cAf1l5rwmAAAAAElFTkSuQmCC'),

('Ancient Tome', 'A leather-bound book filled with forgotten knowledge.', 'rare', 500, 2.0, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEElEQVQI12NgYGD4Tw9A5wAADoIB/ReO7LUAAAAASUVORK5CYII='),

('Gold Coin', 'Standard currency used throughout the realm.', 'common', 1, 0.01, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVQI12P4////f4b/DIwMdAIADtsB/eMgoxUAAAAASUVORK5CYII='),

('Enchanted Ring', 'A magical ring that glows faintly in darkness.', 'rare', 800, 0.1, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVQI12P4z8DAwPCfgYEeAAAPugH9/D3xlAAAAABJRU5ErkJggg=='),

('Iron Helmet', 'Basic head protection made of iron plates.', 'common', 80, 4.0, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12NgYGCgB2BgAAASGAH9TZ3jhwAAAABJRU5ErkJggg=='),

('Explosive Powder', 'A volatile substance. Handle with extreme care.', 'uncommon', 200, 0.5, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEElEQVQI12P4z/D/PyMDPQAAD6wB/T8L3XYAAAAASUVORK5CYII='),

('Healing Herbs', 'Fresh herbs with restorative properties.', 'common', 15, 0.2, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVQI12NgYGBg+M/AwEAPAAAPwgH9AKLaJQAAAABJRU5ErkJggg=='),

('Phoenix Feather', 'A vibrant feather that radiates warmth.', 'legendary', 10000, 0.05, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVQI12P4z8DwnwEN0AsAAA7SAf3B/NfNAAAAAElFTkSuQmCC'),

('Rope', 'A sturdy length of rope useful for climbing and binding.', 'common', 10, 2.0, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVQI12NgYGD4TwwAAA1sAf2S42VkAAAAAElFTkSuQmCC'),

('Silver Arrow', 'An arrow tipped with silver. Effective against supernatural creatures.', 'uncommon', 25, 0.1, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12P4/5+BHoCBAQASzAH9ZTpabAAAAABJRU5ErkJggg=='),

('Mystic Orb', 'A crystal sphere that reveals hidden truths.', 'rare', 1200, 1.5, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVQI12P4z/D/PyMDAwM9AAAPrAH9Y2fvUgAAAABJRU5ErkJggg=='),

('Bandages', 'Clean cloth strips for treating wounds.', 'common', 8, 0.1, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12P4////fwYGAAAOzAH9ky3NhwAAAABJRU5ErkJggg=='),

('Void Stone', 'A fragment of pure darkness that absorbs light.', 'legendary', 15000, 0.8, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADUlEQVQI12NgGAWDCwAAAZAAAck7LbIAAAAASUVORK5CYII='),

('Map Fragment', 'A torn piece of an ancient map. Part of a larger puzzle.', 'rare', 300, 0.05, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVQI12NgYPj/nwEN0AswAAAPwgH9BYPDnwAAAABJRU5ErkJggg=='),

('Iron Ingot', 'A bar of refined iron ready for smithing.', 'common', 30, 5.0, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12P4z8BAD8DAAAA/iAH9cSwbugAAAABJRU5ErkJggg=='),

('Emerald', 'A precious green gemstone of exceptional clarity.', 'rare', 750, 0.1, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVQI12NgYGD4z0APQA8AAA+sAf1Gi0z1AAAAAElFTkSuQmCC'),

('Bone Charm', 'A carved bone trinket said to ward off evil spirits.', 'uncommon', 120, 0.2, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAADklEQVQI12P4////f3oABgYADrwB/fZMJHoAAAAASUVORK5CYII='),

('Smoke Bomb', 'Creates a thick cloud of smoke for quick escapes.', 'uncommon', 60, 0.3, 1,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVQI12NgYGCgF2BgAAASRAH9G6QNGAAAAABJRU5ErkJggg=='),

('Leather Armor', 'Light armor offering basic protection without hindering movement.', 'common', 100, 6.0, 0,
 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEElEQVQI12NgYGD4Tw9A7wAAD6oB/U17uJsAAAAASUVORK5CYII=');
