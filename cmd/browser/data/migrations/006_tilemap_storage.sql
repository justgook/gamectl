-- +goose Up
-- Migration: tilemap_storage
-- Tilemap storage table to replace tilemap-storage plugin

CREATE TABLE IF NOT EXISTS tilemap_storage (
    name TEXT PRIMARY KEY,     -- Tilemap identifier (e.g., 'new_map', 'rules-basic-walls')
    data TEXT NOT NULL         -- JSON data as-is from current tilemap-storage format
);

INSERT INTO tilemap_storage (name, data) VALUES
(
  'tileset_demo',
  '{"layers":[{"data":[2,3,4, 0,0,0, 0,0,0],"width":3,"props":{"tw":"16","th":"16", "tileset":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAABQBAMAAABsc2MHAAAAEnRFWHRBdXRob3IARGF2aWQgU21pdGhp1FRuAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABJQTFRFR3BM2dnZzMzM////8vLy5eXlv3qrMgAAAAF0Uk5TAEDm2GYAAAF8SURBVFjD7ZhRboQwDES5QrbaAzTdE8CeAIUDrNTc/yptldjBszF123xR+8fCkCeEomEmU/5lLUpN13L//dpfp85VYCgPpNBfqM514MtXu6fSsfS5Ax3owGfgHOPbvhMQ52bgPUbZKxDnduD6KjsBYW4HpqlWkMCE663AjYAPCdzqde12YCZglsBcr2v/wbYh4LB96EAHnhA4RwIO00MGjtJDAg7TQ+x/1kOpewP0UOreAD105+DAfw68xM+6pdKx9LkOLE+kELulzlVgfYHbpb9QnatAdlWmfNy+qTZnoJaLjcCmh+xMlVxsBDY9lFb3u+2hbaPON3SgA88JPNS9lpNlfl4W6Q+bj5yOda/l5AB+EHJ0Ax7rXsvJAfwg5OiVdRA9NH2r/j9H9418fghA1rcA/g98YQLfuPH5IQBZ3wL4P/CFCXxjnvAIALfB8TZ5/p060IEnBVZ/KPMw1RwJiDIkgfu8XHVP5mF+AyNwl5fJH8o8zMDVCGR9/ABC9Zf1svGALwAAAABJRU5ErkJggg=="}}]}'
),
(
  'rules',
  '{"props":{"tw":"16","th":"16","rule_Negate":"1","rule_Ignore":"2","rule_NonEmpty":"3","rule_Empty":"4","rule_Other":"5","rule_MatchOutsideMap":"true","rule_OverflowBorder":"true"},"layers":[{"props":{"tw":"16","th":"16","tileset":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAQBAMAAAAblGfKAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURUdwTL5KL////9IAAAAAAFSAC4CAgLdcgScAAAABdFJOUwBA5thmAAAA6UlEQVQoz6WSQYrDMAxFP3Hofm5gZNO1iS5QjHODel+y6P2PMN92m8YkGRgqTLKQHnq2BACq/ODxvPAAUgMIanjwjp9X1PpCXFrhY2h5+yoNY2J0gFERDVhEfBS52lY4hPY3e4D14hRDA6wFC24Y3ipj9NIBZiKgGhaJnrmrHXPO902HI8CpI+B9jARmAvnWK1FqBYqRTqJUSqkozTnNBFalA8CVay8tQaVUgU4p9wAbbACMvdIecNVqVSJwTzhXMlNpsLk0wFfF+aWN1kF8nrV0wB/PCq2D2AyuAaeDO1iNvdJ3y/fP9f4Fk9tT0A+X6MoAAAAASUVORK5CYII=","rule_role":"input","rule_target_layer":"#0"},"width":39,"data":[0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,3,3,3,0,3,3,3,0,3,3,3,4,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,3,3,3,0,3,3,3,0,3,3,3,0,3,0,0,0,3,3,0,3,3,3,0,3,3,0,0,0,3,4,0,4,3,4,0,4,3,0,0,3,3,4,0,4,3,4,0,4,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,3,3,0,3,3,3,0,3,3,0,0,0,3,4,0,0,0,0,0,4,3,0,0,3,3,4,0,4,3,4,0,4,3,3,4,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,4,3,3,0,0,0,0,0,3,3,4,0,3,3,3,0,3,3,3,0,3,3,3,0,3,0,0,0,3,3,0,3,3,3,0,3,3,0,0,0,3,4,0,0,0,0,0,4,3,0,0,3,3,4,0,4,3,4,0,4,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,3,3,0,3,3,3,0,3,3,0,0,0,3,4,0,4,3,4,0,4,3,0,0,3,3,4,0,4,3,4,0,4,3,3,4,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,4,3,3,0,3,3,3,0,3,3,4,0,3,3,3,0,3,3,3,0,3,3,3,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,3,3,3,0,3,3,3,0,3,3,3]}]}'
);
