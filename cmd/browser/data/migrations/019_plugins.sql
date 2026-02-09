-- +goose Up
-- Migration: plugins
-- Plugin registry for dynamic plugin loading via fs

CREATE TABLE IF NOT EXISTS plugins (
    name TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    version TEXT DEFAULT '0.0.0',
    enabled INTEGER DEFAULT 1,
    type TEXT DEFAULT 'user'
);

-- Base plugins (cannot be disabled)
INSERT OR IGNORE INTO plugins (name, url, type) VALUES
    ('sql', 'local:/plugins/sql.wasm', 'base');

-- Built-in plugins (enabled by default, can be disabled by user)
INSERT OR IGNORE INTO plugins (name, url, type, enabled) VALUES
    ('random', 'local:/plugins/random.wasm', 'builtin', 1),
    ('treegen', 'local:/plugins/treegen.wasm', 'builtin', 1),
    ('biomes', 'local:/plugins/biomes.wasm', 'builtin', 1),
    ('keylock', 'local:/plugins/keylock.wasm', 'builtin', 1),
    ('minimap', 'local:/plugins/minimap.wasm', 'builtin', 1),
    ('minimap2', 'local:/plugins/minimap2.wasm', 'builtin', 1),
    ('automap', 'local:/plugins/automap.wasm', 'builtin', 1),
    ('math', 'local:/plugins/math.wasm', 'builtin', 1),
    ('scaler', 'local:/plugins/scaler.wasm', 'builtin', 1),
    ('roomgen', 'local:/plugins/roomgen.wasm', 'builtin', 1),
    ('image-process', 'local:/plugins/image-process.wasm', 'builtin', 1),
    ('sprite-detect', 'local:/plugins/sprite-detect.wasm', 'builtin', 1),
    ('sprite-pack', 'local:/plugins/sprite-pack.wasm', 'builtin', 1),
    ('tile-detect', 'local:/plugins/tile-detect.wasm', 'builtin', 1);
