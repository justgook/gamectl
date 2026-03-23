-- +goose Up
-- Migration: nodegraph2_node_templates
-- Reusable node templates for nodegraph2 add-node presets

CREATE TABLE IF NOT EXISTS nodegraph2_node_templates (
    name TEXT PRIMARY KEY,
    kind INTEGER NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO nodegraph2_node_templates (name, kind, data) VALUES
    (
        'tilemap sql parse demo',
        2,
        '{"kind":2,"name":"tilemap sql parse demo","codePath":"local:/assets/ng/nodegraph2/tilemap-sql-parse-demo.lua","inputs":[],"outputs":[{"outputId":1,"name":"items","value":""},{"outputId":2,"name":"stats","value":""}]}'
    ),
    (
        'respack text demo',
        2,
        '{"kind":2,"name":"respack text demo","codePath":"local:/assets/ng/nodegraph2/respack-text-demo.lua","inputs":[],"outputs":[{"outputId":1,"name":"odin_source","value":""},{"outputId":2,"name":"status","value":""}]}'
    ),
    (
        'LUT generator demo',
        2,
        '{"kind":2,"name":"LUT generator demo","codePath":"local:/assets/ng/nodegraph2/lut-generator-demo.lua","inputs":[],"outputs":[{"outputId":1,"name":"result","value":""}]}'
    ),
    (
        'pack demo',
        2,
        '{"kind":2,"name":"pack demo","codePath":"local:/assets/ng/nodegraph2/pack-demo.lua","inputs":[],"outputs":[{"outputId":1,"name":"result","value":""},{"outputId":2,"name":"summary","value":""}]}'
    );
