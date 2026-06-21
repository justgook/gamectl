PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

DELETE FROM tileset
WHERE name IN ('dark_bricks', 'red1');

INSERT INTO tileset (name, display_name, description)
VALUES
    ('dark_bricks', 'Dark Bricks', 'Demo dual-grid tileset: dark bricks'),
    ('red1', 'Red 1', 'Demo dual-grid tileset: red variant 1');

INSERT INTO tileset_image_source (tileset_id, image_path, tile_width, tile_height)
VALUES
    ((SELECT id FROM tileset WHERE name = 'dark_bricks'), 'catalog/tilesets/00001-dark-bricks.qoi', 16, 16),
    ((SELECT id FROM tileset WHERE name = 'red1'), 'catalog/tilesets/00002-red1.qoi', 16, 16);

INSERT INTO tile (tileset_id, image_source_id, mask, tile_index, variant_index, weight, name)
WITH masks(mask) AS (
    VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12), (13), (14), (15)
)
SELECT
    ts.id,
    src.id,
    masks.mask,
    masks.mask,
    0,
    1,
    'mask_' || substr('0000' || masks.mask, -4)
FROM tileset ts
JOIN tileset_image_source src ON src.tileset_id = ts.id
JOIN masks
WHERE ts.name = 'dark_bricks'
  AND src.image_path = 'catalog/tilesets/00001-dark-bricks.qoi';

INSERT INTO tile (tileset_id, image_source_id, mask, tile_index, variant_index, weight, name)
WITH masks(mask) AS (
    VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12), (13), (14), (15)
)
SELECT
    ts.id,
    src.id,
    masks.mask,
    masks.mask,
    0,
    1,
    'mask_' || substr('0000' || masks.mask, -4)
FROM tileset ts
JOIN tileset_image_source src ON src.tileset_id = ts.id
JOIN masks
WHERE ts.name = 'red1'
  AND src.image_path = 'catalog/tilesets/00002-red1.qoi';

COMMIT;
