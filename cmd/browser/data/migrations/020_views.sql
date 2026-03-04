-- +goose Up
-- Migration: views
-- View registry for dynamic view loading via fs
-- Category and display name come from static viewMeta on the class itself

CREATE TABLE IF NOT EXISTS views (
    name TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    type TEXT DEFAULT 'user'
);

-- Base views (cannot be disabled)
INSERT OR IGNORE INTO views (name, url, type) VALUES
    ('settings', 'local:/views/view-settings.js', 'base');

-- Built-in views (enabled by default, can be disabled by user)
INSERT OR IGNORE INTO views (name, url, type, enabled) VALUES
    ('nodegraph',        'local:/views/view-nodegraph.js', 'builtin', 1),
    ('nodegraph2',       'local:/views/view-nodegraph2.js', 'builtin', 1),
    ('tree',             'local:/views/view-tree.js', 'builtin', 1),
    ('tilemap',          'local:/views/view-tilemap.js', 'builtin', 1),
    ('skeleton',         'local:/views/view-skeleton.js', 'builtin', 1),
    ('timeline',         'local:/views/view-timeline.js', 'builtin', 1),
    ('opr-unit-builder', 'local:/views/view-opr-unit-builder.js', 'builtin', 1),
    ('sql-tables',       'local:/views/view-sql-tables.js', 'builtin', 1),
    ('sql-table',        'local:/views/view-sql-table.js', 'builtin', 1),
    ('sql-console',      'local:/views/view-sql-console.js', 'builtin', 1),
    ('files',            'local:/views/view-files.js', 'builtin', 1),
    ('pipeline',         'local:/views/view-pipeline.js', 'builtin', 1),
    ('sprite-extractor', 'local:/views/sprite-extractor/view-sprite-extractor.js', 'builtin', 1),
    ('sprite-packer',    'local:/views/sprite-packer/view-sprite-packer.js', 'builtin', 1),
    ('tile-extractor',   'local:/views/tile-extractor/view-tile-extractor.js', 'builtin', 1),
    ('animation-editor', 'local:/views/view-animation-editor.js', 'builtin', 1),
    ('stb-editor',       'local:/views/view-stb-editor.js', 'builtin', 1);
