-- Node Templates Database
-- Pure HTML templates for node creation (no id/x/y - handled by nodegraph)
-- NOTE: node-popup content MUST be wrapped in <template> to prevent premature rendering

CREATE TABLE IF NOT EXISTS node_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  html_template TEXT NOT NULL
);

-- Clear existing templates (for development - allows re-running migration)
DELETE FROM node_templates;

-- Input Nodes
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Number Input',
  'input',
  'User input for numeric values',
  '<node-input type="number" value="10" label="Value"></node-input>'
),
(
  'Text Input',
  'input',
  'User input for text',
  '<node-input type="text" value="" label="Text"></node-input>'
),
(
  'Range Input',
  'input',
  'Slider input',
  '<node-input type="range" value="50" min="0" max="100" label="Slider"></node-input>'
);

-- Plugin Nodes
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Tree Generator',
  'plugin',
  'Generate procedural tree',
  '<node-plugin title="Tree Generator" x="135" y="160" plugin="treegen" function="gen" inputs="name,nodeCount,maxDepth,maxBranching,rootBranches" outputs="result"></node-plugin>'
),
(
  'AutoMap',
  'plugin',
  'Generate tiles from rules',
  '<node-plugin title="AutoMap" x="135" y="160" plugin="automap" function="automap" inputs="rulesMapId,inputMapId,outputMapId" outputs="result"></node-plugin>'
),
(
  'Biome Assigner',
  'plugin',
  'Assign biome names to tree nodes',
  '<node-plugin title="Biome Assigner" plugin="biomes" function="gen" inputs="treeId,biomesQuery" outputs="result"></node-plugin>'
),
(
  'Key-Lock Assigner',
  'plugin',
  'Assign keys and locks to tree nodes for progression',
  '<node-plugin title="Key-Lock Assigner" plugin="keylock" function="gen" inputs="treeId,keysQuery,keyChance,lockChance,maxKeysPerLock" outputs="result"></node-plugin>'
),
(
  'Minimap Generator',
  'plugin',
  'Generate minimap from tree',
  '<node-plugin title="Minimap Generator" plugin="minimap" function="gen" inputs="treeId,mapId,direction" outputs="result"></node-plugin>'
),
(
  'Tilemap Scaler',
  'plugin',
  'Scale tilemap by integer factor',
  '<node-plugin title="Tilemap Scaler" plugin="scaler" function="scale" inputs="inputMapId,outputMapId,scaleFactor" outputs="result"></node-plugin>'
),
(
  'Room Gen',
  'plugin',
  'Generate room path',
  '<node-plugin title="Room Generator" plugin="roomgen" function="gen" inputs="inputMapId,outputMapId,jumpHeight,jumpDistance" outputs="result"></node-plugin>'
),
(
  'Logger',
  'plugin',
  'Log output to console',
  '<node-plugin plugin="host" function="log" inputs="logInput"></node-plugin>'
);

-- Utility Nodes
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Extract Fields',
  'util',
  'Extract fields from object',
  '<node-fields inputs="input" outputs="output,returnCode"></node-fields>'
),
(
  'To String',
  'util',
  'Convert to string',
  '<node-tostring inputs="input"></node-tostring>'
);

-- Filesystem Nodes (using fs host module)
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'File Read',
  'filesystem',
  'Read file contents (path as raw input)',
  '<node-plugin title="File Read" plugin="fs" function="read" inputs="raw" outputs="result"></node-plugin>'
),
(
  'File Write JSON',
  'filesystem',
  'Write data to file (path and content as JSON)',
  '<node-plugin title="File Write(json)" plugin="fs" function="writeJson" inputs="path,content" outputs="result"></node-plugin>'
),
(
  'File Write Bin',
  'filesystem',
  'Write data to file (path and content as Binary)',
  '<node-plugin title="File Write(bin)" plugin="fs" function="writeBin" inputs="path,content" outputs="result"></node-plugin>'
);

-- Interactive Template Nodes (using external templates from index.html)
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Text Input',
  'template',
  'Simple text input field',
  '<node-popup title="Text" label="THE TEXT" outputs="text" template="node-popup-text"></node-popup>'
),
(
  'Input Processor',
  'template', 
  'Example showing input and output data attributes',
  '<node-popup inputs="baseValue" outputs="result" template="node-popup-input-processor"></node-popup>'
),
(
  'Simple Numpad Test',
  'template',
  'Simple numpad test template',
  '<node-popup outputs="value" template="node-popup-simple-numpad"></node-popup>'
),
(
  'Number Input with Numpad',
  'template',
  'Interactive number input with numpad interface',
  '<node-popup outputs="value" template="node-popup-numpad"></node-popup>'
);

-- Preview Nodes (using external templates from index.html)
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'Tree Preview',
  'preview',
  'Preview tree structure from input (uses data-input-target)',
  '<node-popup inputs="storeKey" outputs="storeKey" data-input-target="storeKey:view-tree@data-store-key" template="node-popup-tree-preview"></node-popup>'
),
(
  'Tilemap Preview',
  'preview',
  'Preview tilemap from input (uses data-input-target)',
  '<node-popup inputs="mapId" outputs="mapId" data-input-target="mapId:view-tilemap@data-key" template="node-popup-tilemap-preview"></node-popup>'
),
(
  'Tree Preview (onopen)',
  'preview',
  'Preview tree with custom onopen handler',
  '<node-popup inputs="storeKey" outputs="storeKey" onopen="const tree = content.querySelector(''view-tree''); if (inputs.storeKey) tree.setAttribute(''data-store-key'', inputs.storeKey);" template="node-popup-tree-preview"></node-popup>'
);

INSERT INTO node_templates (name, category, description, html_template) VALUES (
  'Code Transform',
  'transform',
  'Custom JavaScript transformation with $in/$out',
  '<node-code title="Code" inputs="input" outputs="output">
$out.output = $in.input;
</node-code>'
);

-- SQL Database Nodes (use raw input mode for direct SQL strings)
INSERT INTO node_templates (name, category, description, html_template) VALUES
(
  'SQL Query',
  'database',
  'Execute SELECT query and return results (CSV format)',
  '<node-plugin title="SQL Query" plugin="sql" function="query" inputs="raw" outputs="result"></node-plugin>'
),
(
  'SQL Exec',
  'database',
  'Execute SQL statement (INSERT/UPDATE/DELETE/CREATE)',
  '<node-plugin title="SQL Exec" plugin="sql" function="exec" inputs="raw" outputs="result"></node-plugin>'
),
(
  'SQL Dump',
  'database',
  'Export entire database as SQL statements',
  '<node-plugin title="SQL Dump" plugin="sql" function="dump" inputs="raw" outputs="result"></node-plugin>'
),
(
  'SQL Restore',
  'database',
  'Restore database from SQL dump',
  '<node-plugin title="SQL Restore" plugin="sql" function="restore" inputs="raw" outputs="result"></node-plugin>'
),
(
  'SQL Table Preview',
  'database',
  'Interactive table view for SQL query results with editing',
  '<node-popup inputs="query" outputs="query" data-input-target="query:view-sql-table@data-query" template="node-popup-sql-table-preview"></node-popup>'
);
