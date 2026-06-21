PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

DELETE FROM sprite
WHERE name = 'jotem';

INSERT INTO sprite (
    name,
    display_name,
    description,
    image_path,
    grid_width,
    grid_height
)
VALUES (
    'jotem',
    'Jotem',
    'Demo sprite source for character/object catalog workflows',
    'catalog/sprites/jotem.aseprite',
    1,
    1
);

INSERT INTO sprite_animation (
    sprite_id,
    name,
    start_frame,
    end_frame
)
VALUES
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'idle 1 old', 0, 5),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'Idle swordback', 6, 11),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'walk swordback', 12, 19),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'idle sword hand', 20, 25),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'walk 2', 26, 33),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'jump', 34, 36),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'Fall', 37, 41),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'Item', 42, 51),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'atk', 52, 61),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'hurt', 62, 66),
    ((SELECT id FROM sprite WHERE name = 'jotem'), 'Death', 67, 96);

COMMIT;
