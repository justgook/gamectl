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
    ),
    (
        'Tilemap Scaler',
        2,
        '{"kind":2,"name":"Tilemap Scaler","codePath":"local:/assets/ng/nodegraph2/pipeline-tilemap-scaler.lua","inputs":[{"inputId":1,"name":"inputMapId","defaultValue":"new_map"},{"inputId":2,"name":"outputMapId","defaultValue":"scaled_map"},{"inputId":3,"name":"scaleFactor","defaultValue":"2"}],"outputs":[{"outputId":1,"name":"outputMapId","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Array',
        2,
        '{"kind":2,"name":"Array","codePath":"local:/assets/ng/nodegraph2/array.lua","inputs":[{"inputId":1,"name":"item1","defaultValue":""},{"inputId":2,"name":"item2","defaultValue":""}],"outputs":[{"outputId":1,"name":"array","value":""}]}'
    ),
    (
        'Pack Rects',
        2,
        '{"kind":2,"name":"Pack Rects","codePath":"local:/assets/ng/nodegraph2/pack-rects.lua","inputs":[{"inputId":1,"name":"rects","defaultValue":"[]"},{"inputId":2,"name":"width","defaultValue":"1"},{"inputId":3,"name":"height","defaultValue":"1"},{"inputId":4,"name":"padding","defaultValue":"0"},{"inputId":5,"name":"autoSize","defaultValue":"true"}],"outputs":[{"outputId":1,"name":"packedRects","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Image Info',
        2,
        '{"kind":2,"name":"Image Info","codePath":"local:/assets/ng/nodegraph2/image-info.lua","inputs":[{"inputId":1,"name":"src","defaultValue":""},{"inputId":2,"name":"id","defaultValue":""}],"outputs":[{"outputId":1,"name":"rect","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Build Atlas',
        2,
        '{"kind":2,"name":"Build Atlas","codePath":"local:/assets/ng/nodegraph2/build-atlas.lua","inputs":[{"inputId":1,"name":"packedRects","defaultValue":"[]"},{"inputId":2,"name":"outputPath","defaultValue":"/tmp/atlas.qoi"},{"inputId":3,"name":"format","defaultValue":"qoi"}],"outputs":[{"outputId":1,"name":"outputPath","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'SQL Query',
        2,
        '{"kind":2,"name":"SQL Query","codePath":"local:/assets/ng/nodegraph2/sql-query.lua","inputs":[{"inputId":1,"name":"query","defaultValue":"SELECT 1 AS value"}],"outputs":[{"outputId":1,"name":"rows","value":""},{"outputId":2,"name":"error","value":""}]}'
    );
