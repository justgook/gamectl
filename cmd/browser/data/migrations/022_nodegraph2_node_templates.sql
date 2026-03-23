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
    ),
    (
        'World Tree Generator',
        2,
        '{"kind":2,"name":"World Tree Generator","codePath":"local:/assets/ng/nodegraph2/pipeline-world-tree.lua","inputs":[{"inputId":1,"name":"nodeCount","defaultValue":"10"},{"inputId":2,"name":"maxDepth","defaultValue":"0"},{"inputId":3,"name":"maxBranching","defaultValue":"0"},{"inputId":4,"name":"rootBranches","defaultValue":"0"},{"inputId":5,"name":"treeId","defaultValue":"progression"}],"outputs":[{"outputId":1,"name":"treeId","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Biome Assigner',
        2,
        '{"kind":2,"name":"Biome Assigner","codePath":"local:/assets/ng/nodegraph2/pipeline-assign-biomes.lua","inputs":[{"inputId":1,"name":"treeId","defaultValue":"progression"},{"inputId":2,"name":"biomesQuery","defaultValue":"SELECT name FROM biomes ORDER BY RANDOM()"}],"outputs":[{"outputId":1,"name":"treeId","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Keys & Locks Assigner',
        2,
        '{"kind":2,"name":"Keys & Locks Assigner","codePath":"local:/assets/ng/nodegraph2/pipeline-assign-keys-locks.lua","inputs":[{"inputId":1,"name":"treeId","defaultValue":"progression"},{"inputId":2,"name":"keysQuery","defaultValue":"SELECT name FROM keys ORDER BY RANDOM() LIMIT 15"},{"inputId":3,"name":"keyChance","defaultValue":"0.5"},{"inputId":4,"name":"lockChance","defaultValue":"0.7"},{"inputId":5,"name":"maxKeysPerLock","defaultValue":"2"}],"outputs":[{"outputId":1,"name":"treeId","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Minimap Generator',
        2,
        '{"kind":2,"name":"Minimap Generator","codePath":"local:/assets/ng/nodegraph2/pipeline-create-minimap.lua","inputs":[{"inputId":1,"name":"inputTreeId","defaultValue":"progression"},{"inputId":2,"name":"mapId","defaultValue":"new_map"},{"inputId":3,"name":"direction","defaultValue":"radial"}],"outputs":[{"outputId":1,"name":"mapId","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Automap Applicator',
        2,
        '{"kind":2,"name":"Automap Applicator","codePath":"local:/assets/ng/nodegraph2/pipeline-apply-automap.lua","inputs":[{"inputId":1,"name":"rulesMapId","defaultValue":"rules"},{"inputId":2,"name":"inputMapId","defaultValue":"new_map"},{"inputId":3,"name":"outputMapId","defaultValue":"automap_result"}],"outputs":[{"outputId":1,"name":"outputMapId","value":""},{"outputId":2,"name":"error","value":""}]}'
    );
