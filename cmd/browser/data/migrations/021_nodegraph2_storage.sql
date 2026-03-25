-- +goose Up
-- Migration: nodegraph2_storage
-- JSON storage for nodegraph2 view snapshots

CREATE TABLE IF NOT EXISTS nodegraph2_storage (
    name TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    node_count INTEGER NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO nodegraph2_storage (name, data, node_count) VALUES 
  (
    'default',
    '[{"id":1,"kind":2,"x":80,"y":58,"name":"","codePath":"local:/assets/ng/nodegraph2/initial-node-code.lua","inputs":[],"outputs":[{"id":1,"name":"output 1","value":""},{"id":2,"name":"output 2","value":""}]},{"id":2,"kind":1,"x":266,"y":58,"name":"","codePath":"","inputs":[{"id":1,"name":"input 1","srcNodeId":1,"srcOutputId":1},{"id":2,"name":"input 2","srcNodeId":0,"srcOutputId":0}],"outputs":[]},{"id":3,"kind":2,"x":452,"y":58,"name":"","codePath":"","inputs":[{"id":1,"name":"input 1","srcNodeId":1,"srcOutputId":2},{"id":2,"name":"input 2","srcNodeId":0,"srcOutputId":0}],"outputs":[{"id":1,"name":"output 1","value":""},{"id":2,"name":"output 2","value":""},{"id":3,"name":"output 3","value":""}]},{"id":4,"kind":1,"x":638,"y":58,"name":"","codePath":"","inputs":[{"id":1,"name":"input 1","srcNodeId":3,"srcOutputId":2}],"outputs":[]},{"id":5,"kind":2,"x":80,"y":170,"name":"","codePath":"","inputs":[],"outputs":[{"id":1,"name":"output 1","value":""}]},{"id":6,"kind":1,"x":266,"y":170,"name":"","codePath":"","inputs":[{"id":1,"name":"input 1","srcNodeId":3,"srcOutputId":1},{"id":2,"name":"input 2","srcNodeId":5,"srcOutputId":1}],"outputs":[]},{"id":7,"kind":4,"x":452,"y":170,"name":"","codePath":"","inputs":[],"outputs":[{"id":1,"name":"","value":"https://example.com/a"}]},{"id":8,"kind":4,"x":638,"y":170,"name":"","codePath":"","inputs":[],"outputs":[{"id":1,"name":"","value":"https://example.com/b"}]},{"id":9,"kind":4,"x":80,"y":282,"name":"","codePath":"","inputs":[],"outputs":[{"id":1,"name":"","value":"https://example.com/c"}]},{"id":10,"kind":1,"x":266,"y":282,"name":"","codePath":"","inputs":[{"id":1,"name":"input 1","srcNodeId":7,"srcOutputId":1},{"id":2,"name":"input 2","srcNodeId":8,"srcOutputId":1},{"id":3,"name":"input 3","srcNodeId":9,"srcOutputId":1}],"outputs":[]}]',
    10
  ),
  (
    'game.rspk',
    '[{"id":1,"kind":2,"x":488,"y":206,"name":"Resources","codePath":"local:/assets/ng/nodegraph2/array.lua","graphId":0,"graphName":"","inputs":[{"id":1,"name":"Positions","srcNodeId":6,"srcOutputId":1},{"id":2,"name":"Atlas","srcNodeId":2,"srcOutputId":1},{"id":3,"name":"Sprites","srcNodeId":7,"srcOutputId":1}],"outputs":[{"id":1,"name":"slots","value":""}]},{"id":2,"kind":4,"x":80,"y":142,"name":"Atlas","codePath":"","graphId":0,"graphName":"","inputs":[],"outputs":[{"id":1,"name":"","value":"{\"_file\":\"local:/assets/game/the_atlas.qoi\"}"}]},{"id":3,"kind":2,"x":915,"y":132,"name":"Respack Build","codePath":"local:/assets/ng/nodegraph2/respack-build.lua","graphId":0,"graphName":"","inputs":[{"id":1,"name":"schema","srcNodeId":4,"srcOutputId":1},{"id":2,"name":"outputFile","srcNodeId":4,"srcOutputId":2},{"id":3,"name":"slots","srcNodeId":1,"srcOutputId":1}],"outputs":[{"id":1,"name":"outputFile","value":""},{"id":2,"name":"error","value":""}]},{"id":4,"kind":4,"x":488,"y":59,"name":"RSPK","codePath":"","graphId":0,"graphName":"","inputs":[],"outputs":[{"id":1,"name":"schema","value":"{\"_file\":\"local:/assets/respack/game2.rspk.json\"}"},{"id":2,"name":"outputFile","value":"/data.rspk"}]},{"id":5,"kind":1,"x":1155,"y":136,"name":"THE BUILD","codePath":"","graphId":0,"graphName":"","inputs":[{"id":1,"name":"file","srcNodeId":3,"srcOutputId":1},{"id":2,"name":"error","srcNodeId":3,"srcOutputId":2}],"outputs":[]},{"id":6,"kind":4,"x":80,"y":32,"name":"Positions","codePath":"","graphId":0,"graphName":"","inputs":[],"outputs":[{"id":1,"name":"","value":"{\"entity_ids\":[],\"components\":[]}"}]},{"id":7,"kind":4,"x":80,"y":260,"name":"Sprites","codePath":"","graphId":0,"graphName":"","inputs":[],"outputs":[{"id":1,"name":"","value":"[]"}]}]',
    7
  );
