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
        'LUT Generator',
        2,
        '{"kind":2,"name":"LUT Generator","codePath":"local:/assets/ng/nodegraph2/lut-generator.lua","inputs":[{"inputId":1,"name":"mapName","defaultValue":"new_map"},{"inputId":2,"name":"layerIndex","defaultValue":"1"}],"outputs":[{"outputId":1,"name":"image+","value":""},{"outputId":2,"name":"error","value":""}]}'
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
        'Tilemap minimap Generator',
        2,
        '{"kind":2,"name":"Tilemap minimap Generator","codePath":"local:/assets/ng/nodegraph2/pipeline-create-minimap.lua","inputs":[{"inputId":1,"name":"inputTreeId","defaultValue":"progression"},{"inputId":2,"name":"mapId","defaultValue":"new_map"},{"inputId":3,"name":"direction","defaultValue":"radial"}],"outputs":[{"outputId":1,"name":"mapId","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Tilemap Automap',
        2,
        '{"kind":2,"name":"Tilemap Automap","codePath":"local:/assets/ng/nodegraph2/pipeline-apply-automap.lua","inputs":[{"inputId":1,"name":"rulesMapId","defaultValue":"rules"},{"inputId":2,"name":"inputMapId","defaultValue":"new_map"},{"inputId":3,"name":"outputMapId","defaultValue":"automap_result"}],"outputs":[{"outputId":1,"name":"outputMapId","value":""},{"outputId":2,"name":"error","value":""}]}'
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
        'Pick',
        2,
        '{"kind":2,"name":"Pick","codePath":"local:/assets/ng/nodegraph2/pick.lua","inputs":[{"inputId":1,"name":"items","defaultValue":"[]"},{"inputId":2,"name":"fields","defaultValue":""}],"outputs":[{"outputId":1,"name":"items","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Remap',
        2,
        '{"kind":2,"name":"Remap","codePath":"local:/assets/ng/nodegraph2/remap.lua","inputs":[{"inputId":1,"name":"items","defaultValue":"[]"},{"inputId":2,"name":"fields","defaultValue":""},{"inputId":3,"name":"srcMin","defaultValue":"0"},{"inputId":4,"name":"srcMax","defaultValue":"1"},{"inputId":5,"name":"dstMin","defaultValue":"0"},{"inputId":6,"name":"dstMax","defaultValue":"1"}],"outputs":[{"outputId":1,"name":"items","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Zip',
        2,
        '{"kind":2,"name":"Zip","codePath":"local:/assets/ng/nodegraph2/zip.lua","inputs":[{"inputId":1,"name":"items1","defaultValue":"[]"},{"inputId":2,"name":"items2","defaultValue":"[]"},{"inputId":3,"name":"items3","defaultValue":"[]"}],"outputs":[{"outputId":1,"name":"items","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Pack Rects',
        2,
        '{"kind":2,"name":"Pack Rects","codePath":"local:/assets/ng/nodegraph2/pack-rects.lua","inputs":[{"inputId":1,"name":"rects","defaultValue":"[]"},{"inputId":2,"name":"width","defaultValue":"1"},{"inputId":3,"name":"height","defaultValue":"1"},{"inputId":4,"name":"padding","defaultValue":"0"},{"inputId":5,"name":"autoSize","defaultValue":"true"}],"outputs":[{"outputId":1,"name":"packedRects","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Image Open',
        2,
        '{"kind":2,"name":"Image Open","codePath":"local:/assets/ng/nodegraph2/image-open.lua","inputs":[{"inputId":1,"name":"path","defaultValue":""}],"outputs":[{"outputId":1,"name":"image","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Image FlipY',
        2,
        '{"kind":2,"name":"Image FlipY","codePath":"local:/assets/ng/nodegraph2/image-flipy.lua","inputs":[{"inputId":1,"name":"image","defaultValue":""}],"outputs":[{"outputId":1,"name":"image","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Image Wrap',
        2,
        '{"kind":2,"name":"Image Wrap","codePath":"local:/assets/ng/nodegraph2/image-wrap.lua","inputs":[{"inputId":1,"name":"image","defaultValue":""}],"outputs":[{"outputId":1,"name":"handle","value":""}]}'
    ),
    (
        'Image Atlas',
        2,
        '{"kind":2,"name":"Image Atlas","codePath":"local:/assets/ng/nodegraph2/image-atlas.lua","inputs":[{"inputId":1,"name":"images","defaultValue":"[]"}],"outputs":[{"outputId":1,"name":"image","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Image Write',
        2,
        '{"kind":2,"name":"Image Write","codePath":"local:/assets/ng/nodegraph2/image-write.lua","inputs":[{"inputId":1,"name":"image","defaultValue":""},{"inputId":2,"name":"path","defaultValue":"/tmp/image.qoi"},{"inputId":3,"name":"format","defaultValue":""}],"outputs":[{"outputId":1,"name":"path","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'SQL Query',
        2,
        '{"kind":2,"name":"SQL Query","codePath":"local:/assets/ng/nodegraph2/sql-query.lua","inputs":[{"inputId":1,"name":"query","defaultValue":"SELECT 1 AS value"}],"outputs":[{"outputId":1,"name":"rows","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Respack Build',
        2,
        '{"kind":2,"name":"Respack Build","codePath":"local:/assets/ng/nodegraph2/respack-build.lua","inputs":[{"inputId":1,"name":"schema","defaultValue":""},{"inputId":2,"name":"outputFile","defaultValue":"/tmp/output.rspk"},{"inputId":3,"name":"slots","defaultValue":"[]"}],"outputs":[{"outputId":1,"name":"outputFile","value":""},{"outputId":2,"name":"error","value":""}]}'
    ),
    (
        'Demo UVs',
        2,
        '{"kind":2,"name":"Demo UVs","codePath":"local:/assets/ng/nodegraph2/uvs.lua","outputs":[{"outputId":1,"name":"uvs","value":""}]}'
    ),
    (
        'Respack Generate Odin',
        2,
        '{"kind":2,"name":"Respack Generate Odin","codePath":"local:/assets/ng/nodegraph2/respack-generate-odin.lua","inputs":[{"inputId":1,"name":"schema","defaultValue":""},{"inputId":2,"name":"outputFile","defaultValue":"/tmp/respack-decoder.odin"}],"outputs":[{"outputId":1,"name":"odinSource","value":""},{"outputId":2,"name":"outputFile","value":""},{"outputId":3,"name":"error","value":""}]}'
    );
