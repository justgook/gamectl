-- +goose Up
-- Migration: example_pipelines
-- Seed pipeline_storage with example pipelines (scripts in /example/scripts/)

-- Example 1: AutoMap Pipeline
-- AutoMap, Tilemap Scaler, Room Generator, and File Write test
INSERT INTO pipeline_storage (name, node_count, html_content) VALUES (
  'Example: AutoMap',
  16,
  '<node-popup title="Text" label="THE TEXT" outputs="text" id="init_1" x="12" y="114" values="text:rules" template="node-popup-text"></node-popup>' ||
  '<node-popup title="Text" label="THE TEXT" outputs="text" id="init_2" x="15" y="207" values="text:new_map" template="node-popup-text"></node-popup>' ||
  '<node-popup title="Text" label="THE TEXT" outputs="text" id="init_4" x="11" y="300" values="text:automap_result" template="node-popup-text"></node-popup>' ||
  '<node-popup title="Tilemap preview" inputs="mapId:init_2.text" outputs="mapId" data-input-target="mapId:view-tilemap@data-key" id="init_6" x="242" y="204" template="node-popup-tilemap-preview"></node-popup>' ||
  '<node-popup inputs="mapId:init_1.text" outputs="mapId" data-input-target="mapId:view-tilemap@data-key" id="init_7" x="244" y="102" template="node-popup-tilemap-preview"></node-popup>' ||
  '<node-plugin title="AutoMap" x="489" y="184" plugin="automap" function="automap" inputs="rulesMapId:init_1.text,inputMapId:init_2.text,outputMapId:init_4.text" outputs="result" id="init_3"></node-plugin>' ||
  '<node-popup inputs="mapId:init_4.text" outputs="mapId" data-input-target="mapId:view-tilemap@data-key" id="init_8" x="243" y="297" template="node-popup-tilemap-preview"></node-popup>' ||
  '<node-plugin title="Tilemap Scaler" plugin="scaler" function="scale" inputs="inputMapId:init_2.text,outputMapId:init_2.text,scaleFactor:init_10.value" outputs="result" id="init_9" x="483" y="32"></node-plugin>' ||
  '<node-popup outputs="value" id="init_10" x="12" y="12" title="" values="value:10" template="node-popup-numpad"></node-popup>' ||
  '<node-popup title="Room Gen Name" label="Room Gen Name" outputs="text" id="outputRoom" x="21" y="409" values="text:the_room_gen" template="node-popup-text"></node-popup>' ||
  '<node-input type="number" value="3" label="JumpHeight" id="jump_height" x="45" y="553" title=""></node-input>' ||
  '<node-plugin title="Room Generator" plugin="roomgen" function="gen" inputs="inputMapId:init_2.text,outputMapId:outputRoom.text,jumpHeight:jump_height.output,jumpDistance:jump_height.output" outputs="result" id="room_gen_1" x="353" y="468"></node-plugin>' ||
  '<node-popup inputs="mapId:outputRoom.text" outputs="mapId" data-input-target="mapId:view-tilemap@data-key" id="room_gen_2" x="359" y="638" title="" template="node-popup-tilemap-preview"></node-popup>' ||
  '<node-plugin title="File Write(bin)" plugin="fs" function="writeBin" inputs="path:code_to_file_1.text,content:code_1.output" outputs="result" id="fs_write1" x="354" y="747"></node-plugin>' ||
  '<node-code title="Code" inputs="input" outputs="output" id="code_1" x="47" y="798" src="local:/example/scripts/automap/bytes-test.js"></node-code>' ||
  '<node-popup values="text:aa.txt" title="Text" label="THE TEXT" outputs="text" id="code_to_file_1" x="45" y="698" template="node-popup-text"></node-popup>'
);

-- Example 2: Atlas Builder Pipeline
-- Animation atlas packing: SQL -> Extract -> Pack -> UV Binary -> Anim Binary -> Combine
INSERT INTO pipeline_storage (name, node_count, html_content) VALUES (
  'Example: Atlas Builder',
  15,
  '<node-code title="SQL: Get Animations" inputs="" outputs="data" id="atlas_sql" x="700" y="100" src="local:/example/scripts/atlas/get-animations.js"></node-code>' ||
  '<node-code title="Extract Tiles" inputs="data:atlas_sql.data" outputs="tiles" id="atlas_extract" x="700" y="220" src="local:/example/scripts/atlas/extract-tiles.js"></node-code>' ||
  '<node-plugin title="Pack Tiles" plugin="sprite-pack" function="packTiles" inputs="tiles:atlas_extract.tiles,options:atlas_options.output,outputPath:atlas_path.text" outputs="result" id="atlas_pack" x="950" y="220"></node-plugin>' ||
  '<node-popup title="Atlas Path" outputs="text" id="atlas_path" x="700" y="340" values="text:/output/atlas.qoi" template="node-popup-text"></node-popup>' ||
  '<node-code title="Pack Options" inputs="" outputs="output" id="atlas_options" x="700" y="440" src="local:/example/scripts/atlas/pack-options.js"></node-code>' ||
  '<node-code title="Build UV Binary" inputs="result:atlas_pack.result" outputs="binary,metadata" id="atlas_uv" x="1150" y="220" src="local:/example/scripts/atlas/build-uv-binary.js"></node-code>' ||
  '<node-plugin title="Save UV Binary" plugin="fs" function="writeBin" inputs="path:atlas_bin_path.text,content:atlas_uv.binary" outputs="result" id="atlas_save" x="1400" y="220"></node-plugin>' ||
  '<node-popup title="UV Binary Path" outputs="text" id="atlas_bin_path" x="1150" y="340" values="text:/output/atlas.bin" template="node-popup-text"></node-popup>' ||
  '<node-output label="Atlas Metadata" format="json" inputs="value:atlas_uv.metadata" id="atlas_output" x="1400" y="340"></node-output>' ||
  '<node-code title="Build Anim Binary" inputs="data:atlas_sql.data,packResult:atlas_uv.metadata" outputs="binary,metadata" id="anim_binary" x="1150" y="440" src="local:/example/scripts/atlas/build-anim-binary.js"></node-code>' ||
  '<node-code title="Combine Binary" inputs="atlasBinary:atlas_uv.binary,animBinary:anim_binary.binary" outputs="binary,metadata" id="combined_binary" x="1400" y="440" src="local:/example/scripts/atlas/combine-binary.js"></node-code>' ||
  '<node-plugin title="Save Combined" plugin="fs" function="writeBin" inputs="path:combined_bin_path.text,content:combined_binary.binary" outputs="result" id="combined_save" x="1650" y="440"></node-plugin>' ||
  '<node-popup title="Combined Path" outputs="text" id="combined_bin_path" x="1400" y="560" values="text:/output/game.bin" template="node-popup-text"></node-popup>' ||
  '<node-output label="Combined Info" format="json" inputs="value:combined_binary.metadata" id="combined_output" x="1650" y="560"></node-output>' ||
  '<node-output label="Anim Info" format="json" inputs="value:anim_binary.metadata" id="anim_output" x="1150" y="560"></node-output>'
);

-- Example 3: Tilemap LUT Pipeline
-- Tilemap encoding: SQL -> Extract Tiles -> Build Tilesets -> Build LUTs -> Pack -> Build Binary
INSERT INTO pipeline_storage (name, node_count, html_content) VALUES (
  'Example: Tilemap LUT',
  10,
  '<node-code title="SQL: Get Tilemaps" inputs="" outputs="tilemaps" id="tilemap_sql" x="700" y="700" src="local:/example/scripts/tilemap/get-tilemaps.js"></node-code>' ||
  '<node-code title="Extract Map Tiles" inputs="tilemaps:tilemap_sql.tilemaps" outputs="extractedData" id="tilemap_extract" x="700" y="820" src="local:/example/scripts/tilemap/extract-map-tiles.js"></node-code>' ||
  '<node-code title="Build Tilesets" inputs="extractedData:tilemap_extract.extractedData" outputs="tilesetImages,tilesBySize,tilemaps" id="tilemap_tilesets" x="700" y="940" src="local:/example/scripts/tilemap/build-tilesets.js"></node-code>' ||
  '<node-code title="Build LUTs" inputs="tilemaps:tilemap_tilesets.tilemaps" outputs="lutImages" id="tilemap_luts" x="950" y="940" src="local:/example/scripts/tilemap/build-luts.js"></node-code>' ||
  '<node-plugin title="Pack All" plugin="sprite-pack" function="packTilesets" inputs="tilesets:tilemap_tilesets.tilesetImages,luts:tilemap_luts.lutImages,options:tilemap_pack_options.output,outputPath:tilemap_atlas_path.text" outputs="result" id="tilemap_pack" x="1150" y="940"></node-plugin>' ||
  '<node-popup title="Tilemap Atlas Path" outputs="text" id="tilemap_atlas_path" x="950" y="1060" values="text:/output/tilemap_atlas.qoi" template="node-popup-text"></node-popup>' ||
  '<node-code title="Tileset Pack Options" inputs="" outputs="output" id="tilemap_pack_options" x="950" y="1160" src="local:/example/scripts/tilemap/pack-options.js"></node-code>' ||
  '<node-code title="Build Tilemap Binary" inputs="tilemaps:tilemap_tilesets.tilemaps,packResult:tilemap_pack.result,lutImages:tilemap_luts.lutImages" outputs="binary,metadata" id="tilemap_binary" x="1400" y="940" src="local:/example/scripts/tilemap/build-tilemap-binary.js"></node-code>' ||
  '<node-output label="Tilemap Info" format="json" inputs="value:tilemap_binary.metadata" id="tilemap_output" x="1400" y="940"></node-output>' ||
  '<node-output label="Extracted Tiles" format="json" inputs="value:tilemap_extract.extractedData" id="tilemap_extract_output" x="950" y="820"></node-output>'
);
