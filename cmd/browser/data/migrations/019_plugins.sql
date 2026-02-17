-- +goose Up
-- Migration: plugins
-- Plugin registry for dynamic plugin loading via fs

CREATE TABLE IF NOT EXISTS plugins (
    name TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    version TEXT DEFAULT '0.0.0',
    enabled INTEGER DEFAULT 1,
    type TEXT DEFAULT 'user',
    scope TEXT DEFAULT 'global'
);

-- Base plugins (cannot be disabled)
INSERT OR IGNORE INTO plugins (name, url, type) VALUES
    ('sql', 'local:/plugins/sql.wasm', 'base');

-- Built-in plugins (enabled by default, can be disabled by user)
INSERT OR IGNORE INTO plugins (name, url, type, enabled, scope) VALUES
    ('random', 'local:/plugins/random.wasm', 'builtin', 1, 'global'),
    ('treegen', 'local:/plugins/treegen.wasm', 'builtin', 1, 'global'),
    ('biomes', 'local:/plugins/biomes.wasm', 'builtin', 1, 'global'),
    ('keylock', 'local:/plugins/keylock.wasm', 'builtin', 1, 'global'),
    ('minimap', 'local:/plugins/minimap.wasm', 'builtin', 1, 'global'),
    ('minimap2', 'local:/plugins/minimap2.wasm', 'builtin', 1, 'global'),
    ('automap', 'local:/plugins/automap.wasm', 'builtin', 1, 'global'),
    ('math', 'local:/plugins/math.wasm', 'builtin', 1, 'global'),
    ('scaler', 'local:/plugins/scaler.wasm', 'builtin', 1, 'global'),
    ('roomgen', 'local:/plugins/roomgen.wasm', 'builtin', 1, 'global'),
    ('image-process', 'local:/plugins/image-process.wasm', 'builtin', 1, 'global'),
    ('sprite-detect', 'local:/plugins/sprite-detect.wasm', 'builtin', 1, 'global'),
    ('sprite-pack', 'local:/plugins/sprite-pack.wasm', 'builtin', 1, 'global'),
    ('tile-detect', 'local:/plugins/tile-detect.wasm', 'builtin', 1, 'global'),
    ('stbte', 'local:/plugins/stbte.wasm', 'builtin', 1, 'view');
