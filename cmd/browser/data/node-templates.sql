-- Node Templates Database
-- Pure HTML templates for node creation (no id/x/y - handled by nodegraph)

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
  '<node-plugin plugin="treegen" function="gen" inputs="nodeCount" outputs="result"></node-plugin>'
),
(
  'Minimap Generator',
  'plugin',
  'Generate minimap from tree',
  '<node-plugin plugin="minimap" function="gen" inputs="treeId,mapId" outputs="result"></node-plugin>'
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
